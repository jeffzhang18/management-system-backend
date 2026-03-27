import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { DaysPredictionQueryDto } from './dto/days-prediction-query.dto';
import { HoursPredictionQueryDto } from './dto/hours-prediction-query.dto';
import { NowQueryDto } from './dto/now-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../common/decorators/user.decorator';
import { SaveLocationDto } from './dto/save-location.dto';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @ApiBearerAuth('access-token')
  @ApiBody({ type: SaveLocationDto })
  @Post('saved-location')
  saveLocation(@User('email') email: string, @Body() body: SaveLocationDto) {
    return this.weatherService.saveUserLocation(email, body.locationId);
  }

  @ApiQuery({
    name: 'userId',
    required: true,
    description: '用户唯一ID(user_info.user_id)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Get('saved-location')
  getSavedLocations(@Query('userId') userId: string) {
    return this.weatherService.getSavedLocationsByUserId(userId);
  }

  @ApiQuery({
    name: 'userId',
    required: true,
    description: '用户唯一ID(user_info.user_id)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'locationId',
    required: true,
    description: '需要取消保存的地区 LocationID',
    example: '101190202',
  })
  @Delete('saved-location')
  removeSavedLocation(
    @Query('userId') userId: string,
    @Query('locationId') locationId: string,
  ) {
    return this.weatherService.removeSavedLocation(userId, locationId);
  }

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
