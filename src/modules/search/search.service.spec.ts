import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataType, newDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { AddSearchNavigation1794355200000 } from '../../migrations/1794355200000-AddSearchNavigation';
import { SearchBookmark, SearchHistory, SearchSettings } from './search.entity';
import { SearchService } from './search.service';

const bookmark = {
  name: 'Example',
  url: 'https://example.com',
  titleSource: 'custom' as const,
  iconSource: 'auto' as const,
  iconUrl: null,
};
const request = {
  query: '中文 & query',
  engine: 'google' as const,
  requestId: '00000000-0000-4000-8000-000000000001',
  source: '/search',
};

describe('SearchService with an isolated in-memory PostgreSQL adapter', () => {
  let db: DataSource;
  let service: SearchService;
  beforeEach(async () => {
    const memory = newDb();
    memory.public.registerOperator({
      operator: '~',
      left: DataType.text,
      right: DataType.text,
      returns: DataType.bool,
      implementation: (value: string, pattern: string) =>
        new RegExp(pattern).test(value),
    });
    memory.public.registerFunction({
      name: 'current_database',
      implementation: () => 'search_test',
    });
    memory.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 16',
    });
    memory.public.registerFunction({
      name: 'btrim',
      args: [DataType.text],
      returns: DataType.text,
      implementation: (value: string) => value.trim(),
    });
    memory.public.registerFunction({
      name: 'length',
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value: string) => value.length,
    });
    db = memory.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [SearchSettings, SearchBookmark, SearchHistory],
      synchronize: false,
    });
    await db.initialize();
    await db.query('CREATE TABLE user_info (id SERIAL PRIMARY KEY)');
    await db.query('INSERT INTO user_info(id) VALUES (1),(2)');
    const runner = db.createQueryRunner();
    await new AddSearchNavigation1794355200000().up(runner);
    await runner.release();
    service = new SearchService(db);
  });
  afterEach(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('persists default settings and protects independent owners and stale versions', async () => {
    expect(await service.settings(1)).toMatchObject({
      version: 0,
      iconSize: 72,
    });
    const saved = await service.saveSettings(1, {
      version: 0,
      defaultEngine: 'bing',
      backgroundMode: 'online',
      wallpaperUrl: 'https://example.com/wall.jpg',
    });
    expect(saved).toMatchObject({ version: 1, defaultEngine: 'bing' });
    expect(saved).not.toHaveProperty('userId');
    expect(await service.settings(2)).toMatchObject({
      version: 0,
      defaultEngine: 'google',
    });
    await expect(
      service.saveSettings(1, { version: 0, gap: 32 }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.saveSettings(1, { version: 1, iconSize: 40, radius: 30 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.settings(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('creates, edits, sorts and deletes only the authenticated owner bookmarks', async () => {
    const one = await service.createBookmark(1, bookmark);
    const two = await service.createBookmark(1, {
      ...bookmark,
      name: 'Second',
    });
    await service.createBookmark(2, { ...bookmark, name: 'Other owner' });
    await expect(
      service.updateBookmark(2, one.id, { version: 1, name: 'Hacked' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteBookmark(2, one.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect((await service.bookmarks(1)).items.map((row) => row.name)).toEqual([
      'Example',
      'Second',
    ]);
    expect(
      (await service.reorder(1, [two.id, one.id])).items.map((row) => row.id),
    ).toEqual([two.id, one.id]);
    await expect(service.reorder(1, [one.id, one.id])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.reorder(1, [one.id])).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.updateBookmark(1, one.id, { version: 1, name: 'Stale' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const changed = await service.updateBookmark(1, one.id, {
      version: 2,
      name: 'Changed',
    });
    expect(changed).toMatchObject({ name: 'Changed', version: 3 });
    await service.deleteBookmark(1, two.id);
    expect((await service.bookmarks(1)).items).toHaveLength(1);
    expect((await service.bookmarks(2)).items).toHaveLength(1);
  });

  it('records intentional searches, deduplicates retries, and rejects request-id reuse', async () => {
    const first = await service.search(1, request);
    const again = await service.search(1, request);
    expect(first.historyId).toBe(again.historyId);
    const another = await service.search(1, {
      ...request,
      requestId: '00000000-0000-4000-8000-000000000002',
    });
    expect(another.historyId).not.toBe(first.historyId);
    await expect(
      service.search(1, { ...request, query: 'different' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await service.search(2, request)).historyId).not.toBe(
      first.historyId,
    );
    const history = await service.history(1, { limit: 20 });
    expect(history.items).toHaveLength(2);
    expect(history.items[0]).not.toHaveProperty('userId');
    expect(history.items[0]).not.toHaveProperty('requestId');
    expect(new URL(first.targetUrl).searchParams.get('q')).toBe(request.query);
  });

  it('paginates tied timestamps and scopes single-delete and clearing', async () => {
    for (let i = 1; i <= 3; i++)
      await service.search(1, {
        ...request,
        requestId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      });
    const other = await service.search(2, request);
    await db.query(
      "UPDATE search_history SET created_at = '2026-11-11T00:00:00.000Z'",
    );
    const first = await service.history(1, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await service.history(1, {
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((row) => row.id)).size,
    ).toBe(3);
    await expect(
      service.deleteHistory(1, other.historyId),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.history(1, { cursor: 'bad cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.deleteHistory(1, second.items[0].id);
    expect(await service.clearHistory(1)).toEqual({ deletedCount: 2 });
    expect((await service.history(2, {})).items).toHaveLength(1);
  });

  it('rolls the explicit migration back without removing accounts', async () => {
    const runner = db.createQueryRunner();
    await new AddSearchNavigation1794355200000().down(runner);
    await runner.release();
    for (const table of [
      'search_settings',
      'search_bookmark',
      'search_history',
    ]) {
      await expect(db.query(`SELECT * FROM ${table}`)).rejects.toThrow();
    }
    expect(await db.query('SELECT * FROM user_info')).toHaveLength(2);
  });
});
