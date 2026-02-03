import { Controller, Get, Put, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
// import { DaysPredictionQueryDto } from './dto/days-prediction-query.dto';
// import {HoursPredictionQueryDto} from './dto/hours-prediction-query.dto'

@Controller('holidays')
export class HolidaysController {
    constructor(private readonly holidaysService: HolidaysService){}

    // 本年度剩余public holiday天数
    @Get('remaining-holiday')
    getRemainingHoliday() {
        return this.holidaysService.getRemainingHoliday()
    }

    // 距离最近public holiday距离
    @Get('latest-holiday')
    getLatestHoliday() {
        return this.holidaysService.getLatestHoliday()
    }

    // 距离周末天数
    @Get('latest-weekend')
    getLastestWeekend() {
        return this.holidaysService.getLatestWeekend()
    }

    // 距离发薪日天数
    @Get('latest-payday')
    getLatestPayday(@Query('day') day:number) {
        return this.holidaysService.getLatestPayday(day);
    }

    
    // 调整发薪日
    // @Put("payday")

}