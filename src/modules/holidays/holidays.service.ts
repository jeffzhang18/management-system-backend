import { Injectable, HttpException, BadRequestException } from '@nestjs/common';
import axios from 'axios';

type HolidayCnDay = {
  name: string;
  date: string; // YYYY-MM-DD
  isOffDay: boolean;
};

type HolidayCnYear = {
  year: number;
  days: HolidayCnDay[];
};

@Injectable()
export class HolidaysService {
  private getCurrentYear(): number {
    return new Date().getFullYear();
  }

  /** 本地时区：Date -> YYYY-MM-DD（避免 toISOString 时区偏移） */
  private toYmdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  /** 本地时区：YYYY-MM-DD -> Date(00:00:00)（避免 new Date('YYYY-MM-DD') 的 UTC 解析） */
  private parseYmdLocal(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  private addDays(date: Date, n: number): Date {
    const x = new Date(date);
    x.setDate(x.getDate() + n);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /** 抓 holiday-cn 当年的 json */
  private async fetchHolidayYear(year: number): Promise<HolidayCnYear> {
    const url = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return data as HolidayCnYear;
  }

  /**
   * 构建覆盖表：date -> isOffDay（调休覆盖自然周末/工作日）
   * 注意：holiday-cn 的 days 只覆盖“特殊日”，未覆盖的按自然周末/工作日推断
   */
  private buildDayMap(days: HolidayCnDay[]): Map<string, HolidayCnDay> {
    const map = new Map<string, HolidayCnDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }

  /**
   * 判定某天是否休息：
   * 1) 若 holiday-cn 有覆盖：用 isOffDay
   * 2) 若无覆盖：周六/周日休息
   */
  private isOffDay(date: Date, dayMap: Map<string, HolidayCnDay>): boolean {
    const key = this.toYmdLocal(date);
    const override = dayMap.get(key);
    if (override) return override.isOffDay;
    const dow = date.getDay(); // 0 Sun ... 6 Sat
    return dow === 0 || dow === 6;
  }

  /** 工作日 = 非休息日（用 isOffDay 的反） */
  private isWorkday(date: Date, dayMap: Map<string, HolidayCnDay>): boolean {
    return !this.isOffDay(date, dayMap);
  }

  /** 找某月最后一个工作日（调休生效） */
  private getLastWorkdayOfMonth(year: number, month0: number, dayMap: Map<string, HolidayCnDay>): Date {
    // month0: 0-11
    let d = new Date(year, month0 + 1, 0, 0, 0, 0, 0); // 本月最后一天（本地）
    while (!this.isWorkday(d, dayMap)) {
      d = this.addDays(d, -1);
    }
    return d;
  }

  /**
   * 将未来(含今天)的放假日 isOffDay=true 按“连续日期”切段
   * 段名取段内出现次数最多的 name
   */
  private getFutureOffSegments(days: HolidayCnDay[], todayStr: string) {
    const offDays = days
      .filter(d => d.isOffDay && d.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (offDays.length === 0) return [];

    const addOneDayStr = (ymd: string) => {
      const dt = this.parseYmdLocal(ymd);
      dt.setDate(dt.getDate() + 1);
      return this.toYmdLocal(dt);
    };

    const segments: Array<{
      name: string;
      dates: string[];
      days: number;
      startDate: string;
      endDate: string;
    }> = [];

    let curStart = offDays[0].date;
    let curEnd = offDays[0].date;
    let curDates = [offDays[0].date];
    let nameCount = new Map<string, number>();
    nameCount.set(offDays[0].name, 1);

    for (let i = 1; i < offDays.length; i++) {
      const d = offDays[i];
      const expectedNext = addOneDayStr(curEnd);

      if (d.date === expectedNext) {
        curEnd = d.date;
        curDates.push(d.date);
        nameCount.set(d.name, (nameCount.get(d.name) ?? 0) + 1);
      } else {
        const name = [...nameCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
        segments.push({
          name,
          dates: curDates,
          days: curDates.length,
          startDate: curStart,
          endDate: curEnd,
        });

        curStart = d.date;
        curEnd = d.date;
        curDates = [d.date];
        nameCount = new Map<string, number>();
        nameCount.set(d.name, 1);
      }
    }

    const lastName = [...nameCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
    segments.push({
      name: lastName,
      dates: curDates,
      days: curDates.length,
      startDate: curStart,
      endDate: curEnd,
    });

    return segments;
  }

  // ========================= API METHODS =========================

  async getRemainingHoliday() {
    try {
      const year = this.getCurrentYear();
      const { days } = await this.fetchHolidayYear(year);

      const todayStr = this.toYmdLocal(new Date());
      const segments = this.getFutureOffSegments(days, todayStr);

      return {
        remainHolidays: segments.reduce((sum, s) => sum + s.days, 0),
        holidays: segments.map(s => ({
          name: s.name,
          dates: s.dates,
          days: s.days,
        })),
      };
    } catch (e) {
      throw new HttpException('Failed to fetch holidays data', 502);
    }
  }

  async getLatestHoliday() {
    try {
      const year = this.getCurrentYear();
      const { days } = await this.fetchHolidayYear(year);

      const todayStr = this.toYmdLocal(new Date());
      const today = this.parseYmdLocal(todayStr);

      const segments = this.getFutureOffSegments(days, todayStr);
      if (segments.length === 0) return null;

      // ongoing：今天是否落在某段里（用字符串比较即可）
      const ongoing = segments.find(s => todayStr >= s.startDate && todayStr <= s.endDate);
      if (ongoing) {
        const end = this.parseYmdLocal(ongoing.endDate);
        const daysLeft = Math.floor((end.getTime() - today.getTime()) / 86400000);

        return {
          status: 'ongoing',
          name: ongoing.name,
          startDate: ongoing.startDate,
          endDate: ongoing.endDate,
          days: ongoing.days,
          daysLeft,
        };
      }

      // upcoming：segments 已按日期顺序
      const next = segments[0];
      const start = this.parseYmdLocal(next.startDate);
      const daysLeft = Math.ceil((start.getTime() - today.getTime()) / 86400000);

      return {
        status: 'upcoming',
        name: next.name,
        startDate: next.startDate,
        endDate: next.endDate,
        days: next.days,
        daysLeft,
      };
    } catch (e) {
      throw new HttpException('Failed to fetch latest holiday', 502);
    }
  }

  /**
   * 最近周末（考虑调休）：
   * - “可休周末日”= 周六/周日 && isOffDay=true（调休上班会排除）
   * - 找从今天起最近的一个可休周末日，并合并连续的可休周末日（最多 2 天）
   */
  async getLatestWeekend() {
    try {
      const year = this.getCurrentYear();
      const { days } = await this.fetchHolidayYear(year);
      const dayMap = this.buildDayMap(days);

      const todayStr = this.toYmdLocal(new Date());
      const today = this.parseYmdLocal(todayStr);

      const isWeekendOff = (d: Date) => {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) return false;
        return this.isOffDay(d, dayMap);
      };

      // 找最近可休周末日
      const maxLookahead = 120;
      let startDate: Date | null = null;

      for (let i = 0; i <= maxLookahead; i++) {
        const d = this.addDays(today, i);
        if (isWeekendOff(d)) {
          startDate = d;
          break;
        }
      }

      if (!startDate) {
        throw new HttpException('No weekend off-day found', 500);
      }

      // 合并连续的可休周末日（最多 Sat+Sun 或仅单天）
      let endDate = new Date(startDate);
      for (let i = 1; i <= 2; i++) {
        const d = this.addDays(startDate, i);
        if (isWeekendOff(d)) endDate = d;
        else break;
      }

      const status: 'ongoing' | 'upcoming' = isWeekendOff(today) ? 'ongoing' : 'upcoming';

      const daysCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

      const daysLeft =
        status === 'ongoing'
          ? Math.max(Math.floor((endDate.getTime() - today.getTime()) / 86400000), 0)
          : Math.max(Math.floor((startDate.getTime() - today.getTime()) / 86400000), 0);

      return {
        status,
        name: '周末',
        startDate: this.toYmdLocal(startDate),
        endDate: this.toYmdLocal(endDate),
        days: daysCount,
        daysLeft,
      };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException('Failed to fetch weekend info', 502);
    }
  }

  /**
   * 发薪日：
   * - day 不传：本月最后一个工作日（调休生效）
   * - day 传入：找“下一个存在该日号的月份”的该日（例如 31 号跳过 2 月），返回距离天数
   *   注意：这里只按“日号”计算，不额外调整到工作日（你如果希望也顺延到工作日，我也可以给你改）
   */
  async getLatestPayday(day?: number) {
    try {
      const year = this.getCurrentYear();
      const { days } = await this.fetchHolidayYear(year);
      const dayMap = this.buildDayMap(days);

      const todayStr = this.toYmdLocal(new Date());
      const today = this.parseYmdLocal(todayStr);

      let payday: Date;

      if (day == null) {
        payday = this.getLastWorkdayOfMonth(today.getFullYear(), today.getMonth(), dayMap);
      } else {
        if (!Number.isInteger(day) || day < 1 || day > 31) {
          throw new BadRequestException('day must be an integer between 1 and 31');
        }

        const todayDate = today.getDate();
        let y = today.getFullYear();
        let m = today.getMonth();

        if (day < todayDate) m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }

        // 防御：最多找 24 个月，避免死循环
        let found: Date | null = null;
        for (let i = 0; i < 24; i++) {
          const lastDay = new Date(y, m + 1, 0).getDate();
          if (day <= lastDay) {
            found = new Date(y, m, day, 0, 0, 0, 0);
            break;
          }
          m += 1;
          if (m > 11) {
            m = 0;
            y += 1;
          }
        }
        if (!found) throw new BadRequestException(`Invalid day: ${day}`);
        payday = found;
      }

      payday.setHours(0, 0, 0, 0);

      const diff = Math.ceil((payday.getTime() - today.getTime()) / 86400000);
      const daysLeft = Math.max(diff, 0);

      return {
        name: '发薪日',
        date: this.toYmdLocal(payday),
        daysLeft,
      };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException('Failed to fetch payday info', 502);
    }
  }
}
