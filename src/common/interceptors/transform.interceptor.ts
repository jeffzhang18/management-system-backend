import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { ApiResponse } from '../interfaces/response.interface';
  
  @Injectable()
  export class TransformInterceptor<T>
    implements NestInterceptor<T, ApiResponse<T>>
  {
    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<ApiResponse<T>> {
      const ctx = context.switchToHttp();
      const request = ctx.getRequest();
  
      return next.handle().pipe(
        map((data) => ({
          code: 0,
          message: 'success',
          data,
          timestamp: Date.now(),
          path: request.url,
        })),
      );
    }
  }
  