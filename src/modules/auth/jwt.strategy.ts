import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UserService } from '../../domain/user/user.service';
import type { AuthTokenPayload } from './token-payload';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: AuthTokenPayload) {
    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    if (payload?.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const revoked = await this.tokenRevocationService.isTokenRevoked(token);

    if (revoked) {
      throw new UnauthorizedException('Token revoked');
    }

    const user = await this.userService.findById(Number(payload.sub));
    if (!user || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Token revoked');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
