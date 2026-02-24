import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiCallLogEntity } from '../entities/api_call_log.entity';
import { ApiCallLogService } from './api-call-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiCallLogEntity])],
  providers: [ApiCallLogService],
  exports: [ApiCallLogService],
})
export class ApiCallLogModule {}