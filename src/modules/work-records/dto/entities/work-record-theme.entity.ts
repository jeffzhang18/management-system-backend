import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'work_record_theme', synchronize: false })
export class WorkRecordTheme {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'owner_user_id', type: 'bigint' })
  owner_user_id: number;

  @Column({ name: 'theme_key', type: 'varchar', length: 64 })
  theme_key: string;

  @Column({ name: 'theme_name', type: 'varchar', length: 50 })
  theme_name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  is_system: boolean;

  @Column({ name: 'sort_no', type: 'int', default: 0 })
  sort_no: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}
