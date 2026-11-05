import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { ExchangeRatesService, RateSnapshot } from './exchange-rates.service';
import { Subscription } from './subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

const fixture = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: '1',
  userId: '10',
  name: 'Software',
  devices: ['computer'],
  startDate: '2026-01-01',
  endDate: null,
  cycleUnit: 'month',
  cycleInterval: 1,
  amount: '20.00',
  currency: 'USD',
  autoRenew: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});
const rates = (): RateSnapshot => ({
  base: 'USD',
  rates: { USD: 1, CNY: 7, AUD: 1.5 },
  rateDate: '2026-11-03',
  fetchedAt: '2026-11-04T00:00:00Z',
  source: 'Frankfurter',
  stale: false,
  available: true,
});

describe('SubscriptionsService', () => {
  let repository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let exchange: { get: jest.Mock };
  let service: SubscriptionsService;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-04T02:00:00Z'));
    repository = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    exchange = { get: jest.fn().mockResolvedValue(rates()) };
    service = new SubscriptionsService(
      repository as unknown as Repository<Subscription>,
      exchange as unknown as ExchangeRatesService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('scopes listing and writes to the authenticated user', async () => {
    repository.find.mockResolvedValue([fixture()]);
    const result = await service.list(10);
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: '10', deletedAt: IsNull() } }),
    );
    expect(result.items[0]).not.toHaveProperty('userId');
    const { id, userId, createdAt, updatedAt, deletedAt, ...input } = fixture();
    await service.create(20, input);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '20' }),
    );
  });

  it('rejects missing owners and cross-user edits/deletions', async () => {
    await expect(service.list(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    repository.findOneBy.mockResolvedValue(null);
    await expect(
      service.update(20, '1', { name: 'Other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(20, '1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findOneBy).toHaveBeenCalledWith({
      id: '1',
      userId: '20',
      deletedAt: IsNull(),
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('edits allowed fields and soft deletes', async () => {
    repository.findOneBy.mockResolvedValue(fixture());
    expect(await service.update(10, '1', { name: ' Updated ' })).toMatchObject({
      name: 'Updated',
    });
    await service.remove(10, '1');
    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  it('cross-converts recurring costs and includes repeated renewals', async () => {
    repository.find.mockResolvedValue([
      fixture(),
      fixture({
        id: '2',
        currency: 'AUD',
        amount: '15.00',
        cycleUnit: 'day',
        cycleInterval: 10,
      }),
      fixture({
        id: '3',
        currency: 'CNY',
        amount: '500.00',
        cycleUnit: 'once',
        autoRenew: false,
      }),
    ]);
    const result = await service.summary(10, 'CNY');
    // USD20/month + AUD15/10days = CNY140 + CNY212.916666...
    expect(result).toMatchObject({
      activeCount: 3,
      monthlyEstimate: '352.92',
      annualEstimate: '4235.00',
      upcoming30Days: '350.00',
    });
    expect(result.currency).toBe('CNY');
  });

  it('returns unavailable totals without dropping unknown currency contributions', async () => {
    exchange.get.mockResolvedValue({
      ...rates(),
      rates: null,
      available: false,
      stale: true,
    });
    repository.find.mockResolvedValue([
      fixture(),
      fixture({ currency: 'CNY', amount: '30.00' }),
    ]);
    expect(await service.summary(10, 'CNY')).toMatchObject({
      monthlyEstimate: null,
      annualEstimate: null,
      upcoming30Days: null,
    });
    repository.find.mockResolvedValue([
      fixture({ currency: 'CNY', amount: '30.00' }),
    ]);
    expect(await service.summary(10, 'CNY')).toMatchObject({
      monthlyEstimate: '30.00',
    });
  });
});
