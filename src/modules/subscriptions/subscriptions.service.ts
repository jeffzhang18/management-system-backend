import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  add,
  decimal,
  describeSubscription,
  fixed,
  fraction,
  monthlyCost,
  multiply,
  renewalCount,
  shanghaiToday,
  zero,
} from './billing';
import { ExchangeRatesService } from './exchange-rates.service';
import { Subscription } from './subscription.entity';
import type { Currency } from './subscription.entity';
import {
  currencyValue,
  SubscriptionInput,
  validateCombined,
  validateInput,
} from './subscription-input';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly repository: Repository<Subscription>,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  private owner(userId: unknown): string {
    if (!/^[1-9]\d*$/.test(String(userId))) throw new UnauthorizedException();
    return String(userId);
  }

  private async owned(userId: unknown, id: string): Promise<Subscription> {
    const owner = this.owner(userId);
    if (!/^[1-9]\d*$/.test(id))
      throw new NotFoundException('Subscription not found');
    const item = await this.repository.findOneBy({
      id,
      userId: owner,
      deletedAt: IsNull(),
    });
    if (!item) throw new NotFoundException('Subscription not found');
    return item;
  }

  private serialize(item: Subscription, today = shanghaiToday()) {
    const { userId, deletedAt, ...fields } = item;
    return { ...fields, ...describeSubscription(item, today) };
  }

  private find(userId: unknown) {
    return this.repository.find({
      where: { userId: this.owner(userId), deletedAt: IsNull() },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async list(userId: unknown) {
    const today = shanghaiToday();
    return {
      asOf: today,
      items: (await this.find(userId)).map((item) =>
        this.serialize(item, today),
      ),
    };
  }

  async create(userId: unknown, body: unknown) {
    const owner = this.owner(userId);
    const input = validateInput(body) as SubscriptionInput;
    validateCombined(input);
    const item = await this.repository.save(
      this.repository.create({ ...input, userId: owner, deletedAt: null }),
    );
    return this.serialize(item);
  }

  async update(userId: unknown, id: string, body: unknown) {
    const item = await this.owned(userId, id);
    const changes = validateInput(body, true);
    Object.assign(item, changes);
    validateCombined(item);
    return this.serialize(await this.repository.save(item));
  }

  async remove(userId: unknown, id: string) {
    const item = await this.owned(userId, id);
    item.deletedAt = new Date();
    await this.repository.save(item);
    return { id: item.id, deletedAt: item.deletedAt };
  }

  async summary(userId: unknown, currency: Currency = 'CNY') {
    currencyValue(currency);
    const [items, exchange] = await Promise.all([
      this.find(userId),
      this.exchangeRates.get(),
    ]);
    const today = shanghaiToday();
    let monthly = zero();
    let upcoming = zero();
    let monthlyAvailable = true;
    let upcomingAvailable = true;
    const active = items.filter(
      (item) => describeSubscription(item, today).status === 'active',
    );
    for (const item of items) {
      const isActive = describeSubscription(item, today).status === 'active';
      const count = renewalCount(item, today);
      const contributesMonthly = isActive && item.cycleUnit !== 'once';
      if (!contributesMonthly && count === 0) continue;
      let factor = fraction(1n);
      if (item.currency !== currency) {
        if (!exchange.rates) {
          if (contributesMonthly && decimal(item.amount).n !== 0n)
            monthlyAvailable = false;
          if (count && decimal(item.amount).n !== 0n) upcomingAvailable = false;
          continue;
        }
        const from = decimal(exchange.rates[item.currency].toFixed(12));
        const to = decimal(exchange.rates[currency].toFixed(12));
        factor = fraction(to.n * from.d, to.d * from.n);
      }
      if (contributesMonthly)
        monthly = add(monthly, multiply(monthlyCost(item), factor));
      if (count)
        upcoming = add(
          upcoming,
          multiply(
            multiply(decimal(item.amount), fraction(BigInt(count))),
            factor,
          ),
        );
    }
    return {
      asOf: today,
      currency,
      totalCount: items.length,
      activeCount: active.length,
      monthlyEstimate: monthlyAvailable ? fixed(monthly) : null,
      annualEstimate: monthlyAvailable
        ? fixed(multiply(monthly, fraction(12n)))
        : null,
      upcoming30Days: upcomingAvailable ? fixed(upcoming) : null,
      exchange,
    };
  }
}
