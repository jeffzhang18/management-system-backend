import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'sys_qr_login_session' })
export class QrLoginSession {
  @PrimaryColumn({ type: 'uuid' }) id: string;
  @Column({ name: 'scan_token_hash', type: 'varchar', length: 64 })
  scanTokenHash: string;
  @Column({ name: 'desktop_token_hash', type: 'varchar', length: 64 })
  desktopTokenHash: string;
  @Column({ name: 'verification_code', type: 'varchar', length: 6 })
  verificationCode: string;
  @Index()
  @Column({ name: 'requester_key', type: 'varchar', length: 64 })
  requesterKey: string;
  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
  @Column({ name: 'challenge_id', type: 'uuid', nullable: true }) challengeId:
    | string
    | null;
  @Column({ name: 'user_id', type: 'int', nullable: true }) userId:
    | number
    | null;
  @Column({ name: 'token_version', type: 'int', nullable: true }) tokenVersion:
    | number
    | null;
  @Column({ name: 'passkey_id', type: 'uuid', nullable: true }) passkeyId:
    | string
    | null;
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
