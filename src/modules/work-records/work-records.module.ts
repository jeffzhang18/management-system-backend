import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkRecord } from './entities/work-record.entity';
import { WorkRecordTheme } from './entities/work-record-theme.entity';
import { WorkRecordsController } from './work-records.controller';
import { WorkRecordsService } from './work-records.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkRecord, WorkRecordTheme]), AiModule],
  controllers: [WorkRecordsController],
  providers: [WorkRecordsService],
  exports: [WorkRecordsService],
})
export class WorkRecordsModule {}
