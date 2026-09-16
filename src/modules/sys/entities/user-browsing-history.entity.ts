import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Index('idx_browsing_history_user_time', ['user_id', 'browsing_at'])
@Index('idx_browsing_history_page_time', ['page_url', 'browsing_at'])
@Index('uq_browsing_history_user_page_view', ['user_id', 'page_view_id'], {
  unique: true,
  where: '"page_view_id" IS NOT NULL',
})
@Entity({ name: 'sys_user_browsing_history' })
export class UserBrowsingHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  user_id: string;

  @CreateDateColumn({ name: 'browsing_at', type: 'timestamptz' })
  browsing_at: Date;

  @Column({ name: 'page_url', type: 'varchar' })
  page_url: string;

  @Column({ name: 'user_ip', type: 'varchar', nullable: true })
  user_ip?: string | null;

  @Column({ type: 'varchar', nullable: true })
  device?: string | null;

  @Column({ name: 'page_view_id', type: 'uuid', nullable: true })
  page_view_id?: string | null;

  @Column({ name: 'active_duration_ms', type: 'bigint', default: 0 })
  active_duration_ms: string;

  @Column({ name: 'last_sequence', type: 'int', default: 0 })
  last_sequence: number;

  @Column({ name: 'last_reported_at', type: 'timestamptz', nullable: true })
  last_reported_at?: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  ended_at?: Date | null;

  @Column({ name: 'leave_reason', type: 'varchar', length: 32, nullable: true })
  leave_reason?: string | null;
}
