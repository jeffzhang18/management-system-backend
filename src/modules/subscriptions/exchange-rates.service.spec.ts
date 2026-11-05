import axios from 'axios';
import { Repository } from 'typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { ExchangeRatesService } from './exchange-rates.service';

jest.mock('axios');
const get = axios.get as jest.Mock;
const response = () => ({
  data: [
    { base: 'USD', quote: 'CNY', rate: 7, date: '2026-11-03' },
    { base: 'USD', quote: 'AUD', rate: 1.5, date: '2026-11-03' },
  ],
});

describe('ExchangeRatesService', () => {
  let repository: { findOneBy: jest.Mock; save: jest.Mock; create: jest.Mock };
  let service: ExchangeRatesService;
  const cached = (hours: number) => ({
    base: 'USD',
    rates: { USD: 1, CNY: 7, AUD: 1.5 },
    rateDate: '2026-11-03',
    fetchedAt: new Date(Date.now() - hours * 3_600_000),
  });
  beforeEach(() => {
    get.mockReset();
    repository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    service = new ExchangeRatesService(
      repository as unknown as Repository<ExchangeRate>,
    );
  });

  it('fetches, stores, and cross-converts a consistent USD snapshot', async () => {
    get.mockResolvedValue(response());
    const result = await service.get('AUD');
    expect(result.rates?.USD).toBeCloseTo(2 / 3);
    expect(result.rates?.CNY).toBeCloseTo(7 / 1.5);
    expect(result.rates?.AUD).toBe(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ base: 'USD' }),
    );
  });
  it('reuses the 12-hour cache', async () => {
    repository.findOneBy.mockResolvedValue(cached(11));
    expect((await service.get()).stale).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
  it('refreshes stale cache and falls back after an upstream failure', async () => {
    repository.findOneBy.mockResolvedValue(cached(13));
    get.mockRejectedValue(new Error('offline'));
    expect(await service.get()).toMatchObject({
      available: true,
      stale: true,
      rateDate: '2026-11-03',
    });
  });
  it('returns an explicit unavailable state when no cache exists', async () => {
    get.mockRejectedValue(new Error('offline'));
    expect(await service.get()).toMatchObject({
      available: false,
      rates: null,
      stale: true,
    });
  });
  it('rejects inconsistent dates without overwriting the cache', async () => {
    repository.findOneBy.mockResolvedValue(cached(13));
    const value = response();
    value.data[1].date = '2026-11-02';
    get.mockResolvedValue(value);
    expect((await service.get()).stale).toBe(true);
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('deduplicates simultaneous external requests', async () => {
    get.mockResolvedValue(response());
    await Promise.all([
      service.get('USD'),
      service.get('CNY'),
      service.get('AUD'),
    ]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
