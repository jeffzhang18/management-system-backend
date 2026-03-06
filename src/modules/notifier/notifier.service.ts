// src/modules/notifier/notifier.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HolidaysService } from '../holidays/holidays.service';
import { WeatherService } from '../weather/weather.service';
import axios from 'axios';
import { NORMAL_MESSAGES, FRIDAY_MESSAGES } from './assets/message';

@Injectable()
export class NotifierService {
  constructor(
    private readonly holidaysService: HolidaysService,
    private readonly weatherService: WeatherService,
  ) {}

  /** 按中文天气关键字匹配一个图标 */
  private iconByWeather(w?: string) {
    if (!w) return '🌤️';
    if (w.includes('雷')) return '⛈️';
    if (w.includes('雪')) return '❄️';
    if (w.includes('雨')) return '🌧️';
    if (w.includes('阴')) return '☁️';
    if (w.includes('云')) return '⛅';
    if (w.includes('晴')) return '☀️';
    if (w.includes('雾') || w.includes('霾') || w.includes('沙') || w.includes('尘')) return '🌫️';
    return '🌤️';
  }
  private pad(str: string | number | undefined, len: number) {
    const s = String(str ?? '-');
    return s.padEnd(len, ' ');
  }

  

  private async sendWechatMessage(content: string) {
    const webhookUrl = process.env.WECHAT_WEBHOOK;
  
    if (!webhookUrl) {
      console.warn('[Notifier] WECHAT_WEBHOOK is empty, skip wechat push');
      return;
    }
  
    try {
      await axios.post(
        webhookUrl,
        {
          msgtype: 'text',
          text: { content },
        },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 10_000
        },
        
      );
  
      console.log('[Notifier] WeChat push success');
    } catch (err) {
      console.error('[Notifier] WeChat push failed:', err?.message);
      console.error('[Notifier] status/data:', err?.response?.status, err?.response?.data);
    }
  }

  private pickDailyMessage(date: Date, list: string[]) {
    // 以 YYYY-MM-DD 作为种子，保证同一天固定选择
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const seedStr = `${y}-${m}-${d}`;
  
    // 简单 hash
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
  
    return list[hash % list.length];
  }

  @Cron('0 54 9 * * *', {
    timeZone: 'Asia/Shanghai',
  })
  async handleDailyReminder() {

    // 1) 日期提醒（假期/周末/发薪日）周末和假期不提示
    const isOffDay = await this.holidaysService.isTodayOffDay();
    if (isOffDay) {
      console.log('[Notifier] today is off day, skip reminder');
      return;
    }
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const holidayData = await this.holidaysService.getAllHolidays();

    // 2) 强制用东八区
    const now = new Date(
      new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    );
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

    // 3) 天气（多个城市）
    let weatherText = '';
    console.log('[Cron] start', runId, process.pid);

    try {
      const CITY_WIDTH = 4;     // 城市
      const WEATHER_WIDTH = 4;  // 天气
      const TEMP_WIDTH = 8;     // 温度
      const cities = [
        { name: '江阴', id: '101190202' },
        { name: '上海', id: '101020100' },
      ];

      const weatherResults = await Promise.all(
        cities.map(async (city) => {
          const forecast = await this.weatherService.getDaysPrediction(city.id, '3d');
      
          const today = forecast?.daily?.[0];
          const tomorrow = forecast?.daily?.[1];
      
          return {
            city: city.name,
            weather: today?.textDay,
            tempMin: today?.tempMin,
            tempMax: today?.tempMax,
            weatherTomorrow: tomorrow?.textDay,
            tempMinTomorrow: tomorrow?.tempMin,
            tempMaxTomorrow: tomorrow?.tempMax,
          };
        }),
      );

      const lines = weatherResults
      .filter((w): w is NonNullable<typeof w> => Boolean(w))
      .map((w) => {
        const iconToday = this.iconByWeather(w.weather);
        const iconTomorrow = this.iconByWeather(w.weatherTomorrow);

        const todayTemp = `${w.tempMin ?? '-'}~${w.tempMax ?? '-'}°C`;
        const tomorrowTemp = `${w.tempMinTomorrow ?? '-'}~${w.tempMaxTomorrow ?? '-'}°C`;

        const todayRow =
          `${this.pad(w.city, CITY_WIDTH)} ` +
          `${this.pad('今日', 3)} ` +
          `${this.pad(w.weather, WEATHER_WIDTH)} ` +
          `${iconToday} ` +
          `${this.pad(todayTemp, TEMP_WIDTH)}`;

        const tomorrowRow =
          `${this.pad('', CITY_WIDTH)} ` +
          `${this.pad('明日', 3)} ` +
          `${this.pad(w.weatherTomorrow, WEATHER_WIDTH)} ` +
          `${iconTomorrow} ` +
          `${this.pad(tomorrowTemp, TEMP_WIDTH)}`;

        return `${todayRow}\n${tomorrowRow}`;
      });
      weatherText = lines.length ? lines.join('\n') : '- 🌤️ 暂无';
    } catch (err: any) {
      console.error('[Weather] axios failed', {
        message: err?.message,
        code: err?.code,                // ETIMEDOUT / ECONNRESET / ENOTFOUND
        status: err?.response?.status,  // 429 / 5xx
        data: err?.response?.data,
        url: err?.config?.url,
      });
      weatherText = '- 🌤️ 获取失败';
    }

    // 4) 按你想要的格式拼接文本
    const dateLine = `${now.getMonth() + 1}月${now.getDate()}日 星期${weekday}`;

    const paydayText =
      holidayData?.paydayDaysLeft === 0
        ? '- 发薪日就是今天！🎉'
        : `- 距离发薪日：${holidayData?.paydayDaysLeft ?? '-'} 天`;

    const text =
      `${dateLine}\n\n` +
      `天气提醒\n` +
      `${weatherText}\n\n` +
      `日期提醒 \n` +
      `${paydayText}\n` +
      `- 距离${holidayData?.holidayDaysName ?? '下个假期'}：${holidayData?.holidayDaysLeft ?? '-'} 天\n` +
      `- 距离星期六：${holidayData?.weekendDaysLeft ?? '-'} 天`;

    // await this.sendWechatMessage(text)
  
    console.log(now)
    console.log(text);
    return text;
  }

  @Cron(CronExpression.EVERY_DAY_AT_5PM, {
    timeZone: 'Asia/Shanghai',
  })
  async handleDailyGetOffReminder() {
    // 1) 日期提醒（假期/周末/发薪日）周末和假期不提示
    const isOffDay = await this.holidaysService.isTodayOffDay();

    if (isOffDay) {
      console.log('[Notifier] today is off day, skip reminder');
      return;
    }

    try {
      const now = new Date(
        new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      );
  
      const isFriday = now.getDay() === 5; // 0日 1一 ... 5五 6六
      const pool = isFriday ? FRIDAY_MESSAGES : NORMAL_MESSAGES;

      const content = this.pickDailyMessage(now, pool);
      console.log(content);
      
      await this.sendWechatMessage(content);
    } catch (e) {
      console.error('[Cron] GetOff reminder failed', e);
    }
  }



}