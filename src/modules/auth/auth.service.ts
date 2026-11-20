import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { EmailVerificationService } from './email-verification.service';
import { LoginWithEmailCodeDto } from './dto/login-with-email-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthTokenPayload } from './token-payload';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../domain/user/user.service';
import { User } from '../../domain/user/user.entity';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly dataSource: DataSource,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const ok = await this.userService.validatePassword(user, password);
    if (!ok) {
      throw new UnauthorizedException('Invalid password');
    }

    return user;
  }

  async loginWithEmailCode(body: LoginWithEmailCodeDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const user = await this.userService.findByEmailInsensitive(
        body.email,
        manager,
      );
      if (!user)
        throw new BadRequestException('Invalid or expired verification code');
      try {
        await this.emailVerificationService.consume(
          body.email,
          body.code,
          'login',
          manager,
        );
      } catch (error) {
        // Commit failed-attempt increments while returning a validation error.
        if (error instanceof BadRequestException) return error;
        throw error;
      }
      return this.issueTokens(user);
    });
    if (result instanceof BadRequestException) throw result;
    return result;
  }

  async resetPassword(body: ResetPasswordDto) {
    // Hash before claiming the code, keeping the transaction short.
    const password = await bcrypt.hash(body.password, 10);
    const result = await this.dataSource.transaction(async (manager) => {
      const user = await this.userService.findByEmailInsensitive(
        body.email,
        manager,
      );
      if (!user)
        throw new BadRequestException('Invalid or expired verification code');
      // Return validation failures so failed-attempt increments commit too.
      try {
        await this.emailVerificationService.consume(
          body.email,
          body.code,
          'reset-password',
          manager,
        );
      } catch (error) {
        if (error instanceof BadRequestException) return error;
        throw error;
      }
      await manager.getRepository(User).update(user.id, {
        password,
        tokenVersion: () => 'token_version + 1',
      });
      return { message: 'Password reset successfully' };
    });
    if (result instanceof BadRequestException) throw result;
    return result;
  }

  login(user: User) {
    return this.issueTokens(user);
  }

  private issueTokens(user: User) {
    const { password, ...userWithoutPassword } = user;

    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      tokenVersion: user.tokenVersion ?? 0,
    };

    const refreshPayload = {
      sub: user.id,
      type: 'refresh',
      tokenVersion: user.tokenVersion ?? 0,
    };

    return {
      user: userWithoutPassword,
      accessToken: this.jwtService.sign(accessPayload, {
        expiresIn: '1d',
      }),
      refreshToken: this.jwtService.sign(refreshPayload, {
        expiresIn: '7d',
      }),
    };
  }

  private assertTokenType(
    payload: AuthTokenPayload,
    expectedType: 'access' | 'refresh',
  ) {
    if (payload?.type !== expectedType) {
      throw new UnauthorizedException(`Invalid ${expectedType} token`);
    }
  }

  async revokeAccessToken(rawAccessToken: string) {
    const payload = this.jwtService.verify<AuthTokenPayload>(rawAccessToken);
    this.assertTokenType(payload, 'access');

    const expiresAt = payload?.exp ? new Date(payload.exp * 1000) : null;

    await this.tokenRevocationService.revokeToken({
      rawToken: rawAccessToken,
      tokenType: 'access',
      userEmail: payload?.email ?? null,
      userId: payload?.sub ? String(payload.sub) : null,
      expiresAt,
    });

    return {
      message: 'Access token revoked successfully',
    };
  }

  async revokeRefreshToken(rawRefreshToken: string) {
    const payload = this.jwtService.verify<AuthTokenPayload>(rawRefreshToken);
    this.assertTokenType(payload, 'refresh');

    const expiresAt = payload?.exp ? new Date(payload.exp * 1000) : null;

    await this.tokenRevocationService.revokeToken({
      rawToken: rawRefreshToken,
      tokenType: 'refresh',
      userEmail: payload?.email ?? null,
      userId: payload?.sub ? String(payload.sub) : null,
      expiresAt,
    });

    return {
      message: 'Refresh token revoked successfully',
    };
  }

  async refreshToken(rawRefreshToken: string) {
    const payload = this.jwtService.verify<AuthTokenPayload>(rawRefreshToken);
    this.assertTokenType(payload, 'refresh');

    const revoked =
      await this.tokenRevocationService.isTokenRevoked(rawRefreshToken);

    if (revoked) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const userId = Number(payload?.sub);

    if (!Number.isInteger(userId)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Token revoked');
    }

    const expiresAt = payload?.exp ? new Date(payload.exp * 1000) : null;

    await this.tokenRevocationService.revokeToken({
      rawToken: rawRefreshToken,
      tokenType: 'refresh',
      userEmail: user.email,
      userId: String(user.id),
      expiresAt,
    });

    return this.issueTokens(user);
  }
}
