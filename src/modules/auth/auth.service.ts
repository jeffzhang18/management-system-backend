import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(username: string, password: string) {
    // TODO：后面接数据库
    if (username === 'admin' && password === '123456') {
      return {
        id: 1,
        username: 'admin',
        roles: ['admin'],
      };
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  login(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
