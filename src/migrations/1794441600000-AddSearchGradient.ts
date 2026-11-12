import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchGradient1794441600000 implements MigrationInterface {
  name = 'AddSearchGradient1794441600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE search_settings
        ADD COLUMN gradient_from VARCHAR(7) NOT NULL DEFAULT '#1e3a8a'
          CHECK (gradient_from ~ '^#[0-9a-fA-F]{6}$'),
        ADD COLUMN gradient_to VARCHAR(7) NOT NULL DEFAULT '#6d28d9'
          CHECK (gradient_to ~ '^#[0-9a-fA-F]{6}$'),
        ADD COLUMN gradient_angle INTEGER NOT NULL DEFAULT 135
          CHECK (gradient_angle BETWEEN 0 AND 359)
    `);
    await queryRunner.query(`
      ALTER TABLE search_settings DROP CONSTRAINT search_settings_background_mode_check
    `);
    await queryRunner.query(`
      ALTER TABLE search_settings ADD CONSTRAINT search_settings_background_mode_check
        CHECK (background_mode IN ('default', 'gradient', 'online'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE search_settings SET background_mode = 'default', version = version + 1
        WHERE background_mode = 'gradient'
    `);
    await queryRunner.query(`
      ALTER TABLE search_settings DROP CONSTRAINT search_settings_background_mode_check
    `);
    await queryRunner.query(`
      ALTER TABLE search_settings ADD CONSTRAINT search_settings_background_mode_check
        CHECK (background_mode IN ('default', 'online'))
    `);
    await queryRunner.query(`
      ALTER TABLE search_settings
        DROP COLUMN gradient_from,
        DROP COLUMN gradient_to,
        DROP COLUMN gradient_angle
    `);
  }
}
