import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../domain/user/user.service';
import { User } from '../../domain/user/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
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
      user: {
        id: user.id,
        email: user.email,
        username: user.user_name,
        avatar: user.avatar,
        role: user.role,
        premissions:[]
      },
      accessToken: this.jwtService.sign(accessPayload, {
        expiresIn: '1d',
      }),
      refreshToken: this.jwtService.sign(refreshPayload, {
        expiresIn: '7d',
      }),
    };
  }
}
