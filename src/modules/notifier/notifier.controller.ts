import { Controller, Get, ParseIntPipe, Put, Query } from '@nestjs/common';
import { NotifierService } from './notifier.service';
import { ApiQuery } from '@nestjs/swagger';
import {Public} from '../../common/decorators/public.decorator'

@Controller('notifier')
export class NotifierController {

    constructor(private readonly notifierService: NotifierService){}

    @Public()
    @Get('wechat')
    getRemainingHoliday() {
        return this.notifierService.handleDailyReminder()
    }

}