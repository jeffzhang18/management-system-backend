import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from '../../domain/user/user.service';
import { UserBrowsingHistory } from '../sys/entities/user-browsing-history.entity';
import { PageViewAnalysisQueryDto } from './dto/page-view-analysis-query.dto';
import { PageViewTrendQueryDto } from './dto/page-view-trend-query.dto';

interface DateRange {
  startAt: Date;
  endAt: Date;
  displayStartAt: string;
  displayEndAt: string;
}

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(UserBrowsingHistory)
    private readonly userBrowsingHistoryRepository: Repository<UserBrowsingHistory>,
    private readonly userService: UserService,
  ) {}

  async getPageViews(email: string, query: PageViewTrendQueryDto) {
    const range = this.resolveDateRange(query);
    const browsingHistoryUserId = await this.getBrowsingHistoryUserId(email);

    const results = await this.userBrowsingHistoryRepository
      .createQueryBuilder('history')
      .select(
        "TO_CHAR((history.browsing_at AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM-DD')",
        'date',
      )
      .addSelect('COUNT(*)', 'pageViews')
      .addSelect(
        'COALESCE(SUM(history.active_duration_ms), 0)',
        'totalTimeOnPageMs',
      )
      .where('history.user_id = :userId', { userId: browsingHistoryUserId })
      .andWhere('history.browsing_at >= :startAt', { startAt: range.startAt })
      .andWhere('history.browsing_at < :endAt', { endAt: range.endAt })
      .groupBy("(history.browsing_at AT TIME ZONE 'Asia/Shanghai')::date")
      .orderBy(
        "(history.browsing_at AT TIME ZONE 'Asia/Shanghai')::date",
        'ASC',
      )
      .getRawMany<{
        date: string;
        pageViews: string;
        totalTimeOnPageMs: string;
      }>();

    const resultsByDate = new Map(
      results.map((result) => [result.date, result]),
    );
    const dates = this.getDatesInRange(query.startDate, query.endDate);
    let totalPageViews = 0;
    let totalTimeOnPageMs = 0;

    const daily = dates.map((date) => {
      const result = resultsByDate.get(date);
      const pageViews = Number(result?.pageViews ?? 0);
      const dayTotalTimeOnPageMs = Number(result?.totalTimeOnPageMs ?? 0);

      totalPageViews += pageViews;
      totalTimeOnPageMs += dayTotalTimeOnPageMs;

      return {
        date,
        pageViews,
        totalTimeOnPageMs: dayTotalTimeOnPageMs,
        averageTimeOnPageMs:
          pageViews === 0 ? 0 : Math.round(dayTotalTimeOnPageMs / pageViews),
      };
    });

    return {
      daily,
      summary: {
        totalPageViews,
        averageDailyPageViews: Number(
          (totalPageViews / dates.length).toFixed(2),
        ),
        totalTimeOnPageMs,
        averageTimeOnPageMs:
          totalPageViews === 0
            ? 0
            : Math.round(totalTimeOnPageMs / totalPageViews),
      },
      period: {
        startDate: query.startDate,
        endDate: query.endDate,
        timezone: 'Asia/Shanghai',
      },
    };
  }

  async getTotalPageViews(email: string, query: PageViewAnalysisQueryDto) {
    const range = this.resolveDateRange(query);
    const browsingHistoryUserId = await this.getBrowsingHistoryUserId(email);

    const result = await this.userBrowsingHistoryRepository
      .createQueryBuilder('history')
      .select('COUNT(*)', 'totalPageViews')
      .where('history.user_id = :userId', { userId: browsingHistoryUserId })
      .andWhere('history.browsing_at >= :startAt', { startAt: range.startAt })
      .andWhere('history.browsing_at < :endAt', { endAt: range.endAt })
      .getRawOne<{ totalPageViews: string }>();

    return {
      totalPageViews: Number(result?.totalPageViews ?? 0),
      ...this.toPeriodResponse(range),
    };
  }

  async getAverageTimeOnPage(email: string, query: PageViewAnalysisQueryDto) {
    const range = this.resolveDateRange(query);
    const browsingHistoryUserId = await this.getBrowsingHistoryUserId(email);

    const result = await this.userBrowsingHistoryRepository
      .createQueryBuilder('history')
      .select('COUNT(*)', 'pageViews')
      .addSelect('COALESCE(AVG(history.active_duration_ms), 0)', 'averageMs')
      .where('history.user_id = :userId', { userId: browsingHistoryUserId })
      .andWhere('history.browsing_at >= :startAt', { startAt: range.startAt })
      .andWhere('history.browsing_at < :endAt', { endAt: range.endAt })
      .getRawOne<{ pageViews: string; averageMs: string }>();

    const averageTimeOnPageMs = Math.round(Number(result?.averageMs ?? 0));

    return {
      pageViews: Number(result?.pageViews ?? 0),
      averageTimeOnPageMs,
      averageTimeOnPageSeconds: Number((averageTimeOnPageMs / 1000).toFixed(2)),
      ...this.toPeriodResponse(range),
    };
  }

  private async getBrowsingHistoryUserId(email: string): Promise<string> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.user_id;
  }

  private resolveDateRange(
    query: PageViewAnalysisQueryDto | PageViewTrendQueryDto,
  ): DateRange {
    if ('date' in query && query.date) {
      if (query.startDate || query.endDate) {
        throw new BadRequestException(
          'date cannot be used with startDate or endDate',
        );
      }

      return this.getSingleDateRange(query.date);
    }

    if (query.startDate && query.endDate) {
      const startAt = this.parseChinaDateStart(query.startDate);
      const endAt = this.addDays(this.parseChinaDateStart(query.endDate), 1);

      if (startAt >= endAt) {
        throw new BadRequestException('startDate must be before endDate');
      }

      return {
        startAt,
        endAt,
        displayStartAt: this.toChinaDateTimeStart(query.startDate),
        displayEndAt: this.toChinaDateTimeStart(
          this.addDaysToDateString(query.endDate, 1),
        ),
      };
    }

    throw new BadRequestException(
      'Please provide date or both startDate and endDate',
    );
  }

  private getDatesInRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      dates.push(currentDate);
      currentDate = this.addDaysToDateString(currentDate, 1);
    }

    return dates;
  }

  private getSingleDateRange(date: string): DateRange {
    const startAt = this.parseChinaDateStart(date);
    const endAt = this.addDays(startAt, 1);

    return {
      startAt,
      endAt,
      displayStartAt: this.toChinaDateTimeStart(date),
      displayEndAt: this.toChinaDateTimeStart(
        this.addDaysToDateString(date, 1),
      ),
    };
  }

  private parseChinaDateStart(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException('Date must use YYYY-MM-DD format');
    }

    const [, year, month, day] = match;
    const yearNumber = Number(year);
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    const date = new Date(`${year}-${month}-${day}T00:00:00+08:00`);
    const dateForValidation = new Date(
      Date.UTC(yearNumber, monthNumber - 1, dayNumber),
    );

    if (
      Number.isNaN(date.getTime()) ||
      dateForValidation.getUTCFullYear() !== yearNumber ||
      dateForValidation.getUTCMonth() + 1 !== monthNumber ||
      dateForValidation.getUTCDate() !== dayNumber
    ) {
      throw new BadRequestException('Invalid date');
    }

    return date;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private addDaysToDateString(value: string, days: number): string {
    const date = this.addDays(this.parseChinaDateStart(value), days);
    const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    return chinaTime.toISOString().slice(0, 10);
  }

  private toChinaDateTimeStart(date: string): string {
    return `${date}T00:00:00+08:00`;
  }

  private toPeriodResponse(range: DateRange) {
    return {
      startAt: range.displayStartAt,
      endAt: range.displayEndAt,
      timezone: 'Asia/Shanghai',
    };
  }
}
