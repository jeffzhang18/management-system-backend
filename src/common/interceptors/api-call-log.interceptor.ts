import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiCallLogService } from '../logging/api-call-log.service';
import { Request } from 'express';
import { UserService } from '../../domain/user/user.service';

@Injectable()
export class ApiCallLogInterceptor implements NestInterceptor {
  constructor(
    private readonly logService: ApiCallLogService,
    private readonly userService: UserService,
  ) {}

  private decodeJwtPayload(
    token: string,
  ): { sub?: number | string; type?: string; email?: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const json = Buffer.from(padded, 'base64').toString('utf8');

      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private getBearerToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return null;
    }
    return auth.slice(7);
  }

  private isRefreshTokenApi(req: Request): boolean {
    const path = req.originalUrl || req.url || '';
    return req.method === 'POST' && path.includes('/auth/refresh-token');
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & any>();

    const apiName = `${req.method} ${req.originalUrl || req.url}`;

    const xff = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(xff) ? xff[0] : (xff as string))?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    let userEmail =
      req.user?.email || req.user?.user?.email || req.body?.email || null;

    if (!userEmail) {
      const bearer = this.getBearerToken(req);
      if (bearer) {
        const bearerPayload = this.decodeJwtPayload(bearer);
        if (typeof bearerPayload?.email === 'string' && bearerPayload.email) {
          userEmail = bearerPayload.email;
        }
      }
    }

    if (this.isRefreshTokenApi(req) && !userEmail && req.body?.refreshToken) {
      const payload = this.decodeJwtPayload(req.body.refreshToken);

      if (payload?.type === 'refresh' && payload?.sub != null) {
        const userId = Number(payload.sub);
        if (Number.isInteger(userId)) {
          try {
            const user = await this.userService.findById(userId);
            userEmail = user?.email ?? null;
          } catch {
            // 查询用户失败时保持 null，避免影响主流程
          }
        }
      }
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.logService.log(apiName, ip, true, userEmail).catch((e) => {
            console.error('[ApiCallLogInterceptor] save failed:', e);
          });
        },
        error: () => {
          this.logService.log(apiName, ip, false, userEmail).catch((e) => {
            console.error('[ApiCallLogInterceptor] save failed:', e);
          });
        },
      }),
    );
  }
}
