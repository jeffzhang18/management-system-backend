import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from 'src/domain/user/user.model';
import { UserBrowsingHistory } from './entities/user-browsing-history.entity';
import { SysController } from './sys.controller';
import { SysService } from './sys.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBrowsingHistory]), UserModule],
  controllers: [SysController],
  providers: [SysService],
  exports: [SysService],
})
export class SysModule {}
