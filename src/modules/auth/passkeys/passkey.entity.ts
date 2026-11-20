import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../../domain/user/user.entity';

@Entity({ name: 'sys_passkey' })
export class Passkey {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'credential_id',
    type: 'varchar',
    length: 2048,
    unique: true,
  })
  credentialId: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ name: 'user_handle', type: 'varchar', length: 128 })
  userHandle: string;

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  counter: number;

  @Column({ type: 'json', default: '[]' })
  transports: string[];

  @Column({ name: 'device_type', type: 'varchar', length: 32 })
  deviceType: string;

  @Column({ name: 'backed_up', type: 'boolean' })
  backedUp: boolean;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}

@Entity({ name: 'sys_passkey_challenge' })
export class PasskeyChallenge {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  purpose: 'register' | 'login';

  @Column({ type: 'text' })
  challenge: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'token_version', type: 'int', nullable: true })
  tokenVersion: number | null;

  @Index()
  @Column({ name: 'requester_key', type: 'varchar', length: 80 })
  requesterKey: string;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
