import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateWorkRecordDto } from './dto/create-work-record.dto';
import { CreateWorkRecordThemeDto } from './dto/create-work-record-theme.dto';
import { ExportWorkRecordsQueryDto } from './dto/export-work-records-query.dto';
import { ImportWorkRecordsDto } from './dto/import-work-records.dto';
import { PatchWorkRecordDto } from './dto/patch-work-record.dto';
import { UpdateWorkRecordDto } from './dto/update-work-record.dto';
import { WorkRecord } from './entities/work-record.entity';
import { WorkRecordTheme } from './entities/work-record-theme.entity';

type ExportFormat = 'txt' | 'json' | 'pdf';

type ThemeDetail = {
  id: number;
  themeKey: string;
  themeName: string;
  color: string;
  isSystem: boolean;
  sortNo: number;
};

type RecordDetail = {
  id: number;
  recordDate: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  contentMd: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  theme: {
    id: number;
    themeKey: string;
    themeName: string;
    color: string;
    isSystem: boolean;
  } | null;
};

type ContributionDay = {
  date: string;
  records: number;
  level: 0 | 1 | 2 | 3 | 4;
};

@Injectable()
export class WorkRecordsService {
  constructor(
    @InjectRepository(WorkRecord)
    private readonly workRecordRepository: Repository<WorkRecord>,
    @InjectRepository(WorkRecordTheme)
    private readonly workRecordThemeRepository: Repository<WorkRecordTheme>,
  ) {}
  async getThemeList(userIdInput: number | string): Promise<ThemeDetail[]> {
    const userId = this.normalizeUserId(userIdInput);

    const themes = await this.workRecordThemeRepository
      .createQueryBuilder('theme')
      .where('theme.owner_user_id = :userId AND theme.is_system = false', {
        userId,
      })
      .orWhere('theme.owner_user_id = 0 AND theme.is_system = true')
      .orderBy('theme.is_system', 'ASC')
      .addOrderBy('theme.sort_no', 'ASC')
      .addOrderBy('theme.id', 'ASC')
      .getMany();

    return themes.map((theme) => this.mapThemeDetail(theme));
  }

  async createTheme(
    userIdInput: number | string,
    payload: CreateWorkRecordThemeDto,
  ): Promise<ThemeDetail> {
    const userId = this.normalizeUserId(userIdInput);
    const themeName = this.normalizeThemeName(payload?.themeName);
    const color = this.normalizeColor(payload?.color);
    const themeKey = await this.resolveThemeKeyForCreate(userId, payload);
    const sortNo = await this.resolveSortNoForCreate(userId, payload?.sortNo);

    const entity = this.workRecordThemeRepository.create({
      owner_user_id: userId,
      theme_key: themeKey,
      theme_name: themeName,
      color,
      is_system: false,
      sort_no: sortNo,
    });

    const saved = await this.workRecordThemeRepository.save(entity);
    return this.mapThemeDetail(saved);
  }
  async getCalendarSummary(
    userIdInput: number | string,
    startDateInput: string,
    endDateInput: string,
  ) {
    const userId = this.normalizeUserId(userIdInput);
    const startDate = this.normalizeDate(startDateInput, 'startDate');
    const endDate = this.normalizeDate(endDateInput, 'endDate');
    this.ensureDateRange(startDate, endDate);

    const rows = await this.workRecordRepository
      .createQueryBuilder('record')
      .leftJoin('record.theme', 'theme')
      .select('record.id', 'id')
      .addSelect('record.record_date', 'recordDate')
      .addSelect('theme.color', 'color')
      .where('record.user_id = :userId', { userId })
      .andWhere('record.deleted_at IS NULL')
      .andWhere('record.record_date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('record.record_date', 'ASC')
      .addOrderBy('record.start_time', 'ASC', 'NULLS LAST')
      .addOrderBy('record.created_at', 'ASC')
      .getRawMany<{ id: string; recordDate: string; color: string }>();

    return rows.map((row) => ({
      id: Number(row.id),
      recordDate: row.recordDate,
      color: row.color,
    }));
  }

  async getContributions(
    userIdInput: number | string,
    yearInput: number | string,
  ): Promise<ContributionDay[]> {
    const userId = this.normalizeUserId(userIdInput);
    const year = this.normalizeContributionYear(yearInput);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const contributionDays = this.isLeapYear(year) ? 366 : 365;

    const rows = await this.workRecordRepository
      .createQueryBuilder('record')
      .select('record.record_date', 'date')
      .addSelect('COUNT(record.id)', 'records')
      .where('record.user_id = :userId', { userId })
      .andWhere('record.deleted_at IS NULL')
      .andWhere('record.record_date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('record.record_date')
      .orderBy('record.record_date', 'ASC')
      .getRawMany<{ date: string; records: string }>();

    const recordCountByDate = new Map(
      rows.map((row) => [row.date, Number(row.records)]),
    );

    return Array.from({ length: contributionDays }, (_, index) => {
      const date = this.shiftDate(startDate, index);
      const records = recordCountByDate.get(date) ?? 0;

      return {
        date,
        records,
        level: this.getContributionLevel(records),
      };
    });
  }

  async getRecordsByDate(userIdInput: number | string, dateInput: string) {
    const userId = this.normalizeUserId(userIdInput);
    const date = this.normalizeDate(dateInput, 'date');

    const records = await this.workRecordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.theme', 'theme')
      .where('record.user_id = :userId', { userId })
      .andWhere('record.deleted_at IS NULL')
      .andWhere('record.record_date = :date', { date })
      .orderBy('record.start_time', 'ASC', 'NULLS LAST')
      .addOrderBy('record.created_at', 'ASC')
      .getMany();

    return records.map((record) => this.mapRecordDetail(record));
  }

  async getRecordDetail(
    userIdInput: number | string,
    idInput: string | number,
  ) {
    const userId = this.normalizeUserId(userIdInput);
    const recordId = this.normalizeNumericId(idInput, 'id');

    const record = await this.findActiveRecordWithTheme(userId, recordId);
    return this.mapRecordDetail(record);
  }

  async createRecord(
    userIdInput: number | string,
    payload: CreateWorkRecordDto,
  ): Promise<RecordDetail> {
    const userId = this.normalizeUserId(userIdInput);

    const recordDate = this.normalizeDate(payload?.recordDate, 'recordDate');
    const title = this.normalizeTitle(payload?.title);
    const themeId =
      payload?.themeId === undefined
        ? undefined
        : this.normalizeNumericId(payload.themeId, 'themeId');

    const startTime = this.normalizeOptionalTime(
      payload?.startTime,
      'startTime',
    );
    const endTime = this.normalizeOptionalTime(payload?.endTime, 'endTime');
    this.ensureTimeRange(startTime, endTime);

    const contentMd = this.normalizeNullableText(
      payload?.contentMd,
      'contentMd',
    );
    const theme = await this.resolveThemeForUser(userId, themeId);

    const entity = this.workRecordRepository.create({
      user_id: userId,
      record_date: recordDate,
      title,
      theme_id: Number(theme.id),
      start_time: startTime,
      end_time: endTime,
      content_md: contentMd,
    });

    const saved = await this.workRecordRepository.save(entity);
    return this.getRecordDetail(userId, Number(saved.id));
  }

  async replaceRecord(
    userIdInput: number | string,
    idInput: string | number,
    payload: UpdateWorkRecordDto,
  ): Promise<RecordDetail> {
    const userId = this.normalizeUserId(userIdInput);
    const id = this.normalizeNumericId(idInput, 'id');

    if (payload?.recordDate === undefined) {
      throw new BadRequestException('recordDate is required for PUT');
    }
    if (payload?.title === undefined) {
      throw new BadRequestException('title is required for PUT');
    }
    if (payload?.themeId === undefined) {
      throw new BadRequestException('themeId is required for PUT');
    }

    const record = await this.findActiveRecord(userId, id);

    const recordDate = this.normalizeDate(payload.recordDate, 'recordDate');
    const title = this.normalizeTitle(payload.title);
    const themeId = this.normalizeNumericId(payload.themeId, 'themeId');
    const theme = await this.resolveThemeForUser(userId, themeId);

    const startTime = this.normalizeOptionalTime(
      payload.startTime,
      'startTime',
    );
    const endTime = this.normalizeOptionalTime(payload.endTime, 'endTime');
    this.ensureTimeRange(startTime, endTime);

    const contentMd = this.normalizeNullableText(
      payload.contentMd,
      'contentMd',
    );

    record.record_date = recordDate;
    record.title = title;
    record.theme_id = Number(theme.id);
    record.start_time = startTime;
    record.end_time = endTime;
    record.content_md = contentMd;
    record.version = Number(record.version || 0) + 1;

    await this.workRecordRepository.save(record);
    return this.getRecordDetail(userId, id);
  }

  async patchRecord(
    userIdInput: number | string,
    idInput: string | number,
    payload: PatchWorkRecordDto,
  ): Promise<RecordDetail> {
    const userId = this.normalizeUserId(userIdInput);
    const id = this.normalizeNumericId(idInput, 'id');
    const record = await this.findActiveRecord(userId, id);

    const keys = [
      'recordDate',
      'title',
      'themeId',
      'startTime',
      'endTime',
      'contentMd',
    ];
    const hasAnyField = keys.some((key) =>
      Object.prototype.hasOwnProperty.call(payload ?? {}, key),
    );

    if (!hasAnyField) {
      throw new BadRequestException('PATCH payload is empty');
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'recordDate')) {
      record.record_date = this.normalizeDate(payload.recordDate, 'recordDate');
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
      record.title = this.normalizeTitle(payload.title);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'themeId')) {
      const themeId = this.normalizeNumericId(payload.themeId, 'themeId');
      const theme = await this.resolveThemeForUser(userId, themeId);
      record.theme_id = Number(theme.id);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'contentMd')) {
      record.content_md = this.normalizeNullableText(
        payload.contentMd,
        'contentMd',
      );
    }

    const hasStartTime = Object.prototype.hasOwnProperty.call(
      payload,
      'startTime',
    );
    const hasEndTime = Object.prototype.hasOwnProperty.call(payload, 'endTime');

    if (hasStartTime || hasEndTime) {
      const nextStart = hasStartTime
        ? this.normalizeOptionalTime(payload.startTime, 'startTime')
        : this.normalizeStoredTime(record.start_time);
      const nextEnd = hasEndTime
        ? this.normalizeOptionalTime(payload.endTime, 'endTime')
        : this.normalizeStoredTime(record.end_time);

      this.ensureTimeRange(nextStart, nextEnd);
      record.start_time = nextStart;
      record.end_time = nextEnd;
    }

    record.version = Number(record.version || 0) + 1;

    await this.workRecordRepository.save(record);
    return this.getRecordDetail(userId, id);
  }

  async deleteRecord(userIdInput: number | string, idInput: string | number) {
    const userId = this.normalizeUserId(userIdInput);
    const id = this.normalizeNumericId(idInput, 'id');
    const record = await this.findActiveRecord(userId, id);

    const deletedAt = new Date();
    record.deleted_at = deletedAt;
    record.version = Number(record.version || 0) + 1;

    await this.workRecordRepository.save(record);

    return {
      id,
      deletedAt,
    };
  }

  async importRecords(
    userIdInput: number | string,
    payload: ImportWorkRecordsDto | CreateWorkRecordDto[],
  ) {
    const userId = this.normalizeUserId(userIdInput);
    const records = this.normalizeImportPayload(payload);

    if (records.length === 0) {
      throw new BadRequestException('records cannot be empty');
    }

    const createdIds: number[] = [];
    const errors: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < records.length; i += 1) {
      try {
        const created = await this.createRecord(userId, records[i]);
        createdIds.push(created.id);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Failed to import record';
        errors.push({ index: i, reason });
      }
    }

    return {
      total: records.length,
      succeeded: createdIds.length,
      failed: errors.length,
      createdIds,
      errors,
    };
  }

  async exportRecords(
    userIdInput: number | string,
    query: ExportWorkRecordsQueryDto,
  ) {
    const userId = this.normalizeUserId(userIdInput);
    const startDate = this.normalizeDate(query?.startDate, 'startDate');
    const endDate = this.normalizeDate(query?.endDate, 'endDate');
    this.ensureDateRange(startDate, endDate);

    const format = this.normalizeExportFormat(query?.format);
    const records = await this.workRecordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.theme', 'theme')
      .where('record.user_id = :userId', { userId })
      .andWhere('record.deleted_at IS NULL')
      .andWhere('record.record_date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('record.record_date', 'ASC')
      .addOrderBy('record.start_time', 'ASC', 'NULLS LAST')
      .addOrderBy('record.created_at', 'ASC')
      .getMany();

    const mapped = records.map((record) => this.mapRecordDetail(record));

    if (format === 'txt') {
      const fileName = `work-records_${startDate}_${endDate}.txt`;
      const content = this.buildTxtContent(startDate, endDate, mapped);
      return {
        fileName,
        contentType: 'text/plain; charset=utf-8',
        buffer: Buffer.from(content, 'utf-8'),
      };
    }

    if (format === 'pdf') {
      const fileName = `work-records_${startDate}_${endDate}.pdf`;
      const lines = this.buildPdfLines(startDate, endDate, mapped);
      return {
        fileName,
        contentType: 'application/pdf',
        buffer: this.buildSimplePdf(lines),
      };
    }

    const fileName = `work-records_${startDate}_${endDate}.json`;
    const json = JSON.stringify(
      {
        startDate,
        endDate,
        total: mapped.length,
        records: mapped,
      },
      null,
      2,
    );

    return {
      fileName,
      contentType: 'application/json; charset=utf-8',
      buffer: Buffer.from(json, 'utf-8'),
    };
  }

  private normalizeUserId(userIdInput: number | string): number {
    const userId = Number(userIdInput);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid user id from token payload');
    }
    return userId;
  }

  private normalizeContributionYear(value: number | string): number {
    const normalized = String(value ?? '').trim();
    if (!/^\d{4}$/.test(normalized)) {
      throw new BadRequestException('year must be a four-digit year');
    }

    const year = Number(normalized);
    if (year < 1) {
      throw new BadRequestException('year must be a four-digit year');
    }

    return year;
  }

  private isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  private shiftDate(date: string, days: number): string {
    const shifted = new Date(`${date}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  }

  private getContributionLevel(records: number): 0 | 1 | 2 | 3 | 4 {
    if (records === 0) return 0;
    if (records === 1) return 1;
    if (records <= 3) return 2;
    if (records <= 6) return 3;
    return 4;
  }

  private normalizeNumericId(value: unknown, fieldName: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(`${fieldName} must be a positive integer`);
    }
    return id;
  }

  private normalizeDate(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        `${fieldName} must be a valid date string in YYYY-MM-DD format`,
      );
    }

    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        `${fieldName} must be a valid date string in YYYY-MM-DD format`,
      );
    }

    return value;
  }

  private ensureDateRange(startDate: string, endDate: string) {
    if (startDate > endDate) {
      throw new BadRequestException('startDate cannot be later than endDate');
    }
  }

  private mapThemeDetail(theme: WorkRecordTheme): ThemeDetail {
    return {
      id: Number(theme.id),
      themeKey: theme.theme_key,
      themeName: theme.theme_name,
      color: theme.color,
      isSystem: !!theme.is_system,
      sortNo: Number(theme.sort_no || 0),
    };
  }

  private normalizeThemeName(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('themeName must be a string');
    }

    const themeName = value.trim();
    if (!themeName) {
      throw new BadRequestException('themeName cannot be empty');
    }

    if (themeName.length > 50) {
      throw new BadRequestException('themeName cannot exceed 50 characters');
    }

    return themeName;
  }

  private normalizeColor(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('color must be a string');
    }

    const color = value.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new BadRequestException('color must follow #RRGGBB format');
    }

    return color.toUpperCase();
  }

  private normalizeThemeKey(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('themeKey must be a string');
    }

    const themeKey = value.trim().toLowerCase();
    if (!themeKey) {
      throw new BadRequestException('themeKey cannot be empty');
    }

    if (themeKey.length > 64) {
      throw new BadRequestException('themeKey cannot exceed 64 characters');
    }

    if (!/^[a-z0-9][a-z0-9-_]*$/.test(themeKey)) {
      throw new BadRequestException(
        'themeKey only allows lowercase letters, numbers, hyphen and underscore',
      );
    }

    return themeKey;
  }

  private async resolveThemeKeyForCreate(
    userId: number,
    payload: CreateWorkRecordThemeDto,
  ) {
    if (
      payload?.themeKey !== undefined &&
      payload.themeKey !== null &&
      payload.themeKey !== ''
    ) {
      const candidate = this.normalizeThemeKey(payload.themeKey);
      const duplicated = await this.workRecordThemeRepository.exists({
        where: {
          owner_user_id: userId,
          theme_key: candidate,
        },
      });

      if (duplicated) {
        throw new BadRequestException(
          'themeKey already exists for current user',
        );
      }

      return candidate;
    }

    const base =
      this.normalizeThemeName(payload?.themeName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'theme';

    let index = 0;
    while (index < 9999) {
      const suffix = index === 0 ? '' : `-${index + 1}`;
      const candidate = `${base}${suffix}`;
      const duplicated = await this.workRecordThemeRepository.exists({
        where: {
          owner_user_id: userId,
          theme_key: candidate,
        },
      });

      if (!duplicated) {
        return candidate;
      }

      index += 1;
    }

    throw new BadRequestException('Unable to generate unique themeKey');
  }

  private async resolveSortNoForCreate(userId: number, inputSortNo: unknown) {
    if (
      inputSortNo === undefined ||
      inputSortNo === null ||
      inputSortNo === ''
    ) {
      const row = await this.workRecordThemeRepository
        .createQueryBuilder('theme')
        .select('COALESCE(MAX(theme.sort_no), 0)', 'maxSortNo')
        .where('theme.owner_user_id = :userId AND theme.is_system = false', {
          userId,
        })
        .getRawOne<{ maxSortNo: string }>();

      return Number(row?.maxSortNo ?? 0) + 1;
    }

    const sortNo = Number(inputSortNo);
    if (!Number.isInteger(sortNo)) {
      throw new BadRequestException('sortNo must be an integer');
    }

    return sortNo;
  }
  private normalizeTitle(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('title must be a string');
    }

    const title = value.trim();
    if (!title) {
      throw new BadRequestException('title cannot be empty');
    }

    if (title.length > 80) {
      throw new BadRequestException('title cannot exceed 80 characters');
    }

    return title;
  }

  private normalizeOptionalTime(
    value: unknown,
    fieldName: string,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string or null`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const matched = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
    if (!matched) {
      throw new BadRequestException(
        `${fieldName} must follow HH:mm or HH:mm:ss format`,
      );
    }

    const minutes = Number(matched[2]);
    const seconds = matched[3] ? Number(matched[3]) : 0;

    if (minutes % 5 !== 0 || seconds !== 0) {
      throw new BadRequestException(
        `${fieldName} must align to 5-minute steps with zero seconds`,
      );
    }

    return `${matched[1]}:${matched[2]}:00`;
  }

  private normalizeStoredTime(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = String(value).trim();
    const matched = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
    if (!matched) {
      return null;
    }

    return `${matched[1]}:${matched[2]}:00`;
  }

  private ensureTimeRange(startTime: string | null, endTime: string | null) {
    const hasStart = !!startTime;
    const hasEnd = !!endTime;

    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'startTime and endTime must both be provided or both be null',
      );
    }

    if (startTime && endTime && startTime >= endTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }
  }

  private normalizeNullableText(
    value: unknown,
    fieldName: string,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string or null`);
    }

    return value;
  }

  private async findActiveRecord(
    userId: number,
    id: number,
  ): Promise<WorkRecord> {
    const record = await this.workRecordRepository.findOne({
      where: {
        id,
        user_id: userId,
        deleted_at: IsNull(),
      },
    });

    if (!record) {
      throw new NotFoundException('Work record not found');
    }

    return record;
  }

  private async findActiveRecordWithTheme(userId: number, id: number) {
    const record = await this.workRecordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.theme', 'theme')
      .where('record.id = :id', { id })
      .andWhere('record.user_id = :userId', { userId })
      .andWhere('record.deleted_at IS NULL')
      .getOne();

    if (!record) {
      throw new NotFoundException('Work record not found');
    }

    return record;
  }

  private async resolveThemeForUser(userId: number, themeId?: number) {
    if (themeId !== undefined) {
      const theme = await this.workRecordThemeRepository.findOne({
        where: { id: themeId },
      });

      if (!theme) {
        throw new NotFoundException('Theme not found');
      }

      if (!this.isThemeAvailableToUser(theme, userId)) {
        throw new ForbiddenException('Theme does not belong to current user');
      }

      return theme;
    }

    const fallbackTheme = await this.workRecordThemeRepository
      .createQueryBuilder('theme')
      .where('theme.owner_user_id = :userId AND theme.is_system = false', {
        userId,
      })
      .orWhere('theme.owner_user_id = 0 AND theme.is_system = true')
      .orderBy('theme.is_system', 'ASC')
      .addOrderBy('theme.sort_no', 'ASC')
      .addOrderBy('theme.id', 'ASC')
      .getOne();

    if (!fallbackTheme) {
      throw new NotFoundException('No available theme for current user');
    }

    return fallbackTheme;
  }

  private isThemeAvailableToUser(theme: WorkRecordTheme, userId: number) {
    const ownerUserId = Number(theme.owner_user_id);
    const isSystemTheme = theme.is_system && ownerUserId === 0;
    const isUserTheme = !theme.is_system && ownerUserId === userId;

    return isSystemTheme || isUserTheme;
  }

  private mapRecordDetail(record: WorkRecord): RecordDetail {
    const theme = (record as WorkRecord & { theme?: WorkRecordTheme }).theme;

    return {
      id: Number(record.id),
      recordDate: record.record_date,
      title: record.title,
      startTime: this.normalizeStoredTime(record.start_time),
      endTime: this.normalizeStoredTime(record.end_time),
      contentMd: record.content_md ?? null,
      version: Number(record.version || 0),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      theme: theme
        ? {
            id: Number(theme.id),
            themeKey: theme.theme_key,
            themeName: theme.theme_name,
            color: theme.color,
            isSystem: !!theme.is_system,
          }
        : null,
    };
  }

  private normalizeImportPayload(
    payload: ImportWorkRecordsDto | CreateWorkRecordDto[],
  ): CreateWorkRecordDto[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.records)) {
      return payload.records;
    }

    throw new BadRequestException(
      'import payload must be an array or object with records array',
    );
  }

  private normalizeExportFormat(format: unknown): ExportFormat {
    if (format === undefined || format === null || format === '') {
      return 'json';
    }

    if (typeof format !== 'string') {
      throw new BadRequestException('format must be txt, json, or pdf');
    }

    const normalized = format.toLowerCase();
    if (normalized !== 'txt' && normalized !== 'json' && normalized !== 'pdf') {
      throw new BadRequestException('format must be txt, json, or pdf');
    }

    return normalized;
  }

  private buildTxtContent(
    startDate: string,
    endDate: string,
    records: RecordDetail[],
  ): string {
    const lines: string[] = [];
    lines.push(`Work Records Export (${startDate} ~ ${endDate})`);
    lines.push(`Total: ${records.length}`);
    lines.push('');

    records.forEach((record, index) => {
      const timePart =
        record.startTime && record.endTime
          ? `${record.startTime.slice(0, 5)}-${record.endTime.slice(0, 5)}`
          : 'ALL_DAY';
      const themePart = record.theme
        ? `${record.theme.themeName}(${record.theme.color})`
        : 'N/A';

      lines.push(
        `${index + 1}. [${record.recordDate}] [${timePart}] ${record.title} (ID: ${record.id}, Theme: ${themePart})`,
      );

      if (record.contentMd) {
        lines.push(`   ${record.contentMd.replace(/\r?\n/g, ' ')}`);
      }
    });

    return lines.join('\n');
  }

  private buildPdfLines(
    startDate: string,
    endDate: string,
    records: RecordDetail[],
  ): string[] {
    const lines: string[] = [];
    lines.push(`Work Records Export (${startDate} ~ ${endDate})`);
    lines.push(`Total: ${records.length}`);
    lines.push('');

    records.forEach((record, index) => {
      const timePart =
        record.startTime && record.endTime
          ? `${record.startTime.slice(0, 5)}-${record.endTime.slice(0, 5)}`
          : 'ALL_DAY';

      lines.push(
        `${index + 1}. ${record.recordDate} ${timePart} ${record.title} [ID:${record.id}]`,
      );

      if (record.contentMd) {
        const merged = record.contentMd.replace(/\r?\n/g, ' ');
        lines.push(`   ${merged}`);
      }
    });

    return lines;
  }

  private escapePdfText(input: string) {
    return input
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  private buildSimplePdf(lines: string[]): Buffer {
    const safeLines = lines.length > 0 ? lines : ['No data'];
    const pageSize = 45;
    const pages: string[][] = [];

    for (let i = 0; i < safeLines.length; i += pageSize) {
      pages.push(safeLines.slice(i, i + pageSize));
    }

    const contentStreams = pages.map((pageLines) => {
      const chunks = ['BT', '/F1 11 Tf', '50 792 Td'];

      pageLines.forEach((line, index) => {
        if (index > 0) {
          chunks.push('0 -16 Td');
        }
        chunks.push(`(${this.escapePdfText(line)}) Tj`);
      });

      chunks.push('ET');
      return chunks.join('\n');
    });

    const objects: string[] = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    const kids: string[] = [];
    let objectPointer = 4;

    contentStreams.forEach((streamContent) => {
      const pageObject = objectPointer;
      const contentObject = objectPointer + 1;
      objectPointer += 2;

      kids.push(`${pageObject} 0 R`);

      objects[pageObject] =
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;

      const length = Buffer.byteLength(streamContent, 'ascii');
      objects[contentObject] =
        `<< /Length ${length} >>\nstream\n${streamContent}\nendstream`;
    });

    objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${contentStreams.length} >>`;

    const objectCount = objects.length - 1;
    let pdf = '%PDF-1.4\n';
    const offsets = new Array<number>(objectCount + 1).fill(0);

    for (let i = 1; i <= objectCount; i += 1) {
      offsets[i] = Buffer.byteLength(pdf, 'ascii');
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'ascii');
    pdf += `xref\n0 ${objectCount + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (let i = 1; i <= objectCount; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'ascii');
  }
}
