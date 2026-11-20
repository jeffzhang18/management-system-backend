import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UserService } from '../../domain/user/user.service';
import { EmailVerificationCode } from './entities/email-verification-code.entity';
import { MailService } from './mail.service';

export const CODE_TTL_MINUTES = 10;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerificationCode)
    private readonly repo: Repository<EmailVerificationCode>,
    private readonly mailService: MailService,
    private readonly userService: UserService,
  ) {}

  private normalize(email: string) {
    return email.trim().toLowerCase();
  }

  private hash(email: string, code: string) {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
  }

  async sendRegisterCode(rawEmail: string) {
    const email = this.normalize(rawEmail);
    const now = Date.now();

    const latest = await this.repo.findOne({
      where: { email },
      order: { created_at: 'DESC' },
    });
    if (latest && now - latest.created_at.getTime() < RESEND_INTERVAL_MS) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const recentCount = await this.repo.count({
      where: { email, created_at: MoreThan(new Date(now - 60 * 60 * 1000)) },
    });
    if (recentCount >= MAX_SENDS_PER_HOUR) {
      throw new HttpException(
        'Too many verification requests, try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (await this.userService.findByEmail(rawEmail.trim())) {
      return { sent: true };
    }

    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const record = await this.repo.save(
      this.repo.create({
        email,
        code_hash: this.hash(email, code),
        attempts: 0,
        used_at: null,
        expires_at: new Date(now + CODE_TTL_MINUTES * 60 * 1000),
      }),
    );

    try {
      await this.mailService.sendVerificationCode(email, code, CODE_TTL_MINUTES);
    } catch (error) {
      await this.repo.delete({ id: record.id });
      throw error;
    }
    return { sent: true };
  }

  async consume(rawEmail: string, code: string) {
    const email = this.normalize(rawEmail);
    const invalid = () =>
      new BadRequestException('Invalid or expired verification code');

    const record = await this.repo.findOne({
      where: { email, used_at: IsNull() },
      order: { created_at: 'DESC' },
    });
    if (
      !record ||
      record.expires_at.getTime() < Date.now() ||
      record.attempts >= MAX_ATTEMPTS
    ) {
      throw invalid();
    }

    const expected = Buffer.from(record.code_hash, 'hex');
    const actual = Buffer.from(this.hash(email, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.repo.increment({ id: record.id }, 'attempts', 1);
      throw invalid();
    }

    const result = await this.repo.update(
      { id: record.id, used_at: IsNull() },
      { used_at: new Date() },
    );
    if (!result.affected) {
      throw invalid();
    }
  }
}
