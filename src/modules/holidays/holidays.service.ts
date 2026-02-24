import { Injectable, HttpException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class HolidaysService {

    private getCurrentYear():number {
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
        return dDate >= today;
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

    private isWorkday(date: Date, holidaySet: Set<string>) {
      const day = date.getDay(); // 0=Sun, 6=Sat
      if (day === 0 || day === 6) return false;
    
      const dateStr = date.toISOString().slice(0, 10);
      return !holidaySet.has(dateStr);
    }
    
    private getLastWorkdayOfMonth(
      year: number,
      month: number,
      holidaySet: Set<string>,
    ) {
      // month: 0-11
      let date = new Date(year, month + 1, 0); // 本月最后一天
    
      while (!this.isWorkday(date, holidaySet)) {
        date.setDate(date.getDate() - 1);
      }
    
      return date;
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

    async getLatestWeekend() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
    
      const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
    
      let status: 'ongoing' | 'upcoming';
      let startDate: Date;
      let endDate: Date;
      let daysLeft: number;
    
      // ① 今天是周六或周日 → ongoing
      if (dayOfWeek === 6 || dayOfWeek === 0) {
        status = 'ongoing';
    
        // 本周六
        startDate = new Date(today);
        startDate.setDate(today.getDate() - ((dayOfWeek + 1) % 7));
    
        // 本周日
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
    
        // 剩余天数（含今天）
        daysLeft =
          Math.floor(
            (endDate.getTime() - today.getTime()) /
              (1000 * 60 * 60 * 24),
          );
      } else {
        // ② 工作日 → upcoming
        status = 'upcoming';
    
        // 距离下一个周六
        const daysUntilSaturday = 6 - dayOfWeek;
    
        startDate = new Date(today);
        startDate.setDate(today.getDate() + daysUntilSaturday);
    
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
    
        daysLeft = daysUntilSaturday;
      }
    
      const format = (d: Date) => d.toISOString().slice(0, 10);
    
      return {
        status,
        name: '周末',
        startDate: format(startDate),
        endDate: format(endDate),
        days: 2,
        daysLeft,
      };
    }

    async getLatestPayday(day?: number) {
      try {
        const year = this.getCurrentYear();
        const url = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`;
        const { data } = await axios.get(url);
    
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        // ① 构建 public holiday Set
        const holidaySet = new Set<string>(
          data.days
            .filter(d => d.isOffDay)
            .map(d => d.date),
        );
    
        let payday: Date;
    
        if (day == null) {
          // 本月最后一个工作日
          payday = this.getLastWorkdayOfMonth(
            today.getFullYear(),
            today.getMonth(),
            holidaySet,
          );
        } else {
          if (!Number.isInteger(day) || day < 1 || day > 31) {
            throw new BadRequestException("day must be an integer between 1 and 31")
          }
          const todayDate = today.getDate();
          let year = today.getFullYear();
          let month = today.getMonth();

          // 1) 如果 day <= 今天日期 → 从下个月开始找
          if (day < todayDate) {
            month += 1;
          }

          // 2) 如果 month 溢出，进位到下一年
          if (month > 11) {
            month = 0;
            year += 1;
          }

          // 3) 一直往后找，直到某个月“存在 day 号”
          //    例如 day=31：2月不行 → 3月可以 → 用 3/31
          while (true) {
            const lastDay = new Date(year, month + 1, 0).getDate();
            if (day <= lastDay) {
              payday = new Date(year, month, day);
              break;
            }

            // 下一个月
            month += 1;
            if (month > 11) {
              month = 0;
              year += 1;
            }
          }
        }
        
    
        payday.setHours(0, 0, 0, 0);
    
        // ③ 计算 daysLeft
        const diff =
          Math.ceil(
            (payday.getTime() - today.getTime()) /
              (1000 * 60 * 60 * 24),
          );
    
        const daysLeft = Math.max(diff, 0);
    
        const format = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        
        return {
          name: '发薪日',
          date: format(payday),
          daysLeft,
        };
      } catch (error) {
        throw new HttpException(
          'Failed to fetch payday info',
          502,
        );
      }
    }
    
    
}