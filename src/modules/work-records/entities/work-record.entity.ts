import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkRecordTheme } from './work-record-theme.entity';

@Entity({ name: 'work_record', synchronize: false })
export class WorkRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  user_id: number;

  @Column({ name: 'record_date', type: 'date' })
  record_date: string;

  @Column({ type: 'varchar', length: 80 })
  title: string;

  @Column({ name: 'theme_id', type: 'bigint' })
  theme_id: number;

  @ManyToOne(() => WorkRecordTheme, { nullable: false })
  @JoinColumn({ name: 'theme_id' })
  theme: WorkRecordTheme;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  start_time: string | null;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  end_time: string | null;

  @Column({ name: 'content_md', type: 'text', nullable: true })
  content_md: string | null;

  @Column({ name: 'version', type: 'int', default: 0 })
  version: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
