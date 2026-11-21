import { newDb } from 'pg-mem';
import type { DataSource } from 'typeorm';
import { AddEmailVerificationCodes1794614400000 } from './1794614400000-AddEmailVerificationCodes';
import { AddPasswordReset1795219200000 } from './1795219200000-AddPasswordReset';
import { AddPasskeys1795222800000 } from './1795222800000-AddPasskeys';

describe('Upgrade legacy authentication schema created by synchronize', () => {
  let db: DataSource;
  beforeEach(async () => {
    const memory = newDb();
    memory.public.registerFunction({
      name: 'current_database',
      implementation: () => 'auth_upgrade_test',
    });
    memory.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 16',
    });
    db = memory.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [],
      migrations: [
        AddEmailVerificationCodes1794614400000,
        AddPasswordReset1795219200000,
        AddPasskeys1795222800000,
      ],
    }) as DataSource;
    await db.initialize();
    await db.query('CREATE TABLE user_info (id SERIAL PRIMARY KEY)');
    await db.query('INSERT INTO user_info(id) VALUES (1)');
  });
  afterEach(async () => {
    await db?.destroy();
  });

  it('upgrades a fresh authentication schema', async () => {
    const result = await db.runMigrations();
    expect(result).toHaveLength(3);
    expect(
      await db.query('SELECT purpose FROM sys_email_verification_code'),
    ).toEqual([]);
    expect(await db.query('SELECT id FROM sys_passkey')).toEqual([]);
    expect(await db.query('SELECT id FROM sys_passkey_challenge')).toEqual([]);
  });

  it('preserves existing verification data and records all pending migrations exactly once', async () => {
    const runner = db.createQueryRunner();
    // Reproduce the production state: the legacy table exists but the migration is unrecorded.
    await new AddEmailVerificationCodes1794614400000().up(runner);
    await db.query(
      "INSERT INTO sys_email_verification_code(email, code_hash, expires_at) VALUES ('legacy@example.com', 'test-hash', NOW())",
    );
    await runner.release();
    const result = await db.runMigrations();
    expect(result).toHaveLength(3);
    expect(
      await db.query(
        'SELECT email, code_hash, purpose FROM sys_email_verification_code',
      ),
    ).toEqual([
      {
        email: 'legacy@example.com',
        code_hash: 'test-hash',
        purpose: 'register',
      },
    ]);
    expect(
      await db.query('SELECT COUNT(*)::int AS count FROM migrations'),
    ).toEqual([{ count: 3 }]);
    expect(await db.runMigrations()).toEqual([]);
  });

  it('refuses to adopt an incompatible existing table', async () => {
    await db.query(
      'CREATE TABLE sys_email_verification_code (id SERIAL PRIMARY KEY, email VARCHAR(320))',
    );
    const runner = db.createQueryRunner();
    await expect(
      new AddEmailVerificationCodes1794614400000().up(runner),
    ).rejects.toThrow();
    await runner.release();
  });
});
