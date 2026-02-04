import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/decorators/user.decorator';
import { LoginDto } from './dto/login.dto';
import { ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';


@ApiTags('Auth')
@ApiBearerAuth('access-token') // ⭐⭐⭐ 关键就在这一行
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
  const user = await this.authService.validateUser(
    body.email,
    body.password,
  );
    return this.authService.login(user);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@User() user) {
    return user;
  }
}
