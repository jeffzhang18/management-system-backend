import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'sys_api_info' })
export class ApiCallLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // 调用时间：自动写入
  @CreateDateColumn({ name: 'call_at_time', type: 'timestamptz' })
  callAtTime: Date;

  @Index()
  @Column({ name: 'api_name', type: 'varchar', length: 255 })
  apiName: string;

  @Index()
  @Column({ name: 'call_from_ip', type: 'varchar', length: 64 })
  callFromIp: string;

  @Column({ name: 'user_email', type: 'varchar', nullable: true })
  userEmail?: string | null;

  @Column({ name: "status", type:"bool", nullable: false})
  status: boolean | false;
}