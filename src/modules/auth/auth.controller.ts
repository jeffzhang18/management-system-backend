import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../../domain/user/user.service';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/decorators/user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RevokeRefreshTokenDto } from './dto/revoke-refresh-token.dto';
import { ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

@ApiTags('Auth')
@ApiBearerAuth('access-token') // ⭐⭐⭐ 关键就在这一行
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user);
  }

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const user = await this.userService.createUser(
      body.email,
      body.userName,
      body.password,
      body.isPublic,
    );

    // 注册成功后直接登录（可选，但很常见）
    return this.authService.login(user);
  }

  @Get('profile')
  async getProfile(@User('email') email: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, ...safeUser } = user;
    return safeUser;
  }

  @Post('revoke-access-token')
  revokeAccessToken(@Req() req: Request) {
    const token = this.getBearerToken(req);
    return this.authService.revokeAccessToken(token);
  }

  @Public()
  @ApiBody({ type: RevokeRefreshTokenDto })
  @Post('revoke-refresh-token')
  revokeRefreshToken(@Body() body: RevokeRefreshTokenDto) {
    return this.authService.revokeRefreshToken(body.refreshToken);
  }

  private getBearerToken(req: Request): string {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return authHeader.slice(7);
  }
}
