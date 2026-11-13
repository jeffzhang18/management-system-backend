import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserUiSettings1794528000000 implements MigrationInterface {
  name = 'AddUserUiSettings1794528000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_ui_settings (
        user_id BIGINT PRIMARY KEY REFERENCES user_info(id) ON DELETE CASCADE,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE user_ui_settings');
  }
}
