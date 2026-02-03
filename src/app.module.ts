import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WeatherModule } from './modules/weather/weather.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HolidaysModule } from './modules/holidays/dto/holidays.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WeatherModule,
    HolidaysModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
