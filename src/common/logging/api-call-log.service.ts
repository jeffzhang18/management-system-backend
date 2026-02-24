import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiCallLogEntity } from '../entities/api_call_log.entity';

@Injectable()
export class ApiCallLogService {
  constructor(
    @InjectRepository(ApiCallLogEntity)
    private readonly repo: Repository<ApiCallLogEntity>,
  ) {}

  async log(apiName: string, ip: string, status:boolean, userEmail?:string | null) {
    // 不要阻塞主请求也可以：这里先 await，后面我给你“异步写入”版本
    const row = this.repo.create({
      apiName,
      callFromIp: ip,
      status,
      userEmail: userEmail ?? null,
    });
    await this.repo.save(row);
  }
}