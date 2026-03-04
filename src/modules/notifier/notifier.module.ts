import { Module } from '@nestjs/common';
import { NotifierService } from './notifier.service';
import { HolidaysModule } from '../holidays/holidays.module';
import { WeatherModule } from '../weather/weather.module';


@Module({
    imports: [HolidaysModule, WeatherModule], 
    providers: [NotifierService],
    exports: [NotifierService],
})
export class NotifierModule {}