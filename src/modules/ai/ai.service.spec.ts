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
      expect.objectContaining({ timeout: 120_000 }),
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

  it('disables thinking and does not send temperature to Kimi models', async () => {
    const config = new ConfigService({
      AI_PROVIDER: 'kimi',
      AI_API_KEY: 'test-key',
      AI_MODEL: 'kimi-k2.6',
    });
    const service = new AiService(config);

    await service.generateWorkReport(input);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.moonshot.cn/v1/chat/completions',
      expect.objectContaining({ thinking: { type: 'disabled' } }),
      expect.anything(),
    );
    const requestBody = mockedAxios.post.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(requestBody).not.toHaveProperty('temperature');
  });

  it('uses AI_TIMEOUT_MS when configured', async () => {
    const config = new ConfigService({
      AI_PROVIDER: 'glm',
      AI_API_KEY: 'test-key',
      AI_MODEL: 'glm-5.2',
      AI_TIMEOUT_MS: '180000',
    });
    const service = new AiService(config);

    await service.generateWorkReport(input);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ timeout: 180_000 }),
    );
  });

  it('requires a numbered-list report format in the system prompt', async () => {
    const config = new ConfigService({
      AI_PROVIDER: 'openai',
      AI_API_KEY: 'test-key',
      AI_MODEL: 'test-model',
    });
    const service = new AiService(config);

    await service.generateWorkReport(input);

    const requestBody = mockedAxios.post.mock.calls[0][1] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.messages[0].content).toContain(
      '从 1 开始的连续 Markdown 有序列表',
    );
    expect(requestBody.messages[0].content).toContain(
      '禁止输出标题、表格、分区、前言、总结',
    );
  });
});
