import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiService, GenerateWorkReportInput } from './ai.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiService', () => {
  const input: GenerateWorkReportInput = {
    startDate: '2026-08-17',
    endDate: '2026-08-21',
    reportType: 'WEEKLY_REPORT',
    outputFormat: 'MARKDOWN',
    language: 'zh-CN',
    records: [
      {
        recordDate: '2026-08-17',
        title: '完成周报接口',
        startTime: null,
        endTime: null,
        contentMd: '完成后端接口开发',
        themeName: '开发',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: '# 工作周报' } }] },
    });
  });

  it.each([
    ['openai', 'https://api.openai.com/v1/chat/completions'],
    ['deepseek', 'https://api.deepseek.com/chat/completions'],
    ['kimi', 'https://api.moonshot.cn/v1/chat/completions'],
    ['glm', 'https://open.bigmodel.cn/api/paas/v4/chat/completions'],
  ])('uses the preset endpoint for %s', async (provider, expectedUrl) => {
    const config = new ConfigService({
      AI_PROVIDER: provider,
      AI_API_KEY: 'test-key',
      AI_MODEL: 'test-model',
    });
    const service = new AiService(config);

    await expect(service.generateWorkReport(input)).resolves.toBe('# 工作周报');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({ model: 'test-model' }),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });

  it('prefers AI_BASE_URL over the provider preset', async () => {
    const config = new ConfigService({
      AI_PROVIDER: 'kimi',
      AI_BASE_URL: 'https://ai.example.com/v1/',
      AI_API_KEY: 'test-key',
      AI_MODEL: 'test-model',
    });
    const service = new AiService(config);

    await service.generateWorkReport(input);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://ai.example.com/v1/chat/completions',
      expect.anything(),
      expect.anything(),
    );
  });
});
