import { Controller, Get, Put, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { ApiQuery } from '@nestjs/swagger';
import {Public} from '../../../common/decorators/public.decorator'
// import { DaysPredictionQueryDto } from './dto/days-prediction-query.dto';
// import {HoursPredictionQueryDto} from './dto/hours-prediction-query.dto'


@Controller('holidays')
export class HolidaysController {
    constructor(private readonly holidaysService: HolidaysService){}

    // 本年度剩余public holiday天数
    @Public()
    @Get('remaining-holiday')
    getRemainingHoliday() {
        return this.holidaysService.getRemainingHoliday()
    }

    // 距离最近public holiday距离
    @Public()
    @Get('latest-holiday')
    getLatestHoliday() {
        return this.holidaysService.getLatestHoliday()
    }

    // 距离周末天数
    @Public()
    @Get('latest-weekend')
    getLastestWeekend() {
        return this.holidaysService.getLatestWeekend()
    }

    // 距离发薪日天数
    @Public()
    @ApiQuery({
        name:"day",
        required:false,
        type:'Number',
        description:'指定发薪日（当前月几号），不传默认本月最后一个工作日',
    })
    @Get('latest-payday')
    getLatestPayday(@Query('day') day?:number) {
        return this.holidaysService.getLatestPayday(day);
    }

}