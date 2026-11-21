import { QrLoginSession } from './qr-login.entity';
import { QrLoginService } from './qr-login.service';
import { QrLoginController } from './qr-login.controller';
import { AddQrLoginSessions1795305600000 } from '../../../migrations/1795305600000-AddQrLoginSessions';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
} from 'node:crypto';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/server';
import { newDb } from 'pg-mem';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ApiCallLogService } from '../../../common/logging/api-call-log.service';
import { User } from '../../../domain/user/user.entity';
import { UserService } from '../../../domain/user/user.service';
import { AddPasskeys1795222800000 } from '../../../migrations/1795222800000-AddPasskeys';
import { AuthService } from '../auth.service';
import { EmailVerificationService } from '../email-verification.service';
import { EmailVerificationCode } from '../entities/email-verification-code.entity';
import { JwtStrategy } from '../jwt.strategy';
import type { MailService } from '../mail.service';
import type { TokenRevocationService } from '../token-revocation.service';
import { PasskeyController } from './passkey.controller';
import { Passkey, PasskeyChallenge } from './passkey.entity';
import { PasskeyService } from './passkey.service';

const origin = 'http://localhost:3001';
const rpID = 'localhost';
const hash = (data: string | Buffer) =>
  createHash('sha256').update(data).digest();
const b64 = (data: Uint8Array | string) =>
  Buffer.from(data).toString('base64url');

// A real ES256 authenticator fixture. The verifier and signature checks are never mocked.
function authenticator() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const id = randomBytes(32);
  const publicKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')],
    ]),
  );
  const data = (flags: number, counter: number, domain = rpID) => {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    return Buffer.concat([hash(domain), Buffer.from([flags]), count]);
  };
  return {
    registration(
      options: PublicKeyCredentialCreationOptionsJSON,
      overrides: { origin?: string; flags?: number } = {},
    ): RegistrationResponseJSON {
      const client = JSON.stringify({
        type: 'webauthn.create',
        challenge: options.challenge,
        origin: overrides.origin || origin,
      });
      const length = Buffer.alloc(2);
      length.writeUInt16BE(id.length);
      const authData = Buffer.concat([
        data(overrides.flags ?? 0x45, 0),
        Buffer.alloc(16),
        length,
        id,
        publicKey,
      ]);
      const attestation = isoCBOR.encode(
        new Map<string, string | Uint8Array | Map<string, string>>([
          ['fmt', 'none'],
          ['authData', authData],
          ['attStmt', new Map()],
        ]),
      );
      return {
        id: b64(id),
        rawId: b64(id),
        type: 'public-key',
        clientExtensionResults: { credProps: { rk: true } },
        response: {
          clientDataJSON: b64(client),
          attestationObject: b64(attestation),
          transports: ['internal', 'hybrid'],
        },
      };
    },
    assertion(
      challenge: string,
      userHandle: string,
      overrides: {
        origin?: string;
        flags?: number;
        domain?: string;
        counter?: number;
      } = {},
    ): AuthenticationResponseJSON {
      const client = Buffer.from(
        JSON.stringify({
          type: 'webauthn.get',
          challenge,
          origin: overrides.origin || origin,
        }),
      );
      const authData = data(
        overrides.flags ?? 0x05,
        overrides.counter ?? 1,
        overrides.domain,
      );
      const signature = sign(
        'sha256',
        Buffer.concat([authData, hash(client)]),
        pair.privateKey,
      );
      return {
        id: b64(id),
        rawId: b64(id),
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64(client),
          authenticatorData: b64(authData),
          signature: b64(signature),
          userHandle,
        },
      };
    },
  };
}

describe('Passkey HTTP flow with real WebAuthn verification', () => {
  let db: DataSource;
  let app: INestApplication;
  let users: UserService;
  let user: User;
  let auth: AuthService;
  let service: PasskeyService;
  let qr: QrLoginService;
  let email: EmailVerificationService;
  let token: string;
  let code: string;
  const originalEnv = {
    rpID: process.env.WEBAUTHN_RP_ID,
    origin: process.env.WEBAUTHN_ORIGIN,
  };

  beforeEach(async () => {
    process.env.WEBAUTHN_RP_ID = rpID;
    process.env.WEBAUTHN_ORIGIN = origin;
    const memory = newDb();
    memory.public.registerFunction({
      name: 'current_database',
      implementation: () => 'passkey_test',
    });
    memory.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 16',
    });
    db = memory.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [
        User,
        Passkey,
        PasskeyChallenge,
        EmailVerificationCode,
        QrLoginSession,
      ],
      synchronize: true,
    }) as DataSource;
    await db.initialize();
    // Exercise the deployment migration against the pre-passkey schema.
    await db.query('DROP TABLE sys_passkey_challenge');
    await db.query('DROP TABLE sys_passkey');
    const runner = db.createQueryRunner();
    await new AddPasskeys1795222800000().up(runner);
    await db.query('DROP TABLE sys_qr_login_session');
    await new AddQrLoginSessions1795305600000().up(runner);
    await runner.release();
    users = new UserService(db.getRepository(User));
    user = await users.createUser(
      'passkey@example.com',
      'Passkey user',
      'old-password',
    );
    const mail = {
      sendVerificationCode: (_to: string, value: string) => {
        code = value;
        return Promise.resolve();
      },
    };
    email = new EmailVerificationService(
      db.getRepository(EmailVerificationCode),
      mail as unknown as MailService,
      users,
    );
    const revocation = {
      isTokenRevoked: () => Promise.resolve(false),
      revokeToken: () => Promise.resolve({}),
    } as unknown as TokenRevocationService;
    auth = new AuthService(
      users,
      new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret' }),
      revocation,
      email,
      db,
    );
    new JwtStrategy(revocation, users);
    service = new PasskeyService(
      db.getRepository(Passkey),
      db.getRepository(PasskeyChallenge),
      users,
      auth,
      email,
      db,
    );
    qr = new QrLoginService(
      db.getRepository(QrLoginSession),
      service,
      auth,
      db,
    );
    const module = await Test.createTestingModule({
      controllers: [PasskeyController, QrLoginController],
      providers: [
        { provide: PasskeyService, useValue: service },
        { provide: QrLoginService, useValue: qr },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        {
          provide: ApiCallLogService,
          useValue: { log: () => Promise.resolve() },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    token = auth.login(user).accessToken;
  });

  afterEach(async () => {
    await app?.close();
    await db?.destroy();
    if (originalEnv.rpID === undefined) delete process.env.WEBAUTHN_RP_ID;
    else process.env.WEBAUTHN_RP_ID = originalEnv.rpID;
    if (originalEnv.origin === undefined) delete process.env.WEBAUTHN_ORIGIN;
    else process.env.WEBAUTHN_ORIGIN = originalEnv.origin;
  });

  async function register() {
    const device = authenticator();
    const { challengeId, options } = await service.registrationOptions(
      user.id,
      {},
    );
    await service.sendRegistrationCode(user.id);
    const response = device.registration(options);
    await request(app.getHttpServer() as Server)
      .post('/auth/passkeys/register/verify')
      .auth(token, { type: 'bearer' })
      .send({ challengeId, response, code, name: 'My phone' })
      .expect(201, { verified: true });
    return {
      device,
      userHandle: options.user.id,
      registration: { challengeId, response, code },
    };
  }

  it('registers a verified discoverable passkey, logs in without a password, and prevents replay', async () => {
    const { device, userHandle, registration } = await register();
    const listed = await request(app.getHttpServer() as Server)
      .get('/auth/passkeys')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const keys = listed.body as Array<Record<string, unknown>>;
    expect(keys[0]).toMatchObject({ name: 'My phone' });
    expect(keys[0]).not.toHaveProperty('publicKey');
    expect(keys[0]).not.toHaveProperty('credentialId');
    const { challengeId, options } = await service.authenticationOptions(
      '127.0.0.1',
      { mode: 'phone' },
    );
    expect(options.userVerification).toBe('required');
    expect(options.hints).toEqual(['hybrid']);
    expect(options.allowCredentials ?? []).toEqual([]);
    const response = device.assertion(options.challenge, userHandle);
    const loggedIn = await request(app.getHttpServer() as Server)
      .post('/auth/passkeys/login/verify')
      .send({ challengeId, response })
      .expect(201);
    const payload = loggedIn.body as ReturnType<AuthService['login']>;
    expect(payload.user.email).toBe(user.email);
    expect(payload.user).not.toHaveProperty('password');
    await expect(
      auth.refreshToken(payload.refreshToken),
    ).resolves.toHaveProperty('accessToken');
    expect(
      (await db.getRepository(Passkey).findOneByOrFail({ userId: user.id }))
        .counter,
    ).toBe(1);
    await request(app.getHttpServer() as Server)
      .post('/auth/passkeys/login/verify')
      .send({ challengeId, response })
      .expect(400);
    await request(app.getHttpServer() as Server)
      .post('/auth/passkeys/register/verify')
      .auth(token, { type: 'bearer' })
      .send(registration)
      .expect(400);
  });

  it.each([
    ['wrong origin', { origin: 'https://attacker.example' }],
    ['missing user verification', { flags: 0x01 }],
    ['wrong relying party', { domain: 'attacker.example' }],
  ])(
    'rejects an authentication response with %s',
    async (_label, overrides) => {
      const { device, userHandle } = await register();
      const { challengeId, options } = await service.authenticationOptions(
        '127.0.0.1',
        {},
      );
      const response = device.assertion(
        options.challenge,
        userHandle,
        overrides as { origin?: string; flags?: number; domain?: string },
      );
      await request(app.getHttpServer() as Server)
        .post('/auth/passkeys/login/verify')
        .send({ challengeId, response })
        .expect(400);
      const correct = device.assertion(options.challenge, userHandle);
      await request(app.getHttpServer() as Server)
        .post('/auth/passkeys/login/verify')
        .send({ challengeId, response: correct })
        .expect(400);
    },
  );

  it('rejects forged signatures, wrong challenges and account handles', async () => {
    const { device, userHandle } = await register();
    for (const kind of ['signature', 'challenge', 'userHandle']) {
      const { challengeId, options } = await service.authenticationOptions(
        '127.0.0.1',
        {},
      );
      const response = device.assertion(
        kind === 'challenge' ? b64('wrong-challenge') : options.challenge,
        userHandle,
      );
      if (kind === 'signature') {
        const bytes = Buffer.from(response.response.signature, 'base64url');
        bytes[bytes.length - 1] ^= 1;
        response.response.signature = b64(bytes);
      }
      if (kind === 'userHandle')
        response.response.userHandle = b64('another-user');
      await request(app.getHttpServer() as Server)
        .post('/auth/passkeys/login/verify')
        .send({ challengeId, response })
        .expect(400);
    }
  });

  it('requires an account email code and user verification when adding a passkey', async () => {
    await email.sendLoginCode(user.email);
    const loginCode = code;
    let ceremony = await service.registrationOptions(user.id, {});
    await expect(
      service.verifyRegistration(user.id, {
        challengeId: ceremony.challengeId,
        response: authenticator().registration(ceremony.options),
        code: loginCode,
      }),
    ).rejects.toThrow();
    expect(await db.getRepository(Passkey).count()).toBe(0);
    await service.sendRegistrationCode(user.id);
    ceremony = await service.registrationOptions(user.id, {});
    expect(ceremony.options.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    });
    await expect(
      service.verifyRegistration(user.id, {
        challengeId: ceremony.challengeId,
        response: authenticator().registration(ceremony.options, {
          flags: 0x41,
        }),
        code,
      }),
    ).rejects.toThrow();
    expect(await db.getRepository(Passkey).count()).toBe(0);
  });

  it('rejects expired and cross-account challenges', async () => {
    const { device, userHandle } = await register();
    const { challengeId, options } = await service.authenticationOptions(
      '127.0.0.1',
      {},
    );
    await db
      .getRepository(PasskeyChallenge)
      .update(challengeId, { expiresAt: new Date(Date.now() - 1) });
    await expect(
      service.verifyAuthentication({
        challengeId,
        response: device.assertion(options.challenge, userHandle),
      }),
    ).rejects.toThrow();
    const ceremony = await service.registrationOptions(user.id, {});
    await expect(
      service.verifyRegistration(user.id + 1, {
        challengeId: ceremony.challengeId,
        response: authenticator().registration(ceremony.options),
        code: '123456',
      }),
    ).rejects.toThrow();
  });

  it('scopes listing/deletion to the current user and refuses deleted credentials', async () => {
    const { device, userHandle } = await register();
    const [key] = await service.list(user.id);
    const other = await users.createUser(
      'other@example.com',
      'Other user',
      'password',
    );
    expect(await service.list(other.id)).toEqual([]);
    await expect(service.remove(other.id, key.id)).rejects.toThrow();
    await service.remove(user.id, key.id);
    const { challengeId, options } = await service.authenticationOptions(
      '127.0.0.1',
      {},
    );
    await expect(
      service.verifyAuthentication({
        challengeId,
        response: device.assertion(options.challenge, userHandle),
      }),
    ).rejects.toThrow();
  });

  it('protects registration and management endpoints and validates public input', async () => {
    await request(app.getHttpServer() as Server)
      .get('/auth/passkeys/config')
      .expect(200, {
        enabled: true,
        rpName: process.env.WEBAUTHN_RP_NAME || 'AGGREGATE',
      });
    await request(app.getHttpServer() as Server)
      .get('/auth/passkeys')
      .expect(401);
    for (const path of [
      'register/code',
      'register/options',
      'register/verify',
    ]) {
      await request(app.getHttpServer() as Server)
        .post(`/auth/passkeys/${path}`)
        .send({})
        .expect(401);
    }
    await request(app.getHttpServer() as Server)
      .delete(`/auth/passkeys/${randomUUID()}`)
      .expect(401);
    await request(app.getHttpServer() as Server)
      .post('/auth/passkeys/login/options')
      .send({ mode: 'invalid' })
      .expect(400);
    await request(app.getHttpServer() as Server)
      .post('/auth/passkeys/login/verify')
      .send({ challengeId: 'invalid', response: {} })
      .expect(400);
  });

  it('rejects a regressed authenticator counter on a new challenge', async () => {
    const { device, userHandle } = await register();
    let ceremony = await service.authenticationOptions('127.0.0.1', {});
    await service.verifyAuthentication({
      challengeId: ceremony.challengeId,
      response: device.assertion(ceremony.options.challenge, userHandle, {
        counter: 2,
      }),
    });
    ceremony = await service.authenticationOptions('127.0.0.1', {});
    await expect(
      service.verifyAuthentication({
        challengeId: ceremony.challengeId,
        response: device.assertion(ceremony.options.challenge, userHandle, {
          counter: 1,
        }),
      }),
    ).rejects.toThrow();
    expect(
      (await db.getRepository(Passkey).findOneByOrFail({ userId: user.id }))
        .counter,
    ).toBe(2);
  });

  it('invalidates enrollment challenges after a password reset changes the token version', async () => {
    const ceremony = await service.registrationOptions(user.id, {});
    await service.sendRegistrationCode(user.id);
    await db.getRepository(User).update(user.id, { tokenVersion: 1 });
    await expect(
      service.verifyRegistration(user.id, {
        challengeId: ceremony.challengeId,
        response: authenticator().registration(ceremony.options),
        code,
      }),
    ).rejects.toThrow();
    expect(await db.getRepository(Passkey).count()).toBe(0);
  });

  it('persists failed email-code attempts across enrollment challenges', async () => {
    await service.sendRegistrationCode(user.id);
    const correct = code;
    const wrong = correct === '000000' ? '000001' : '000000';
    const device = authenticator();
    for (let i = 0; i < 5; i++) {
      const ceremony = await service.registrationOptions(user.id, {});
      await expect(
        service.verifyRegistration(user.id, {
          challengeId: ceremony.challengeId,
          response: device.registration(ceremony.options),
          code: wrong,
        }),
      ).rejects.toThrow();
    }
    const ceremony = await service.registrationOptions(user.id, {});
    await expect(
      service.verifyRegistration(user.id, {
        challengeId: ceremony.challengeId,
        response: device.registration(ceremony.options),
        code: correct,
      }),
    ).rejects.toThrow();
    const record = await db
      .getRepository(EmailVerificationCode)
      .findOneByOrFail({ purpose: 'passkey-register' });
    expect(record.attempts).toBe(5);
    expect(await db.getRepository(Passkey).count()).toBe(0);
  });

  it('rate limits challenge creation and cleans expired records', async () => {
    for (let i = 0; i < 30; i++)
      await service.authenticationOptions('one-client', {});
    await expect(
      service.authenticationOptions('one-client', {}),
    ).rejects.toThrow('Too many passkey requests');
    await expect(
      service.authenticationOptions('another-client', {}),
    ).resolves.toBeDefined();
    await db
      .getRepository(PasskeyChallenge)
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1) })
      .execute();
    await service.cleanChallenges();
    expect(await db.getRepository(PasskeyChallenge).count()).toBe(0);
  });
  function scanTicket(session: Awaited<ReturnType<QrLoginService['create']>>) {
    const params = new URLSearchParams(new URL(session.qrUrl).hash.slice(1));
    return { sessionId: session.sessionId, token: params.get('token')! };
  }
  function desktopTicket(
    session: Awaited<ReturnType<QrLoginService['create']>>,
  ) {
    return { sessionId: session.sessionId, token: session.desktopToken };
  }
  async function approvedQr() {
    const { device, userHandle } = await register();
    const session = await qr.create('desktop');
    const scan = scanTicket(session);
    const options = await qr.options(scan, 'phone');
    await qr.approve({
      ...scan,
      challengeId: options.challengeId,
      response: device.assertion(options.options.challenge, userHandle),
    });
    return { session, scan };
  }

  it('shows a separate QR URL and exchanges a real phone passkey approval only on the original desktop', async () => {
    const { device, userHandle } = await register();
    const session = await qr.create('desktop');
    const scan = scanTicket(session);
    const desktop = desktopTicket(session);
    expect(session.qrUrl).toContain('/auth/qr-confirm#');
    expect(new URL(session.qrUrl).search).toBe('');
    expect(scan.token).not.toBe(session.desktopToken);
    expect(session.qrUrl).not.toContain(session.desktopToken);
    await expect(qr.exchange(desktop)).rejects.toThrow();
    await expect(qr.status(scan)).rejects.toThrow();
    await expect(qr.options(desktop, 'phone')).rejects.toThrow();
    const info = await qr.status(scan, 'scan');
    expect(info.verificationCode).toBe(session.verificationCode);
    const ceremony = await qr.options(scan, 'phone');
    expect(ceremony.options.hints).toEqual(['client-device']);
    const response = device.assertion(ceremony.options.challenge, userHandle);
    const approval = await request(app.getHttpServer() as Server)
      .post('/auth/qr-login/approve')
      .send({ ...scan, challengeId: ceremony.challengeId, response })
      .expect(201);
    expect(approval.body).toEqual({ approved: true });
    expect((await qr.status(desktop)).state).toBe('approved');
    await expect(qr.exchange(scan)).rejects.toThrow();
    const payload = await qr.exchange(desktop);
    expect(payload.user.email).toBe(user.email);
    await expect(
      auth.refreshToken(payload.refreshToken),
    ).resolves.toHaveProperty('accessToken');
    await expect(qr.exchange(desktop)).rejects.toThrow();
    expect((await qr.status(desktop)).state).toBe('consumed');
    const stored = await db
      .getRepository(QrLoginSession)
      .findOneByOrFail({ id: session.sessionId });
    expect(stored.scanTokenHash).not.toBe(scan.token);
    expect(stored.desktopTokenHash).not.toBe(session.desktopToken);
  });

  it('does not accept a valid passkey assertion from an unrelated challenge', async () => {
    const { device, userHandle } = await register();
    const session = await qr.create('desktop');
    const scan = scanTicket(session);
    await qr.options(scan, 'phone');
    const unrelated = await service.authenticationOptions('other-login', {});
    await expect(
      qr.approve({
        ...scan,
        challengeId: unrelated.challengeId,
        response: device.assertion(unrelated.options.challenge, userHandle),
      }),
    ).rejects.toThrow();
    expect((await qr.status(desktopTicket(session))).state).toBe('waiting');
    await expect(qr.exchange(desktopTicket(session))).rejects.toThrow();
  });

  it('allows cancelling or expiring a QR session without issuing a login', async () => {
    const session = await qr.create('desktop');
    await qr.cancel(scanTicket(session), 'scan');
    expect((await qr.status(desktopTicket(session))).state).toBe('cancelled');
    await expect(qr.options(scanTicket(session), 'phone')).rejects.toThrow();
    await expect(qr.exchange(desktopTicket(session))).rejects.toThrow();
    const expired = await qr.create('desktop');
    await db
      .getRepository(QrLoginSession)
      .update(expired.sessionId, { expiresAt: new Date(Date.now() - 1) });
    expect((await qr.status(desktopTicket(expired))).state).toBe('expired');
    await expect(qr.options(scanTicket(expired), 'phone')).rejects.toThrow();
  });

  it('refuses to redeem a passkey approval after password reset or credential deletion', async () => {
    const { session } = await approvedQr();
    await db.getRepository(User).increment({ id: user.id }, 'tokenVersion', 1);
    await expect(qr.exchange(desktopTicket(session))).rejects.toThrow();
    await db.getRepository(User).update(user.id, { tokenVersion: 0 });
    const key = await db
      .getRepository(Passkey)
      .findOneByOrFail({ userId: user.id });
    await service.remove(user.id, key.id);
    await expect(qr.exchange(desktopTicket(session))).rejects.toThrow();
  });

  it('validates public QR requests and limits session creation', async () => {
    await request(app.getHttpServer() as Server)
      .post('/auth/qr-login/status')
      .send({ sessionId: 'invalid', token: 'short' })
      .expect(400);
    for (let i = 0; i < 10; i++) await qr.create('same-ip');
    await expect(qr.create('same-ip')).rejects.toThrow(
      'Too many QR login requests',
    );
    await expect(qr.create('different-ip')).resolves.toHaveProperty('qrUrl');
  });
});
