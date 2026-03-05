import { Module } from '@nestjs/common';
import { NotifierService } from './notifier.service';
import { HolidaysModule } from '../holidays/holidays.module';
import { WeatherModule } from '../weather/weather.module';
import { NotifierController } from '../notifier/notifier.controller'


@Module({
    imports: [HolidaysModule, WeatherModule], 
    controllers: [NotifierController],
    providers: [NotifierService],
    exports: [NotifierService],
})
export class NotifierModule {}