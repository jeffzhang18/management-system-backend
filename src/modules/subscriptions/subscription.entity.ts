import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type Currency = 'USD' | 'CNY' | 'AUD';
export type Device = 'phone' | 'computer' | 'other';
export type CycleUnit = 'day' | 'month' | 'year' | 'once';

@Entity({ name: 'software_subscription', synchronize: false })
@Index('idx_subscription_user', ['userId'])
export class Subscription {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'jsonb' })
  devices: Device[];

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'cycle_unit', type: 'varchar', length: 8 })
  cycleUnit: CycleUnit;

  @Column({ name: 'cycle_interval', type: 'integer' })
  cycleInterval: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  @Column({ name: 'auto_renew', type: 'boolean', default: true })
  autoRenew: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
