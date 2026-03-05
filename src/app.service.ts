import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    const now = new Date(
      new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    );
    return 'Hello World!' + now;
  }
}
