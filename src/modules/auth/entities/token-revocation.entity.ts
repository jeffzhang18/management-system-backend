import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
  } from 'typeorm';
  
  @Entity({ name: 'sys_token_revocation' })
  export class TokenRevocation {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Index({ unique: true })
    @Column({ name: 'token_hash', type: 'varchar', length: 64 })
    token_hash: string;
  
    @Column({ name: 'token_type', type: 'varchar', length: 20 })
    token_type: 'access' | 'refresh';
  
    @Column({ name: 'user_email', type: 'varchar', nullable: true })
    user_email?: string | null;
  
    @Column({ name: 'user_id', type: 'varchar', nullable: true })
    user_id?: string | null;
  
    @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
    expires_at?: Date | null;
  
    @CreateDateColumn({ name: 'revoked_at', type: 'timestamptz' })
    revoked_at: Date;
  }
  