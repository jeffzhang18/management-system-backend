import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../../domain/user/user.model';
import { UserBrowsingHistory } from '../sys/entities/user-browsing-history.entity';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBrowsingHistory]), UserModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
