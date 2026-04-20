import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { TokenRevocation } from './entities/token-revocation.entity';

type RevokeTokenPayload = {
  rawToken: string;
  tokenType: 'access' | 'refresh';
  userEmail?: string | null;
  userId?: string | null;
  expiresAt?: Date | null;
};

@Injectable()
export class TokenRevocationService {
  constructor(
    @InjectRepository(TokenRevocation)
    private readonly tokenRevocationRepository: Repository<TokenRevocation>,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async revokeToken(payload: RevokeTokenPayload) {
    const tokenHash = this.hashToken(payload.rawToken);

    const existing = await this.tokenRevocationRepository.findOne({
      where: { token_hash: tokenHash },
    });

    if (existing) {
      return existing;
    }

    const row = this.tokenRevocationRepository.create({
      token_hash: tokenHash,
      token_type: payload.tokenType,
      user_email: payload.userEmail ?? null,
      user_id: payload.userId ?? null,
      expires_at: payload.expiresAt ?? null,
    });

    return this.tokenRevocationRepository.save(row);
  }

  async isTokenRevoked(rawToken: string): Promise<boolean> {
    const tokenHash = this.hashToken(rawToken);
    const row = await this.tokenRevocationRepository.findOne({
      where: { token_hash: tokenHash },
      select: { id: true },
    });

    return Boolean(row);
  }
}
