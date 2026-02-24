import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ApiCallLogService } from '../logging/api-call-log.service'; // 按你路径改

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly logService: ApiCallLogService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );
    if (isPublic) return true;
    return super.canActivate(context) as any;
  }

  // ✅ 关键：token 错误会走到这里
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const req = context.switchToHttp().getRequest<any>();

      const apiName = `${req.method} ${req.originalUrl || req.url}`;

      const xff = req.headers['x-forwarded-for'];
      const rawIp =
        (Array.isArray(xff) ? xff[0] : (xff as string))?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        'unknown';

      const ip =
        typeof rawIp === 'string' && rawIp.startsWith('::ffff:')
          ? rawIp.slice(7)
          : rawIp;

      // token 错误时通常拿不到 req.user，只能记 body.email（如果有）
      const userEmail = req.body?.email ?? null;

      // status=false 表示失败
      this.logService.log(apiName, String(ip),false, userEmail).catch((e) => {
        console.error('[JwtAuthGuard] log failed:', e);
      });
    }

    // 继续走 passport 默认逻辑（会抛 401）
    return super.handleRequest(err, user, info, context);
  }
}