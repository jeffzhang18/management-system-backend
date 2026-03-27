import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { DaysPredictionQueryDto } from './dto/days-prediction-query.dto';
import { HoursPredictionQueryDto } from './dto/hours-prediction-query.dto';
import { NowQueryDto } from './dto/now-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Public()
  @ApiQuery({
    name: 'location',
    required: true,
    description: '地区ID或经纬度坐标',
    example: '101190202',
  })
  @ApiQuery({
    name: 'lang',
    required: true,
    description: '多语言标识',
    example: 'zh-hans',
  })
  @ApiQuery({
    name: 'unit',
    required: false,
    description: '数据单位(m 或 i)',
    example: 'm',
  })
  @Get('now')
  getNow(@Query() query: NowQueryDto) {
    return this.weatherService.getNow(query.location, query.lang, query.unit);
  }

  @Public()
  @Get('location')
  getLocation(@Query('location') location: string) {
    return this.weatherService.getLocation(location);
  }

  // http://47.117.245.39:3000/api/weather/days-prediction?location=101020100&days=30d
  @Public()
  @Get('days-prediction')
  getDaysPrediction(@Query() query: DaysPredictionQueryDto) {
    return this.weatherService.getDaysPrediction(query.location, query.days);
  }

  @Public()
  @Get('hours-prediction')
  getHoursPrediction(@Query() query: HoursPredictionQueryDto) {
    return this.weatherService.getHoursPrediction(query.location, query.hours);
  }
}
