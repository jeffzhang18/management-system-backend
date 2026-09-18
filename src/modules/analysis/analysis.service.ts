import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBrowsingHistory } from '../sys/entities/user-browsing-history.entity';
import { PageViewAnalysisQueryDto } from './dto/page-view-analysis-query.dto';

interface DateRange {
  startAt: Date;
  endAt: Date;
}

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(UserBrowsingHistory)
    private readonly userBrowsingHistoryRepository: Repository<UserBrowsingHistory>,
  ) {}

  async getTotalPageViews(userId: string, query: PageViewAnalysisQueryDto) {
    const range = this.resolveDateRange(query);

    const result = await this.userBrowsingHistoryRepository
      .createQueryBuilder('history')
      .select('COUNT(*)', 'totalPageViews')
      .where('history.user_id = :userId', { userId })
      .andWhere('history.browsing_at >= :startAt', { startAt: range.startAt })
      .andWhere('history.browsing_at < :endAt', { endAt: range.endAt })
      .getRawOne<{ totalPageViews: string }>();

    return {
      totalPageViews: Number(result?.totalPageViews ?? 0),
      ...this.toPeriodResponse(range),
    };
  }

  async getAverageTimeOnPage(userId: string, query: PageViewAnalysisQueryDto) {
    const range = this.resolveDateRange(query);

    const result = await this.userBrowsingHistoryRepository
      .createQueryBuilder('history')
      .select('COUNT(*)', 'pageViews')
      .addSelect('COALESCE(AVG(history.active_duration_ms), 0)', 'averageMs')
      .where('history.user_id = :userId', { userId })
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

  private resolveDateRange(query: PageViewAnalysisQueryDto): DateRange {
    if (query.date) {
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

      return { startAt, endAt };
    }

    throw new BadRequestException(
      'Please provide date or both startDate and endDate',
    );
  }

  private getSingleDateRange(date: string): DateRange {
    const startAt = this.parseChinaDateStart(date);
    const endAt = this.addDays(startAt, 1);

    return { startAt, endAt };
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

  private toPeriodResponse(range: DateRange) {
    return {
      startAt: range.startAt.toISOString(),
      endAt: range.endAt.toISOString(),
      timezone: 'Asia/Shanghai',
    };
  }
}
