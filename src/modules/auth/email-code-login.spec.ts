import type { Server } from 'node:http';
import type { MailService } from './mail.service';
import type { TokenRevocationService } from './token-revocation.service';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { newDb } from 'pg-mem';
import { User } from '../../domain/user/user.entity';
import { UserService } from '../../domain/user/user.service';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationCode } from './entities/email-verification-code.entity';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiCallLogService } from '../../common/logging/api-call-log.service';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

// Keep login and reset codes distinct so purpose-isolation assertions are deterministic.
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  let nextCode = 100000;
  return { ...actual, randomInt: () => nextCode++ };
});

describe('Email code login with isolated PostgreSQL adapter', () => {
  let db: DataSource;
  let app: INestApplication;
  let users: UserService;
  let auth: AuthService;
  let verification: EmailVerificationService;
  let code: string;
  let mail: { sendVerificationCode: jest.Mock };
  const email = 'MixedCase@example.com';
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET || 'dev-secret',
  });

  beforeEach(async () => {
    const memory = newDb();
    memory.public.registerFunction({
      name: 'current_database',
      implementation: () => 'auth_test',
    });
    memory.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 16',
    });
    db = memory.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [User, EmailVerificationCode],
      synchronize: false,
    }) as DataSource;
    await db.initialize();
    await db.synchronize();
    users = new UserService(db.getRepository(User));
    mail = {
      sendVerificationCode: jest.fn((_email: string, value: string) => {
        code = value;
        return Promise.resolve();
      }),
    };
    verification = new EmailVerificationService(
      db.getRepository(EmailVerificationCode),
      mail as unknown as MailService,
      users,
    );
    const revocations = {
      isTokenRevoked: () => Promise.resolve(false),
      revokeToken: () => Promise.resolve({}),
    };
    auth = new AuthService(
      users,
      jwt,
      revocations as unknown as TokenRevocationService,
      verification,
      db,
    );
    new JwtStrategy(revocations as unknown as TokenRevocationService, users);
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        {
          provide: ApiCallLogService,
          useValue: { log: () => Promise.resolve() },
        },
        { provide: AuthService, useValue: auth },
        { provide: UserService, useValue: users },
        { provide: EmailVerificationService, useValue: verification },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    await users.createUser('MixedCase@example.com', 'tester', 'old-password');
  });

  afterEach(async () => {
    await app?.close();
    await db?.destroy();
  });

  it('logs in without a password and issues usable access and refresh tokens', async () => {
    const original = await users.findByEmail(email);
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email/code')
      .send({ email: ' mixedcase@example.com ' })
      .expect(201, { sent: true });
    expect(mail.sendVerificationCode).toHaveBeenCalledWith(
      'mixedcase@example.com',
      code,
      10,
      'login',
      'en-US',
    );
    const response = await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email: ' MIXEDCASE@example.com ', code })
      .expect(201);
    const result = response.body as ReturnType<AuthService['login']>;
    expect(result.user.email).toBe(email);
    expect(result.user).not.toHaveProperty('password');
    await request(app.getHttpServer() as Server)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .expect(200);
    await request(app.getHttpServer() as Server)
      .post('/auth/refresh-token')
      .send({ refreshToken: result.refreshToken })
      .expect(201);
    await expect(
      auth.validateUser(email, 'old-password'),
    ).resolves.toBeDefined();
    expect((await users.findByEmail(email))!.tokenVersion).toBe(
      original!.tokenVersion,
    );
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code })
      .expect(400);
  });

  it('does not send codes or create accounts for unknown email addresses', async () => {
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email/code')
      .send({ email: 'unknown@example.com' })
      .expect(201, { sent: true });
    expect(mail.sendVerificationCode).not.toHaveBeenCalled();
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email: 'unknown@example.com', code: '123456' })
      .expect(400);
    expect(await db.getRepository(User).count()).toBe(1);
  });

  it('counts failed attempts and locks the login code after five errors', async () => {
    await verification.sendLoginCode(email);
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer() as Server)
        .post('/auth/login/email')
        .send({ email, code: wrong })
        .expect(400);
    }
    const record = await db
      .getRepository(EmailVerificationCode)
      .findOneByOrFail({ purpose: 'login' });
    expect(record.attempts).toBe(5);
    expect(record.used_at).toBeNull();
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code })
      .expect(400);
  });

  it('rejects expired login codes', async () => {
    await verification.sendLoginCode(email);
    await db
      .getRepository(EmailVerificationCode)
      .update(
        { purpose: 'login' },
        { expires_at: new Date(Date.now() - 1000) },
      );
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code })
      .expect(400);
  });

  it('keeps login codes isolated from registration and password reset codes', async () => {
    await verification.sendResetPasswordCode(email);
    const resetCode = code;
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code: resetCode })
      .expect(400);
    await verification.sendLoginCode(email);
    const loginCode = code;
    await request(app.getHttpServer() as Server)
      .post('/auth/reset-password')
      .send({ email, code: loginCode, password: 'new-password' })
      .expect(400);
    await expect(verification.consume(email, loginCode)).rejects.toThrow();
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code: loginCode })
      .expect(201);
  });

  it('accepts only the most recent login code', async () => {
    await verification.sendLoginCode(email);
    const oldCode = code;
    await db
      .getRepository(EmailVerificationCode)
      .update(
        { purpose: 'login' },
        { created_at: new Date(Date.now() - 61000) },
      );
    await verification.sendLoginCode(email);
    expect(oldCode).not.toBe(code);
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code: oldCode })
      .expect(400);
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code })
      .expect(201);
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email')
      .send({ email, code: oldCode })
      .expect(400);
  });

  it('enforces resend interval and hourly limits', async () => {
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email/code')
      .send({ email })
      .expect(201);
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email/code')
      .send({ email })
      .expect(429);
    for (let i = 0; i < 4; i++) {
      await db
        .getRepository(EmailVerificationCode)
        .update(
          { purpose: 'login' },
          { created_at: new Date(Date.now() - 61000) },
        );
      await request(app.getHttpServer() as Server)
        .post('/auth/login/email/code')
        .send({ email })
        .expect(201);
    }
    await db
      .getRepository(EmailVerificationCode)
      .update(
        { purpose: 'login' },
        { created_at: new Date(Date.now() - 61000) },
      );
    await request(app.getHttpServer() as Server)
      .post('/auth/login/email/code')
      .send({ email })
      .expect(429);
    expect(mail.sendVerificationCode).toHaveBeenCalledTimes(5);
  });

  it('validates email and code without a global validation pipe', async () => {
    for (const value of [undefined, '', 'invalid', 123]) {
      await request(app.getHttpServer() as Server)
        .post('/auth/login/email/code')
        .send({ email: value })
        .expect(400);
    }
    for (const value of [undefined, '', 'abcdef', '12345', 123456]) {
      await request(app.getHttpServer() as Server)
        .post('/auth/login/email')
        .send({ email, code: value })
        .expect(400);
    }
  });

  it('removes failed SMTP deliveries so sending can be retried', async () => {
    mail.sendVerificationCode.mockRejectedValueOnce(
      new Error('SMTP unavailable'),
    );
    await expect(verification.sendLoginCode(email)).rejects.toThrow(
      'SMTP unavailable',
    );
    expect(await db.getRepository(EmailVerificationCode).count()).toBe(0);
    await expect(verification.sendLoginCode(email)).resolves.toEqual({
      sent: true,
    });
  });
});
