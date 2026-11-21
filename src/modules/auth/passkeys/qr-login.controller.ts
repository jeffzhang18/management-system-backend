import {
  Body,
  Controller,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { ApproveQrLoginDto, QrSessionTokenDto } from './qr-login.dto';
import { QrLoginService } from './qr-login.service';

@ApiTags('QR login')
@Controller('auth/qr-login')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class QrLoginController {
  constructor(private readonly qr: QrLoginService) {}
  private ip(req: Request) {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  @Public() @Post('sessions') create(@Req() req: Request) {
    return this.qr.create(this.ip(req));
  }
  @Public() @Post('status') status(@Body() body: QrSessionTokenDto) {
    return this.qr.status(body);
  }
  @Public() @Post('info') info(@Body() body: QrSessionTokenDto) {
    return this.qr.status(body, 'scan');
  }
  @Public() @Post('options') options(
    @Body() body: QrSessionTokenDto,
    @Req() req: Request,
  ) {
    return this.qr.options(body, this.ip(req));
  }
  @Public() @Post('approve') approve(@Body() body: ApproveQrLoginDto) {
    return this.qr.approve(body);
  }
  @Public() @Post('exchange') exchange(@Body() body: QrSessionTokenDto) {
    return this.qr.exchange(body);
  }
  @Public() @Post('cancel') cancel(@Body() body: QrSessionTokenDto) {
    return this.qr.cancel(body, 'desktop');
  }
  @Public() @Post('reject') reject(@Body() body: QrSessionTokenDto) {
    return this.qr.cancel(body, 'scan');
  }
}
