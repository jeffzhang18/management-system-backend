import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  login(user: User) {
    const { password, ...userWithoutPassword } = user;

    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const refreshPayload = {
      sub: user.id,
      type: 'refresh',
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

  private assertTokenType(payload: any, expectedType: 'access' | 'refresh') {
    if (payload?.type !== expectedType) {
      throw new UnauthorizedException(`Invalid ${expectedType} token`);
    }
  }

  async revokeAccessToken(rawAccessToken: string) {
    const payload = this.jwtService.verify(rawAccessToken);
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
    const payload = this.jwtService.verify(rawRefreshToken);
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
}
