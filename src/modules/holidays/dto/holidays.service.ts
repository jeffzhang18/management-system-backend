import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class HolidaysService {

    getCurrentYear():number {
        return new Date().getFullYear();
    }

    private getFutureHolidayGroups(days: any[]) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
    
      // ① 过滤未来放假日
      const futureOffDays = days.filter(d => {
        if (!d.isOffDay) return false;
        const dDate = new Date(d.date);
        dDate.setHours(0, 0, 0, 0);
        return dDate > today;
      });
    
      // ② 按节日名分组
      const grouped = new Map<string, string[]>();
    
      for (const d of futureOffDays) {
        if (!grouped.has(d.name)) {
          grouped.set(d.name, []);
        }
        grouped.get(d.name)!.push(d.date);
      }
    
      // ③ 结构化
      return Array.from(grouped.entries()).map(
        ([name, dates]) => {
          const sortedDates = dates.sort();
          return {
            name,
            dates: sortedDates,
            days: sortedDates.length,
            startDate: sortedDates[0],
            endDate: sortedDates[sortedDates.length - 1],
          };
        }
      );
    }
    

    async getRemainingHoliday() {
      try {
        const year = this.getCurrentYear();
        const url = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`;
        const { data } = await axios.get(url);
    
        const holidays = this.getFutureHolidayGroups(data.days);
    
        return {
          remainHolidays: holidays.reduce(
            (sum, h) => sum + h.days,
            0
          ),
          holidays: holidays.map(h => ({
            name: h.name,
            dates: h.dates,
            days: h.days,
          })),
        };
      } catch {
        throw new HttpException(
          'Failed to fetch holidays data',
          502,
        );
      }
    }
    
    async getLatestHoliday() {
      try {
        const year = this.getCurrentYear();
        const url = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`;
        const { data } = await axios.get(url);
    
        const holidays = this.getFutureHolidayGroups(data.days);
        if (holidays.length === 0) return null;
    
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        // ① 是否在某个假期中
        const ongoingHoliday = holidays.find(h => {
          const start = new Date(h.startDate);
          const end = new Date(h.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          return today >= start && today <= end;
        });
    
        if (ongoingHoliday) {
          const end = new Date(ongoingHoliday.endDate);
          end.setHours(0, 0, 0, 0);
    
          const daysLeft =
            Math.floor(
              (end.getTime() - today.getTime()) /
                (1000 * 60 * 60 * 24),
            );
    
          return {
            status: 'ongoing',
            name: ongoingHoliday.name,
            startDate: ongoingHoliday.startDate,
            endDate: ongoingHoliday.endDate,
            days: ongoingHoliday.days,
            daysLeft,
          };
        }
    
        // ② 下一个即将开始的假期
        holidays.sort(
          (a, b) =>
            new Date(a.startDate).getTime() -
            new Date(b.startDate).getTime(),
        );
    
        const nextHoliday = holidays[0];
        const start = new Date(nextHoliday.startDate);
        start.setHours(0, 0, 0, 0);
    
        const daysLeft = Math.ceil(
          (start.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24),
        );
    
        return {
          status: 'upcoming',
          name: nextHoliday.name,
          startDate: nextHoliday.startDate,
          endDate: nextHoliday.endDate,
          days: nextHoliday.days,
          daysLeft,
        };
      } catch (error) {
        throw new HttpException('Failed to fetch latest holiday', 502);
      }
    }
}