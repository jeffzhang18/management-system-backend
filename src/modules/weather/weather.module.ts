import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { UserWeatherLocation } from './entities/user-weather-location.entity';
import { UserWeatherLocationIndex } from './entities/user-weather-location-index.entity';
import { UserModule } from 'src/domain/user/user.model';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserWeatherLocation, UserWeatherLocationIndex]),
    UserModule,
  ],
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
