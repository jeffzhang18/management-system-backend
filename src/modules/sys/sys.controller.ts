import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { User } from '../../common/decorators/user.decorator';
import { CreateUserBrowsingHistoryDto } from './dto/create-user-browsing-history.dto';
import { SysService } from './sys.service';

@ApiTags('Sys')
@ApiBearerAuth('access-token')
@Controller('sys')
export class SysController {
  constructor(private readonly sysService: SysService) {}

  @ApiBody({ type: CreateUserBrowsingHistoryDto })
  @Post('user-browsing-history')
  createUserBrowsingHistory(
    @User('email') email: string,
    @Body() body: CreateUserBrowsingHistoryDto,
    @Req() request: Request,
  ) {
    return this.sysService.createUserBrowsingHistory(
      email,
      body,
      this.getRequestIp(request),
    );
  }

  private getRequestIp(request: Request): string | null {
    const xForwardedFor = request.headers['x-forwarded-for'];

    if (typeof xForwardedFor === 'string') {
      return xForwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      return xForwardedFor[0];
    }

    return request.ip ?? request.socket?.remoteAddress ?? null;
  }
}
