import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class HolidaysService {
    async getRemainingHoliday() {
        try {
            const url = `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/2026.json`
            const res = await axios.get(
                url
            )
            return res
        } catch (error) {

        }
    }
}