import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { SysService } from 'src/modules/sys/sys.service';

@Injectable()
export class UserBrowsingHistoryInterceptor implements NestInterceptor {
  constructor(private readonly sysService: SysService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & any>();

    const requestPath = req.originalUrl || req.url || '';

    if (
      this.isExcludedPath(requestPath) ||
      req.method?.toUpperCase() === 'OPTIONS'
    ) {
      return next.handle();
    }

    const ip = this.getRequestIp(req);
    const userEmail =
      req.user?.email || req.user?.user?.email || req.body?.email || null;

    const device =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null;

    return next.handle().pipe(
      tap({
        next: () => {
          this.sysService
            .createUserBrowsingHistorySafely(
              userEmail,
              {
                pageUrl: requestPath,
                device: device ?? undefined,
              },
              ip,
            )
            .catch((error) => {
              console.error('[UserBrowsingHistoryInterceptor] save failed:', error);
            });
        },
      }),
    );
  }

  private isExcludedPath(path: string): boolean {
    return (
      path.startsWith('/docs') ||
      path.startsWith('/ping') ||
      path === '/' ||
      path.startsWith('/api/sys/user-browsing-history') ||
      path.startsWith('/sys/user-browsing-history')
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
