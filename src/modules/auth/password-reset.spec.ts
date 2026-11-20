import type { Server } from 'node:http';
import type { Request } from 'express';
import type { AuthTokenPayload } from './token-payload';
import type { MailService } from './mail.service';
import type { TokenRevocationService } from './token-revocation.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
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
import { AddPasswordReset1795219200000 } from '../../migrations/1795219200000-AddPasswordReset';

describe('Password reset flow with isolated PostgreSQL adapter', () => {
  let db: DataSource;
  let app: INestApplication;
  let users: UserService;
  let auth: AuthService;
  let verification: EmailVerificationService;
  let strategy: JwtStrategy;
  let code: string;
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
    // Recreate the pre-upgrade columns and exercise the production migration.
    await db.query(
      'ALTER TABLE sys_email_verification_code DROP COLUMN purpose',
    );
    await db.query('ALTER TABLE user_info DROP COLUMN token_version');
    const runner = db.createQueryRunner();
    await new AddPasswordReset1795219200000().up(runner);
    await runner.release();
    users = new UserService(db.getRepository(User));
    verification = new EmailVerificationService(
      db.getRepository(EmailVerificationCode),
      {
        sendVerificationCode: jest.fn((_email: string, value: string) => {
          code = value;
          return Promise.resolve();
        }),
      } as unknown as MailService,
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
    strategy = new JwtStrategy(
      revocations as unknown as TokenRevocationService,
      users,
    );
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

  it('resets via public HTTP endpoints, rejects old credentials, and accepts new credentials', async () => {
    const original = await users.findByEmail('MixedCase@example.com');
    const tokens = auth.login(original!);
    await request(app.getHttpServer<Server>())
      .post('/auth/reset-password/code')
      .send({ email: 'mixedcase@example.com' })
      .expect(201);
    await request(app.getHttpServer<Server>())
      .post('/auth/reset-password')
      .send({
        email: ' MIXEDCASE@example.com ',
        code,
        password: 'new-password',
      })
      .expect(201);
    await expect(
      auth.validateUser('MixedCase@example.com', 'old-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const user = await auth.validateUser(
      'MixedCase@example.com',
      'new-password',
    );
    expect(user.tokenVersion).toBe(1);
    await expect(auth.refreshToken(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      strategy.validate(
        {
          headers: { authorization: `Bearer ${tokens.accessToken}` },
        } as unknown as Request,
        jwt.verify<AuthTokenPayload>(tokens.accessToken),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await request(app.getHttpServer<Server>())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(401);
    const fresh = auth.login(user);
    await expect(
      strategy.validate(
        {
          headers: { authorization: `Bearer ${fresh.accessToken}` },
        } as unknown as Request,
        jwt.verify<AuthTokenPayload>(fresh.accessToken),
      ),
    ).resolves.toMatchObject({ email: user.email });
    await request(app.getHttpServer<Server>())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${fresh.accessToken}`)
      .expect(200);
    await expect(auth.refreshToken(fresh.refreshToken)).resolves.toHaveProperty(
      'accessToken',
    );
    await request(app.getHttpServer<Server>())
      .post('/auth/reset-password')
      .send({ email: user.email, code, password: 'other-password' })
      .expect(400);
  });

  it('persists failed attempts and rejects the correct code after five errors', async () => {
    await verification.sendResetPasswordCode('mixedcase@example.com');
    const correct = code;
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
      await expect(
        auth.resetPassword({
          email: 'mixedcase@example.com',
          code: wrong,
          password: 'new-password',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(
      (
        await db
          .getRepository(EmailVerificationCode)
          .findOneByOrFail({ purpose: 'reset-password' })
      ).attempts,
    ).toBe(5);
    await expect(
      auth.resetPassword({
        email: 'mixedcase@example.com',
        code: correct,
        password: 'new-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      auth.validateUser('MixedCase@example.com', 'old-password'),
    ).resolves.toBeDefined();
  });

  it('rejects expired reset codes without changing the password', async () => {
    await verification.sendResetPasswordCode('mixedcase@example.com');
    await db
      .getRepository(EmailVerificationCode)
      .update(
        { purpose: 'reset-password' },
        { expires_at: new Date(Date.now() - 1000) },
      );
    await expect(
      auth.resetPassword({
        email: 'mixedcase@example.com',
        code,
        password: 'new-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      auth.validateUser('MixedCase@example.com', 'old-password'),
    ).resolves.toBeDefined();
  });

  it('validates DTOs even without a global validation pipe', async () => {
    await request(app.getHttpServer<Server>())
      .post('/auth/reset-password/code')
      .send({ email: 'invalid' })
      .expect(400);
    for (const body of [
      {
        email: 'mixedcase@example.com',
        code: 'abcdef',
        password: 'new-password',
      },
      { email: 'mixedcase@example.com', code: '123456', password: '123' },
      { email: 'mixedcase@example.com', code: '123456' },
    ]) {
      await request(app.getHttpServer<Server>())
        .post('/auth/reset-password')
        .send(body)
        .expect(400);
    }
  });
});
