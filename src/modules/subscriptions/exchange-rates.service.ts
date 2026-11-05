import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import type { Currency } from './subscription.entity';
import { CURRENCIES, currencyValue } from './subscription-input';

export interface RateSnapshot {
  base: Currency;
  rates: Record<Currency, number> | null;
  rateDate: string | null;
  fetchedAt: string | null;
  source: 'Frankfurter';
  stale: boolean;
  available: boolean;
}

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private pending: Promise<RateSnapshot> | null = null;

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly repository: Repository<ExchangeRate>,
  ) {}

  async get(base: Currency = 'USD'): Promise<RateSnapshot> {
    currencyValue(base);
    if (!this.pending) {
      this.pending = this.load().finally(() => {
        this.pending = null;
      });
    }
    const snapshot = await this.pending;
    if (!snapshot.rates || base === 'USD') return snapshot;
    const rates = { ...snapshot.rates };
    for (const currency of CURRENCIES)
      rates[currency] = snapshot.rates[currency] / snapshot.rates[base];
    return { ...snapshot, base, rates };
  }

  private snapshot(row: ExchangeRate, stale: boolean): RateSnapshot {
    return {
      base: 'USD',
      rates: row.rates,
      rateDate: row.rateDate,
      fetchedAt: new Date(row.fetchedAt).toISOString(),
      source: 'Frankfurter',
      stale,
      available: true,
    };
  }

  private async load(): Promise<RateSnapshot> {
    const cached = await this.repository.findOneBy({ base: 'USD' });
    if (
      cached &&
      Date.now() - new Date(cached.fetchedAt).getTime() < 12 * 60 * 60 * 1000
    )
      return this.snapshot(cached, false);
    try {
      const { data } = await axios.get('https://api.frankfurter.dev/v2/rates', {
        params: { base: 'USD', quotes: 'CNY,AUD', providers: 'ecb' },
        timeout: 8000,
      });
      const rates: Record<Currency, number> = { USD: 1, CNY: 0, AUD: 0 };
      const dates: string[] = [];
      for (const currency of ['CNY', 'AUD'] as const) {
        const row = Array.isArray(data)
          ? data.find(
              (item) =>
                String(item.base).toUpperCase() === 'USD' &&
                String(item.quote).toUpperCase() === currency,
            )
          : null;
        if (
          !row ||
          typeof row.rate !== 'number' ||
          !Number.isFinite(row.rate) ||
          row.rate <= 0 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
        )
          throw new Error('Invalid exchange rate response');
        rates[currency] = row.rate;
        dates.push(row.date);
      }
      if (dates[0] !== dates[1])
        throw new Error('Inconsistent exchange rate dates');
      const saved = await this.repository.save(
        this.repository.create({
          base: 'USD',
          rates,
          rateDate: dates[0],
          fetchedAt: new Date(),
        }),
      );
      return this.snapshot(saved, false);
    } catch {
      this.logger.warn(
        'Exchange rates unavailable; using cached rates when present',
      );
      if (cached) return this.snapshot(cached, true);
      return {
        base: 'USD',
        rates: null,
        rateDate: null,
        fetchedAt: null,
        source: 'Frankfurter',
        stale: true,
        available: false,
      };
    }
  }
}
