import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SearchBookmark, SearchHistory, SearchSettings } from './search.entity';
import type {
  CreateSearchBookmarkDto,
  CreateSearchDto,
  SearchHistoryQueryDto,
  UpdateSearchBookmarkDto,
  UpdateSearchSettingsDto,
} from './search.dto';
import {
  createSearchTarget,
  DEFAULT_SEARCH_SETTINGS,
  normalizeSearchUrl,
  validateSearchSettings,
} from './search-values';

function publicFields<T extends { userId: string }>(row: T): Omit<T, 'userId'> {
  const { userId, ...fields } = row;
  if ('id' in fields) (fields as { id: unknown }).id = String(fields.id);
  return fields;
}

@Injectable()
export class SearchService {
  constructor(private readonly dataSource: DataSource) {}

  private owner(input: unknown): string {
    if (
      !/^[1-9]\d*$/.test(String(input)) ||
      BigInt(String(input)) > 2147483647n
    )
      throw new UnauthorizedException();
    return String(input);
  }

  private id(input: string): string {
    if (!/^[1-9]\d*$/.test(input) || BigInt(input) > 9223372036854775807n)
      throw new NotFoundException('记录不存在');
    return input;
  }

  // One lock per account serializes first-save, reorder and bookmark edits/deletes.
  private async write<T>(
    owner: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const users = await manager.query(
        'SELECT id FROM user_info WHERE id = $1 FOR UPDATE',
        [owner],
      );
      if (!users.length) throw new UnauthorizedException();
      return fn(manager);
    });
  }

  async settings(userId: unknown) {
    const row = await this.dataSource
      .getRepository(SearchSettings)
      .findOneBy({ userId: this.owner(userId) });
    return row ? publicFields(row) : { ...DEFAULT_SEARCH_SETTINGS };
  }

  async saveSettings(userId: unknown, input: UpdateSearchSettingsDto) {
    const owner = this.owner(userId);
    return this.write(owner, async (manager) => {
      const repo = manager.getRepository(SearchSettings);
      const current = await repo.findOneBy({ userId: owner });
      const base = current
        ? publicFields(current)
        : { ...DEFAULT_SEARCH_SETTINGS };
      if (input.version !== base.version)
        throw new ConflictException('设置已在其他页面更新，请重新加载后保存');
      const changes = Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => key !== 'version' && value !== undefined,
        ),
      );
      const next = validateSearchSettings({ ...base, ...changes });
      return publicFields(
        await repo.save(
          repo.merge(current ?? repo.create({ userId: owner }), {
            ...next,
            version: base.version + 1,
          }),
        ),
      );
    });
  }

  async bookmarks(userId: unknown) {
    const rows = await this.dataSource.getRepository(SearchBookmark).find({
      where: { userId: this.owner(userId) },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return { items: rows.map(publicFields) };
  }

  private bookmarkValues(
    input: Pick<
      SearchBookmark,
      'name' | 'url' | 'titleSource' | 'iconSource' | 'iconUrl'
    > & { metadataFetchedAt?: Date | string | null },
  ) {
    if (
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.trim().length > 80 ||
      !['auto', 'custom'].includes(input.titleSource) ||
      !['auto', 'custom'].includes(input.iconSource)
    )
      throw new BadRequestException('请检查网站名称与图标来源');
    const url = normalizeSearchUrl(input.url);
    const iconUrl =
      input.iconUrl === null ||
      input.iconUrl === undefined ||
      input.iconUrl === ''
        ? null
        : normalizeSearchUrl(input.iconUrl, true);
    if (input.iconSource === 'custom' && !iconUrl)
      throw new BadRequestException('请填写在线图标链接');
    let metadataFetchedAt: Date | null = null;
    if (input.metadataFetchedAt != null) {
      metadataFetchedAt = new Date(input.metadataFetchedAt);
      if (!Number.isFinite(metadataFetchedAt.getTime()))
        throw new BadRequestException('无效的网站信息时间');
    }
    return {
      name: input.name.trim(),
      url,
      titleSource: input.titleSource,
      iconSource: input.iconSource,
      iconUrl,
      metadataFetchedAt,
    };
  }

  async createBookmark(userId: unknown, input: CreateSearchBookmarkDto) {
    const owner = this.owner(userId);
    const values = this.bookmarkValues({
      ...input,
      iconUrl: input.iconUrl ?? null,
    });
    return this.write(owner, async (manager) => {
      const repo = manager.getRepository(SearchBookmark);
      const rows = await repo.find({
        where: { userId: owner },
        order: { sortOrder: 'DESC' },
        take: 1,
      });
      if ((await repo.countBy({ userId: owner })) >= 500)
        throw new BadRequestException('最多可收藏500个网站');
      return publicFields(
        await repo.save(
          repo.create({
            ...values,
            userId: owner,
            sortOrder: (rows[0]?.sortOrder ?? -1) + 1,
            version: 1,
          }),
        ),
      );
    });
  }

  async updateBookmark(
    userId: unknown,
    id: string,
    input: UpdateSearchBookmarkDto,
  ) {
    const owner = this.owner(userId);
    this.id(id);
    return this.write(owner, async (manager) => {
      const repo = manager.getRepository(SearchBookmark);
      const current = await repo.findOneBy({ userId: owner, id });
      if (!current) throw new NotFoundException('收藏不存在');
      if (input.version !== current.version)
        throw new ConflictException('收藏已更新，请重新加载后编辑');
      const changes = Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => key !== 'version' && value !== undefined,
        ),
      );
      const values = this.bookmarkValues({ ...current, ...changes });
      return publicFields(
        await repo.save({
          ...current,
          ...values,
          version: current.version + 1,
        }),
      );
    });
  }

  async deleteBookmark(userId: unknown, id: string) {
    const owner = this.owner(userId);
    this.id(id);
    return this.write(owner, async (manager) => {
      const result = await manager
        .getRepository(SearchBookmark)
        .delete({ userId: owner, id });
      if (!result.affected) throw new NotFoundException('收藏不存在');
      return { id };
    });
  }

  async reorder(userId: unknown, ids: string[]) {
    const owner = this.owner(userId);
    if (
      !Array.isArray(ids) ||
      ids.length > 500 ||
      new Set(ids).size !== ids.length
    )
      throw new BadRequestException('无效的收藏顺序');
    ids.forEach((id) => this.id(id));
    return this.write(owner, async (manager) => {
      const repo = manager.getRepository(SearchBookmark);
      const rows = await repo.find({ where: { userId: owner } });
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      if (rows.length !== ids.length || ids.some((id) => !byId.has(id)))
        throw new ConflictException('收藏列表已变化，请刷新后排序');
      const sorted = ids.map((id, sortOrder) => ({
        ...byId.get(id)!,
        sortOrder,
        version: byId.get(id)!.version + 1,
      }));
      return {
        items: (sorted.length ? await repo.save(sorted) : []).map(publicFields),
      };
    });
  }

  async search(userId: unknown, input: CreateSearchDto) {
    const owner = this.owner(userId);
    const target = createSearchTarget(input.query, input.engine);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.requestId,
      ) ||
      (input.source !== undefined && input.source !== '/search')
    )
      throw new BadRequestException('无效的搜索请求');
    const repo = this.dataSource.getRepository(SearchHistory);
    const criteria = {
      userId: owner,
      requestId: input.requestId.toLowerCase(),
    };
    let row = await repo.findOneBy(criteria);
    if (!row) {
      try {
        row = await repo.save(
          repo.create({ ...criteria, ...target, source: '/search' }),
        );
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') throw error;
        row = await repo.findOneBy(criteria);
        if (!row) throw error;
      }
    }
    if (
      row.query !== target.query ||
      row.engine !== target.engine ||
      row.source !== '/search'
    )
      throw new ConflictException('搜索请求标识已被使用，请重新发起搜索');
    return {
      historyId: String(row.id),
      targetUrl: row.targetUrl,
      createdAt: row.createdAt,
    };
  }

  async history(userId: unknown, input: SearchHistoryQueryDto) {
    const owner = this.owner(userId);
    const limit = input.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      throw new BadRequestException('无效的分页大小');
    const query = this.dataSource
      .getRepository(SearchHistory)
      .createQueryBuilder('history')
      .where('history.user_id = :owner', { owner });
    if (input.cursor) {
      try {
        const parsed = JSON.parse(
          Buffer.from(input.cursor, 'base64url').toString(),
        ) as { id: string; createdAt: string };
        if (
          typeof parsed.id !== 'string' ||
          !/^[1-9]\d*$/.test(parsed.id) ||
          BigInt(parsed.id) > 9223372036854775807n ||
          typeof parsed.createdAt !== 'string' ||
          new Date(parsed.createdAt).toISOString() !== parsed.createdAt
        )
          throw new Error();
        query.andWhere(
          '(history.created_at < :createdAt OR (history.created_at = :createdAt AND history.id < :id))',
          parsed,
        );
      } catch {
        throw new BadRequestException('无效的分页游标');
      }
    }
    const rows = await query
      .orderBy('history.created_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .take(limit + 1)
      .getMany();
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({
              id: String(last.id),
              createdAt: last.createdAt.toISOString(),
            }),
          ).toString('base64url')
        : null;
    return {
      items: items.map((row) => {
        const { requestId, ...fields } = publicFields(row);
        return fields;
      }),
      nextCursor,
    };
  }

  async deleteHistory(userId: unknown, id: string) {
    const result = await this.dataSource
      .getRepository(SearchHistory)
      .delete({ userId: this.owner(userId), id: this.id(id) });
    if (!result.affected) throw new NotFoundException('搜索记录不存在');
    return { id };
  }

  async clearHistory(userId: unknown) {
    const result = await this.dataSource
      .getRepository(SearchHistory)
      .delete({ userId: this.owner(userId) });
    return { deletedCount: result.affected ?? 0 };
  }
}
