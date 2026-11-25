import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { User } from '../../../domain/user/user.entity';
import { UserService } from '../../../domain/user/user.service';
import { AuthService } from '../auth.service';
import { EmailVerificationService } from '../email-verification.service';
import type { Locale } from '../../../common/i18n/locale';
import { getPasskeyConfig } from './passkey-config';
import { Passkey, PasskeyChallenge } from './passkey.entity';
import {
  PasskeyOptionsDto,
  VerifyPasskeyLoginDto,
  VerifyPasskeyRegistrationDto,
} from './passkey.dto';

const TTL_MS = 5 * 60 * 1000;
const ALGORITHMS = [-7, -257];
const invalid = () =>
  new BadRequestException('Invalid or expired passkey verification');

@Injectable()
export class PasskeyService {
  constructor(
    @InjectRepository(Passkey) private readonly keys: Repository<Passkey>,
    @InjectRepository(PasskeyChallenge)
    private readonly challenges: Repository<PasskeyChallenge>,
    private readonly users: UserService,
    private readonly auth: AuthService,
    private readonly email: EmailVerificationService,
    private readonly db: DataSource,
  ) {}

  config() {
    try {
      return { enabled: true, rpName: getPasskeyConfig().rpName };
    } catch {
      return { enabled: false };
    }
  }

  async list(userId: number) {
    const keys = await this.keys.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return keys.map(
      ({ id, name, createdAt, lastUsedAt, deviceType, backedUp }) => ({
        id,
        name,
        createdAt,
        lastUsedAt,
        deviceType,
        backedUp,
      }),
    );
  }

  async remove(userId: number, id: string) {
    const result = await this.keys.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Passkey not found');
    return { deleted: true };
  }

  async sendRegistrationCode(userId: number, locale?: Locale) {
    getPasskeyConfig();
    const user = await this.users.findById(userId);
    if (!user) throw invalid();
    return this.email.sendPasskeyRegistrationCode(user.email, locale);
  }

  private async saveChallenge(
    purpose: 'register' | 'login',
    challenge: string,
    requesterKey: string,
    user?: User,
  ) {
    const count = await this.challenges.count({
      where: {
        requesterKey,
        createdAt: MoreThan(new Date(Date.now() - 60000)),
      },
    });
    if (count >= 30)
      throw new HttpException(
        'Too many passkey requests, try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const record = await this.challenges.save(
      this.challenges.create({
        id: randomUUID(),
        purpose,
        challenge,
        requesterKey,
        userId: user?.id ?? null,
        tokenVersion: user ? user.tokenVersion : null,
        expiresAt: new Date(Date.now() + TTL_MS),
        usedAt: null,
      }),
    );
    return record.id;
  }

  async registrationOptions(userId: number, body: PasskeyOptionsDto = {}) {
    const { rpID, rpName } = getPasskeyConfig();
    const user = await this.users.findById(userId);
    if (!user) throw invalid();
    const keys = await this.keys.find({ where: { userId } });
    if (keys.length >= 10)
      throw new BadRequestException('You can register up to 10 passkeys');
    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: new TextEncoder().encode(user.user_id),
      userName: user.email,
      userDisplayName: user.user_name || user.email,
      timeout: TTL_MS,
      attestationType: 'none',
      supportedAlgorithmIDs: ALGORITHMS,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      ...(body.mode === 'phone'
        ? { preferredAuthenticatorType: 'remoteDevice' as const }
        : {}),
      excludeCredentials: keys.map((key) => ({
        id: key.credentialId,
        transports: key.transports,
      })),
    });
    const challengeId = await this.saveChallenge(
      'register',
      options.challenge,
      `user:${userId}`,
      user,
    );
    return { challengeId, options };
  }

  async authenticationOptions(ip: string, body: PasskeyOptionsDto = {}) {
    const { rpID } = getPasskeyConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      timeout: TTL_MS,
    });
    // Let the browser provide and secure the cross-device QR ceremony.
    options.hints = body.mode === 'phone' ? ['hybrid'] : ['client-device'];
    const requesterKey = `ip:${createHash('sha256').update(ip).digest('hex')}`;
    const challengeId = await this.saveChallenge(
      'login',
      options.challenge,
      requesterKey,
    );
    return { challengeId, options };
  }

  private async withChallenge<T>(
    id: string,
    purpose: 'register' | 'login',
    userId: number | null,
    action: (manager: EntityManager, challenge: PasskeyChallenge) => Promise<T>,
  ) {
    const result = await this.db.transaction(async (manager) => {
      const repo = manager.getRepository(PasskeyChallenge);
      const challenge = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !challenge ||
        challenge.purpose !== purpose ||
        challenge.userId !== userId ||
        challenge.usedAt ||
        challenge.expiresAt.getTime() <= Date.now()
      )
        return invalid();
      // A submitted response is single-use, including failed verification attempts.
      await repo.update(id, { usedAt: new Date() });
      try {
        return await action(manager, challenge);
      } catch (error) {
        // Persist failed OTP attempts and the spent challenge, but roll back database failures.
        if (
          error instanceof BadRequestException ||
          error instanceof ConflictException
        )
          return error;
        throw error;
      }
    });
    if (
      result instanceof BadRequestException ||
      result instanceof ConflictException
    )
      throw result;
    return result;
  }

  async verifyRegistration(userId: number, body: VerifyPasskeyRegistrationDto) {
    const { origin, rpID } = getPasskeyConfig();
    return this.withChallenge(
      body.challengeId,
      'register',
      userId,
      async (manager, challenge) => {
        const user = await manager.getRepository(User).findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !user ||
          Number(user.tokenVersion) !== Number(challenge.tokenVersion)
        )
          throw invalid();
        let verification: Awaited<
          ReturnType<typeof verifyRegistrationResponse>
        >;
        try {
          verification = await verifyRegistrationResponse({
            response: body.response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true,
            supportedAlgorithmIDs: ALGORITHMS,
          });
        } catch {
          throw invalid();
        }
        if (
          !verification.verified ||
          !verification.registrationInfo.userVerified
        )
          throw invalid();
        const info = verification.registrationInfo;
        const repo = manager.getRepository(Passkey);
        if ((await repo.count({ where: { userId } })) >= 10)
          throw new BadRequestException('You can register up to 10 passkeys');
        if (await repo.findOneBy({ credentialId: info.credential.id }))
          throw new ConflictException('Passkey already registered');
        await this.email.consume(
          user.email,
          body.code,
          'passkey-register',
          manager,
        );
        await repo.save(
          repo.create({
            id: randomUUID(),
            userId,
            credentialId: info.credential.id,
            publicKey: Buffer.from(info.credential.publicKey).toString(
              'base64url',
            ),
            userHandle: Buffer.from(user.user_id).toString('base64url'),
            counter: info.credential.counter,
            transports: info.credential.transports || [],
            deviceType: info.credentialDeviceType,
            backedUp: info.credentialBackedUp,
            name: body.name?.trim() || 'Passkey',
            lastUsedAt: null,
          }),
        );
        return { verified: true };
      },
    );
  }

  async verifyAuthentication(body: VerifyPasskeyLoginDto) {
    const { user } = await this.verifyAuthenticationIdentity(body);
    return this.auth.login(user);
  }

  async verifyAuthenticationIdentity(body: VerifyPasskeyLoginDto) {
    const { origin, rpID } = getPasskeyConfig();
    return this.withChallenge(
      body.challengeId,
      'login',
      null,
      async (manager, challenge) => {
        const repo = manager.getRepository(Passkey);
        const key =
          typeof body.response.id === 'string'
            ? await repo.findOne({
                where: { credentialId: body.response.id },
                lock: { mode: 'pessimistic_write' },
              })
            : null;
        if (!key || body.response.response?.userHandle !== key.userHandle)
          throw invalid();
        let verification: Awaited<
          ReturnType<typeof verifyAuthenticationResponse>
        >;
        try {
          verification = await verifyAuthenticationResponse({
            response: body.response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true,
            credential: {
              id: key.credentialId,
              publicKey: new Uint8Array(
                Buffer.from(key.publicKey, 'base64url'),
              ),
              counter: key.counter,
            },
          });
        } catch {
          throw invalid();
        }
        if (
          !verification.verified ||
          !verification.authenticationInfo.userVerified
        )
          throw invalid();
        const user = await manager
          .getRepository(User)
          .findOneBy({ id: key.userId });
        if (!user) throw invalid();
        await repo.update(key.id, {
          counter: verification.authenticationInfo.newCounter,
          backedUp: verification.authenticationInfo.credentialBackedUp,
          lastUsedAt: new Date(),
        });
        return { user, passkeyId: key.id };
      },
    );
  }

  @Cron('0 * * * *')
  async cleanChallenges() {
    await this.challenges.delete({ expiresAt: LessThan(new Date()) });
  }
}
