import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasskeys1795222800000 implements MigrationInterface {
  name = 'AddPasskeys1795222800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE sys_passkey (
      id UUID PRIMARY KEY, user_id INT NOT NULL REFERENCES user_info(id) ON DELETE CASCADE,
      credential_id VARCHAR(2048) NOT NULL UNIQUE, public_key TEXT NOT NULL,
      user_handle VARCHAR(128) NOT NULL, counter BIGINT NOT NULL,
      transports JSON NOT NULL DEFAULT '[]', device_type VARCHAR(32) NOT NULL,
      backed_up BOOLEAN NOT NULL, name VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_used_at TIMESTAMPTZ
    )`);
    await queryRunner.query(
      'CREATE INDEX idx_sys_passkey_user_id ON sys_passkey (user_id)',
    );
    await queryRunner.query(`CREATE TABLE sys_passkey_challenge (
      id UUID PRIMARY KEY, purpose VARCHAR(16) NOT NULL, challenge TEXT NOT NULL,
      user_id INT, token_version INT, requester_key VARCHAR(80) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await queryRunner.query(
      'CREATE INDEX idx_sys_passkey_challenge_requester ON sys_passkey_challenge (requester_key)',
    );
    await queryRunner.query(
      'CREATE INDEX idx_sys_passkey_challenge_expiry ON sys_passkey_challenge (expires_at)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE sys_passkey_challenge');
    await queryRunner.query('DROP TABLE sys_passkey');
  }
}
