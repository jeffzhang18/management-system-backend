import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && (res as any).message) {
        // Nest 的 message 可能是 string 或 string[]
        const m = (res as any).message;
        message = Array.isArray(m) ? m.join('; ') : m;
      } else {
        message = exception.message;
      }
    } else {
      // 非 HttpException 的真实 message
      message = (exception as any)?.message ?? message;
    }

    // ✅ 关键：这里把错误 + stack 打出来
    const stack = (exception as any)?.stack;
    this.logger.error(
      `${request.method} ${request.originalUrl} -> ${status} ${message}`,
      stack,
    );

    response.status(status).json({
      code: status,
      message: status === 500 ? 'Internal server error' : message,
      data: null,
      timestamp: Date.now(),
      path: request.originalUrl,
    });
  }
}