import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  DataSource,
  EntityManager,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
import { User } from '../../../domain/user/user.entity';
import { AuthService } from '../auth.service';
import { getPasskeyConfig } from './passkey-config';
import { Passkey } from './passkey.entity';
import { PasskeyService } from './passkey.service';
import { ApproveQrLoginDto, QrSessionTokenDto } from './qr-login.dto';
import { QrLoginSession } from './qr-login.entity';

const TTL_MS = 5 * 60 * 1000;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const invalid = () =>
  new BadRequestException('Invalid or expired QR login session');

@Injectable()
export class QrLoginService {
  constructor(
    @InjectRepository(QrLoginSession)
    private readonly sessions: Repository<QrLoginSession>,
    private readonly passkeys: PasskeyService,
    private readonly auth: AuthService,
    private readonly db: DataSource,
  ) {}

  async create(ip: string) {
    const { origin } = getPasskeyConfig();
    const requesterKey = hash(ip);
    const count = await this.sessions.count({
      where: {
        requesterKey,
        createdAt: MoreThan(new Date(Date.now() - 60000)),
      },
    });
    if (count >= 10)
      throw new HttpException(
        'Too many QR login requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const scanToken = randomBytes(32).toString('base64url');
    const desktopToken = randomBytes(32).toString('base64url');
    const session = await this.sessions.save(
      this.sessions.create({
        id: randomUUID(),
        scanTokenHash: hash(scanToken),
        desktopTokenHash: hash(desktopToken),
        verificationCode: randomInt(0, 1000000).toString().padStart(6, '0'),
        requesterKey,
        expiresAt: new Date(Date.now() + TTL_MS),
        challengeId: null,
        userId: null,
        tokenVersion: null,
        passkeyId: null,
        approvedAt: null,
        consumedAt: null,
        cancelledAt: null,
      }),
    );
    const fragment = new URLSearchParams({
      session: session.id,
      token: scanToken,
    });
    return {
      sessionId: session.id,
      desktopToken,
      expiresAt: session.expiresAt,
      verificationCode: session.verificationCode,
      // The scan secret is never a desktop redemption secret, and fragments do not go into HTTP request URLs.
      qrUrl: `${origin}/auth/qr-confirm#${fragment.toString()}`,
    };
  }

  private assertToken(
    session: QrLoginSession | null,
    token: string,
    side: 'scan' | 'desktop',
  ): asserts session is QrLoginSession {
    if (!session) throw invalid();
    const expected = Buffer.from(
      side === 'scan' ? session.scanTokenHash : session.desktopTokenHash,
      'hex',
    );
    const actual = Buffer.from(hash(token), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw invalid();
  }

  private state(session: QrLoginSession) {
    if (session.consumedAt) return 'consumed';
    if (session.cancelledAt) return 'cancelled';
    if (session.expiresAt.getTime() <= Date.now()) return 'expired';
    return session.approvedAt ? 'approved' : 'waiting';
  }

  async status(body: QrSessionTokenDto, side: 'scan' | 'desktop' = 'desktop') {
    const session = await this.sessions.findOneBy({ id: body.sessionId });
    this.assertToken(session, body.token, side);
    return {
      state: this.state(session),
      expiresAt: session.expiresAt,
      verificationCode: session.verificationCode,
    };
  }

  private async locked<T>(
    body: QrSessionTokenDto,
    side: 'scan' | 'desktop',
    action: (session: QrLoginSession, manager: EntityManager) => Promise<T>,
  ) {
    return this.db.transaction(async (manager) => {
      const session = await manager.getRepository(QrLoginSession).findOne({
        where: { id: body.sessionId },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertToken(session, body.token, side);
      return action(session, manager);
    });
  }

  async options(body: QrSessionTokenDto, ip: string) {
    return this.locked(body, 'scan', async (session, manager) => {
      if (this.state(session) !== 'waiting') throw invalid();
      const result = await this.passkeys.authenticationOptions(ip, {
        mode: 'local',
      });
      await manager
        .getRepository(QrLoginSession)
        .update(session.id, { challengeId: result.challengeId });
      return result;
    });
  }

  async approve(body: ApproveQrLoginDto) {
    return this.locked(body, 'scan', async (session, manager) => {
      if (
        this.state(session) !== 'waiting' ||
        session.challengeId !== body.challengeId
      )
        throw invalid();
      const identity = await this.passkeys.verifyAuthenticationIdentity(body);
      if (session.expiresAt.getTime() <= Date.now()) throw invalid();
      await manager.getRepository(QrLoginSession).update(session.id, {
        userId: identity.user.id,
        tokenVersion: identity.user.tokenVersion,
        passkeyId: identity.passkeyId,
        approvedAt: new Date(),
      });
      // Credentials are issued only to the original desktop when it redeems its private secret.
      return { approved: true };
    });
  }

  async exchange(body: QrSessionTokenDto) {
    return this.locked(body, 'desktop', async (session, manager) => {
      if (
        this.state(session) !== 'approved' ||
        !session.userId ||
        !session.passkeyId
      )
        throw invalid();
      const user = await manager
        .getRepository(User)
        .findOneBy({ id: session.userId });
      const key = await manager
        .getRepository(Passkey)
        .findOneBy({ id: session.passkeyId, userId: session.userId });
      if (
        !user ||
        !key ||
        Number(user.tokenVersion) !== Number(session.tokenVersion)
      )
        throw invalid();
      await manager
        .getRepository(QrLoginSession)
        .update(session.id, { consumedAt: new Date() });
      return this.auth.login(user);
    });
  }

  async cancel(body: QrSessionTokenDto, side: 'scan' | 'desktop') {
    return this.locked(body, side, async (session, manager) => {
      if (!session.consumedAt && !session.cancelledAt) {
        await manager
          .getRepository(QrLoginSession)
          .update(session.id, { cancelledAt: new Date() });
      }
      return { cancelled: true };
    });
  }

  @Cron('15 * * * *')
  async cleanup() {
    await this.sessions.delete({ expiresAt: LessThan(new Date()) });
  }
}
