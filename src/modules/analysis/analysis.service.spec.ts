import { AnalysisService } from './analysis.service';

describe('AnalysisService', () => {
  it('returns daily page-view metrics and fills dates without data', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          date: '2026-09-01',
          pageViews: '2',
          totalTimeOnPageMs: '3000',
        },
        {
          date: '2026-09-03',
          pageViews: '1',
          totalTimeOnPageMs: '3000',
        },
      ]),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const userService = {
      findByEmail: jest.fn().mockResolvedValue({ user_id: 'user-1' }),
    };
    const service = new AnalysisService(
      repository as never,
      userService as never,
    );

    await expect(
      service.getPageViews('user@example.com', {
        startDate: '2026-09-01',
        endDate: '2026-09-03',
      }),
    ).resolves.toEqual({
      daily: [
        {
          date: '2026-09-01',
          pageViews: 2,
          totalTimeOnPageMs: 3000,
          averageTimeOnPageMs: 1500,
        },
        {
          date: '2026-09-02',
          pageViews: 0,
          totalTimeOnPageMs: 0,
          averageTimeOnPageMs: 0,
        },
        {
          date: '2026-09-03',
          pageViews: 1,
          totalTimeOnPageMs: 3000,
          averageTimeOnPageMs: 3000,
        },
      ],
      summary: {
        totalPageViews: 3,
        averageDailyPageViews: 1,
        totalTimeOnPageMs: 6000,
        averageTimeOnPageMs: 2000,
      },
      period: {
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        timezone: 'Asia/Shanghai',
      },
    });
  });
});
