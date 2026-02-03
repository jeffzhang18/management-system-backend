import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class HolidaysService {

    getCurrentYear():number {
        return new Date().getFullYear();
    }

    async getRemainingHoliday() {
      try {
        const currentYear = this.getCurrentYear();
        const url = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${currentYear}.json`;
    
        const res = await axios.get(url);
        const data = res.data;
    
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        // ① 先筛选「今天及以后」的放假日
        const remainingHolidays = data.days
          .filter(d => {
            if (!d.isOffDay) return false;
            const dDate = new Date(d.date);
            dDate.setHours(0, 0, 0, 0);
            return dDate > today;
          })
          .map(d => ({
            name: d.name,
            date: d.date,
          }));
    
        // ② 按节日名聚合
        const grouped = new Map<
          string,
          { name: string; dates: string[] }
        >();
    
        for (const item of remainingHolidays) {
          if (!grouped.has(item.name)) {
            grouped.set(item.name, {
              name: item.name,
              dates: [],
            });
          }
          grouped.get(item.name)!.dates.push(item.date);
        }
    
        const holidays = Array.from(grouped.values()).map(h => ({
          name: h.name,
          dates: h.dates,
          days: h.dates.length,
        }));
    
        return {
          remainHolidays: remainingHolidays.length,
          holidays,
        };
      } catch (error) {
        throw new HttpException(
          'Failed to fetch holidays data',
          502,
        );
      }
    }
    
      
}