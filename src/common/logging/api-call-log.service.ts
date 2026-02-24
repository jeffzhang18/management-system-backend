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

  async log(apiName: string, ip: string) {
    const info = await this.repo.query(
      `select current_database() as db,
              inet_server_addr() as host,
              inet_server_port() as port,
              current_schema() as schema;`,
    );
    console.log('[ApiCallLogService] connected to:', info?.[0]);
    const who = await this.repo.query(`
      select
        inet_client_addr() as client_ip,
        inet_client_port() as client_port,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        current_database() as db,
        current_schema() as schema;
    `);
    console.log('[PG WHO]', who[0]);
    // 不要阻塞主请求也可以：这里先 await，后面我给你“异步写入”版本
    const row = this.repo.create({
      apiName,
      callFromIp: ip,
    });
    await this.repo.save(row);
  }
}