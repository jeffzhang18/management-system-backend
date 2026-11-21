import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrLoginSessions1795305600000 implements MigrationInterface {
  name = 'AddQrLoginSessions1795305600000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE sys_qr_login_session (
      id UUID PRIMARY KEY, scan_token_hash VARCHAR(64) NOT NULL, desktop_token_hash VARCHAR(64) NOT NULL,
      verification_code VARCHAR(6) NOT NULL, requester_key VARCHAR(64) NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      challenge_id UUID, user_id INT, token_version INT, passkey_id UUID,
      approved_at TIMESTAMPTZ, consumed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await queryRunner.query(
      'CREATE INDEX idx_sys_qr_login_requester ON sys_qr_login_session(requester_key)',
    );
    await queryRunner.query(
      'CREATE INDEX idx_sys_qr_login_expiry ON sys_qr_login_session(expires_at)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE sys_qr_login_session');
  }
}
