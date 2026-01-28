import { Controller, Get, Query } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { DaysPredictionQueryDto } from './dto/days-prediction-query.dto';


@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('now')
  getNow(@Query('location') location: string) {
    return this.weatherService.getNow(location);
  }

  @Get('location')
  getLocation(@Query('location') location: string) {
    return this.weatherService.getLocation(location);
  }

  // http://47.117.245.39:3000/api/weather/days-prediction?location=101020100&days=30d
  @Get('days-prediction')
  getDaysPrediction(
    @Query() query: DaysPredictionQueryDto,
  ) {
    return this.weatherService.getDaysPrediction(query.location,
      query.days)
  }
}
