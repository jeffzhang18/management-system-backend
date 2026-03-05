import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HolidaysService } from '../holidays/holidays.service';
import { WeatherService } from '../weather/weather.service';
import axios from 'axios';

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

  // @Cron(CronExpression.EVERY_10_SECONDS, {
  //   timeZone: 'Asia/Shanghai',
  // })
  async handleDailyReminder() {
    // console.log('[Cron] daily reminder');

    // 1) 日期提醒（假期/周末/发薪日）周末和假期不提示
    const holidayData = await this.holidaysService.getAllHolidays();
    if (holidayData.holidayDaysLeft == null || holidayData.weekendDaysLeft == null) {
        return;
    }

    // 2) 强制用东八区
    const now = new Date(
      new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    );
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

    // 3) 天气（多个城市）
    let weatherText = '';

    try {
      const cities = ['江阴', '上海'];

      const weatherResults = await Promise.all(
        cities.map(async (city) => {
          const loc = await this.weatherService.getLocation(city);
          const locationId = loc?.location?.[0]?.id;
          if (!locationId) return null;

          const forecast = await this.weatherService.getDaysPrediction(locationId, '3d');
          const today = forecast?.daily?.[0];

          return {
            city: loc?.location?.[0]?.name ?? city,
            weather: today?.textDay,
            tempMin: today?.tempMin,
            tempMax: today?.tempMax,
          };
        }),
      );

      const lines = weatherResults
        .filter((w): w is NonNullable<typeof w> => Boolean(w))
        .map((w) => {
          const icon = this.iconByWeather(w.weather);
          return `- ${w.city}：${w.weather ?? '-'}${icon} ${" "}${w.tempMin ?? '-'}~${w.tempMax ?? '-'}°C`;        });

      weatherText = lines.length ? lines.join('\n') : '- 🌤️ 暂无';
    } catch (e) {
      weatherText = '- 🌤️ 获取失败';
    }

    // 4) 按你想要的格式拼接文本
    const dateLine = `${now.getMonth() + 1}月${now.getDate()}日 星期${weekday}`;

    const text =
      `${dateLine}\n\n` +
      `今日天气\n` +
      `${weatherText}\n\n` +
      `日期提醒 \n` +
      `- 距离发薪日：${holidayData?.paydayDaysLeft ?? '-'} 天\n` +
      `- 距离${holidayData?.holidayDaysName ?? '下个假期'}：${holidayData?.holidayDaysLeft ?? '-'} 天\n` +
      `- 距离星期六：${holidayData?.weekendDaysLeft ?? '-'} 天`;

    console.log(text);
    

    // const webhookUrl = process.env.WECHAT_WEBHOOK;
    //   if (!webhookUrl) {
    //     console.warn('[Cron] WECHAT_WEBHOOK is empty, skip wechat push');
    //     return;
    //   }
  
    //   await axios.post(
    //     webhookUrl,
    //     {
    //       msgtype: 'text',
    //       text: { content: text },
    //     },
    //     { headers: { 'Content-Type': 'application/json' } },
    //   );
  
    //   console.log('[Cron] WeChat push success');
    return text;
  }
}