import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
  } from 'typeorm';
  
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
  }
  