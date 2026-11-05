import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Currency } from './subscription.entity';

@Entity({ name: 'subscription_exchange_rate', synchronize: false })
export class ExchangeRate {
  @PrimaryColumn({ type: 'varchar', length: 3 })
  base: Currency;

  @Column({ type: 'jsonb' })
  rates: Record<Currency, number>;

  @Column({ name: 'rate_date', type: 'date' })
  rateDate: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;
}
