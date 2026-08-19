import { Repository } from 'typeorm';
import { WorkRecord } from './entities/work-record.entity';
import { WorkRecordTheme } from './entities/work-record-theme.entity';
import { WorkRecordsService } from './work-records.service';

describe('WorkRecordsService contributions', () => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const workRecordRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
  } as unknown as Repository<WorkRecord>;
  const themeRepository = {} as Repository<WorkRecordTheme>;
  const service = new WorkRecordsService(workRecordRepository, themeRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a full year, fills missing dates and maps all five levels', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { date: '2026-01-01', records: '1' },
      { date: '2026-08-15', records: '2' },
      { date: '2026-08-16', records: '4' },
      { date: '2026-08-17', records: '7' },
    ]);

    const result = await service.getContributions(12, 2026);

    expect(result).toHaveLength(365);
    expect(result[0]).toEqual({
      date: '2026-01-01',
      records: 1,
      level: 1,
    });
    expect(result.at(-1)).toEqual({
      date: '2026-12-31',
      records: 0,
      level: 0,
    });
    expect(result.find((day) => day.date === '2026-08-15')?.level).toBe(2);
    expect(result.find((day) => day.date === '2026-08-16')?.level).toBe(3);
    expect(result.find((day) => day.date === '2026-08-17')?.level).toBe(4);
  });

  it('queries only active records for the current user and date range', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await service.getContributions('42', '2026');

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'record.user_id = :userId',
      { userId: 42 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'record.deleted_at IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'record.record_date BETWEEN :startDate AND :endDate',
      { startDate: '2026-01-01', endDate: '2026-12-31' },
    );
  });

  it('returns 366 days for a leap year', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    const result = await service.getContributions(12, 2024);

    expect(result).toHaveLength(366);
    expect(result[0].date).toBe('2024-01-01');
    expect(result.at(-1)?.date).toBe('2024-12-31');
    expect(result.some((day) => day.date === '2024-02-29')).toBe(true);
  });

  it('rejects an invalid year', async () => {
    await expect(service.getContributions(12, '26')).rejects.toThrow(
      'year must be a four-digit year',
    );
  });
});
