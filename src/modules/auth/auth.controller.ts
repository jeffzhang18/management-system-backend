import {
  Controller,
  Post,
  Body,
  Get,
  Headers,
  Req,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../../domain/user/user.service';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/decorators/user.decorator';
import { LoginWithEmailCodeDto } from './dto/login-with-email-code.dto';
import { SendLoginCodeDto } from './dto/send-login-code.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendResetPasswordCodeDto } from './dto/send-reset-password-code.dto';
import { RegisterDto } from './dto/register.dto';
import { SendRegisterCodeDto } from './dto/send-register-code.dto';
import { EmailVerificationService } from './email-verification.service';
import { resolveLocale } from '../../common/i18n/locale';
import { RevokeRefreshTokenDto } from './dto/revoke-refresh-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';

@ApiTags('Auth')
@ApiBearerAuth('access-token') // ⭐⭐⭐ 关键就在这一行
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private emailVerificationService: EmailVerificationService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user);
  }

  @Public()
  @Post('login/email/code')
  sendLoginCode(
    @Body(new ValidationPipe({ whitelist: true })) body: SendLoginCodeDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.emailVerificationService.sendLoginCode(
      body.email,
      resolveLocale(acceptLanguage),
    );
  }

  @Public()
  @Post('login/email')
  loginWithEmailCode(
    @Body(new ValidationPipe({ whitelist: true })) body: LoginWithEmailCodeDto,
  ) {
    return this.authService.loginWithEmailCode(body);
  }

  @Public()
  @Post('register/code')
  sendRegisterCode(
    @Body() body: SendRegisterCodeDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.emailVerificationService.sendRegisterCode(
      body.email,
      resolveLocale(acceptLanguage),
    );
  }

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto) {
    await this.emailVerificationService.consume(body.email, body.code);
    const user = await this.userService.createUser(
      body.email,
      body.userName,
      body.password,
      body.isPublic,
    );

    // 注册成功后直接登录（可选，但很常见）
    return this.authService.login(user);
  }

  @Public()
  @Post('reset-password/code')
  sendResetPasswordCode(
    @Body(new ValidationPipe({ whitelist: true }))
    body: SendResetPasswordCodeDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.emailVerificationService.sendResetPasswordCode(
      body.email,
      resolveLocale(acceptLanguage),
    );
  }

  @Public()
  @Post('reset-password')
  resetPassword(
    @Body(new ValidationPipe({ whitelist: true })) body: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(body);
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
  @ApiBody({ type: RefreshTokenDto })
  @Post('refresh-token')
  refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
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
