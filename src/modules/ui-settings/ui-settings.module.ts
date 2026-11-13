import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UiSettingsController } from './ui-settings.controller';
import { UserUiSettings } from './ui-settings.entity';
import { UiSettingsService } from './ui-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserUiSettings])],
  controllers: [UiSettingsController],
  providers: [UiSettingsService],
})
export class UiSettingsModule {}
