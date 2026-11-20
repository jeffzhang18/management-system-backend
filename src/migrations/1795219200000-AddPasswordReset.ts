import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordReset1795219200000 implements MigrationInterface {
  name = 'AddPasswordReset1795219200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE sys_email_verification_code ADD COLUMN purpose VARCHAR(32) NOT NULL DEFAULT 'register'",
    );
    await queryRunner.query(
      'ALTER TABLE user_info ADD COLUMN token_version INT NOT NULL DEFAULT 0',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE user_info DROP COLUMN token_version');
    await queryRunner.query(
      'ALTER TABLE sys_email_verification_code DROP COLUMN purpose',
    );
  }
}
