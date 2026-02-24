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
  
  @Injectable()
  export class ApiCallLogInterceptor implements NestInterceptor {
    constructor(private readonly logService: ApiCallLogService) {}
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      console.log('[ApiCallLogInterceptor] HIT');
      
      
      const http = context.switchToHttp();
      const req = http.getRequest<Request & any>();
      console.log('req.user =', req.user);
  
      // api_name：建议记录 method + path
      const apiName = `${req.method} ${req.originalUrl || req.url}`;
  
      // ip：优先取 x-forwarded-for（如果你有 nginx 反代）
      const xff = req.headers['x-forwarded-for'];
      const ip =
        (Array.isArray(xff) ? xff[0] : (xff as string))?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket?.remoteAddress ||
        'unknown';
  
      const start = Date.now();

      const userEmail = 
        req.user?.email ||
        req.user?.user?.email ||
        req.body?.email ||
        null;

  
      return next.handle().pipe(
        tap({
          next: () => {
            // 这里用“异步写入”，不阻塞响应
            this.logService.log(apiName, ip, true, userEmail).catch((e) => {
              console.error('[ApiCallLogInterceptor] save failed:', e);
            });
          },
          error: () => {
            // 失败也记录（你也可以加 statusCode 字段）
            this.logService.log(apiName, ip, false, userEmail).catch((e) => {
              console.error('[ApiCallLogInterceptor] save failed:', e);
            });
          },
        }),
      );
    }
  }