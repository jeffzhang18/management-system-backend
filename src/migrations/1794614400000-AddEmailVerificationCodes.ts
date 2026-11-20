import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationCodes1794614400000
  implements MigrationInterface
{
  name = 'AddEmailVerificationCodes1794614400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sys_email_verification_code (
        id SERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL,
        code_hash VARCHAR(64) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      'CREATE INDEX idx_sys_email_verification_code_email ON sys_email_verification_code (email)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE sys_email_verification_code');
  }
}
