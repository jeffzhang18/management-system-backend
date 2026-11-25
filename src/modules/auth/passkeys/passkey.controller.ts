import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { User } from '../../../common/decorators/user.decorator';
import { PasskeyService } from './passkey.service';
import { resolveLocale } from '../../../common/i18n/locale';
import {
  PasskeyOptionsDto,
  VerifyPasskeyLoginDto,
  VerifyPasskeyRegistrationDto,
} from './passkey.dto';

@ApiTags('Passkeys')
@ApiBearerAuth('access-token')
@Controller('auth/passkeys')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class PasskeyController {
  constructor(private readonly passkeys: PasskeyService) {}

  @Public()
  @Get('config')
  config() {
    return this.passkeys.config();
  }

  @Public()
  @Post('login/options')
  authenticationOptions(@Req() req: Request, @Body() body: PasskeyOptionsDto) {
    return this.passkeys.authenticationOptions(
      req.ip || req.socket.remoteAddress || 'unknown',
      body,
    );
  }

  @Public()
  @Post('login/verify')
  verifyAuthentication(@Body() body: VerifyPasskeyLoginDto) {
    return this.passkeys.verifyAuthentication(body);
  }

  @Get()
  list(@User('userId') userId: number) {
    return this.passkeys.list(Number(userId));
  }

  @Post('register/code')
  sendCode(
    @User('userId') userId: number,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.passkeys.sendRegistrationCode(
      Number(userId),
      resolveLocale(acceptLanguage),
    );
  }

  @Post('register/options')
  registrationOptions(
    @User('userId') userId: number,
    @Body() body: PasskeyOptionsDto,
  ) {
    return this.passkeys.registrationOptions(Number(userId), body);
  }

  @Post('register/verify')
  verifyRegistration(
    @User('userId') userId: number,
    @Body() body: VerifyPasskeyRegistrationDto,
  ) {
    return this.passkeys.verifyRegistration(Number(userId), body);
  }

  @Delete(':id')
  remove(
    @User('userId') userId: number,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.passkeys.remove(Number(userId), id);
  }
}
