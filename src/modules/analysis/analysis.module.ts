import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBrowsingHistory } from '../sys/entities/user-browsing-history.entity';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBrowsingHistory])],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
