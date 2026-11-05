import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftwareSubscriptions1793750400000 implements MigrationInterface {
  name = 'AddSoftwareSubscriptions1793750400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE software_subscription (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name VARCHAR(200) NOT NULL,
        devices JSONB NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        cycle_unit VARCHAR(8) NOT NULL CHECK (cycle_unit IN ('day', 'month', 'year', 'once')),
        cycle_interval INTEGER NOT NULL CHECK (cycle_interval BETWEEN 1 AND 1200),
        amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
        currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'CNY', 'AUD')),
        auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT subscription_dates CHECK (end_date IS NULL OR end_date > start_date)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX idx_subscription_user ON software_subscription(user_id)',
    );
    await queryRunner.query(`
      CREATE TABLE subscription_exchange_rate (
        base VARCHAR(3) PRIMARY KEY,
        rates JSONB NOT NULL,
        rate_date DATE NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE subscription_exchange_rate');
    await queryRunner.query('DROP TABLE software_subscription');
  }
}
