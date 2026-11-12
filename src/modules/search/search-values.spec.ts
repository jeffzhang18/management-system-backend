import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSearchDto, UpdateSearchSettingsDto } from './search.dto';
import {
  createSearchTarget,
  DEFAULT_SEARCH_SETTINGS,
  normalizeSearchUrl,
  validateSearchSettings,
} from './search-values';

describe('Search values', () => {
  it('validates gradient colors and angles even outside gradient mode', () => {
    expect(
      validateSearchSettings({
        ...DEFAULT_SEARCH_SETTINGS,
        backgroundMode: 'gradient',
        gradientFrom: '#ABCDEF',
        gradientTo: '#123456',
        gradientAngle: 359,
      }),
    ).toMatchObject({ backgroundMode: 'gradient', gradientAngle: 359 });
    for (const patch of [
      { gradientFrom: 'red' },
      { gradientTo: '#fff' },
      { gradientFrom: null },
      { gradientAngle: -1 },
      { gradientAngle: 360 },
      { gradientAngle: 0.5 },
      { gradientAngle: null },
    ]) {
      expect(() =>
        validateSearchSettings({
          ...DEFAULT_SEARCH_SETTINGS,
          ...patch,
        } as typeof DEFAULT_SEARCH_SETTINGS),
      ).toThrow(BadRequestException);
    }
    expect(
      validateSync(
        plainToInstance(UpdateSearchSettingsDto, {
          version: 0,
          backgroundMode: 'gradient',
          gradientFrom: '#ABCDEF',
          gradientTo: '#123456',
          gradientAngle: 90,
        }),
      ),
    ).toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(UpdateSearchSettingsDto, {
          version: 0,
          gradientFrom: 'red',
          gradientAngle: 360,
        }),
      ),
    ).not.toHaveLength(0);
  });
  it.each([
    ['google', 'www.google.com', 'q'],
    ['baidu', 'www.baidu.com', 'wd'],
    ['bing', 'www.bing.com', 'q'],
  ])(
    'encodes user input without changing the %s destination',
    (engine, host, key) => {
      const target = createSearchTarget(' 中文 & a+b? # / ', engine);
      const url = new URL(target.targetUrl);
      expect(url.hostname).toBe(host);
      expect(url.searchParams.get(key)).toBe('中文 & a+b? # /');
      expect([...url.searchParams]).toHaveLength(1);
    },
  );
  it.each(['__proto__', 'constructor', 'https://evil.example', null])(
    'rejects an untrusted engine %s',
    (engine) => {
      expect(() => createSearchTarget('hello', engine)).toThrow(
        BadRequestException,
      );
    },
  );
  it.each(['', '  ', 'x'.repeat(1001), null])(
    'rejects invalid queries',
    (query) => {
      expect(() => createSearchTarget(query, 'google')).toThrow(
        BadRequestException,
      );
    },
  );
  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,xxx',
    'file:///tmp/x',
    'blob:https://example.com/x',
    'https://user:pass@example.com/a',
    'https://example.com/' + 'x'.repeat(2048),
  ])('rejects unsupported URL %s', (url) => {
    expect(() => normalizeSearchUrl(url)).toThrow(BadRequestException);
  });
  it('allows a manually saved intranet bookmark but only HTTPS images', () => {
    expect(normalizeSearchUrl('http://localhost:8080')).toBe(
      'http://localhost:8080/',
    );
    expect(() =>
      normalizeSearchUrl('http://example.com/icon.png', true),
    ).toThrow(BadRequestException);
    expect(normalizeSearchUrl(' https://example.com/icon.ico ', true)).toBe(
      'https://example.com/icon.ico',
    );
  });
  it('validates combined settings and rejects null optional scalar values', () => {
    expect(validateSearchSettings({ ...DEFAULT_SEARCH_SETTINGS })).toEqual(
      DEFAULT_SEARCH_SETTINGS,
    );
    expect(() =>
      validateSearchSettings({
        ...DEFAULT_SEARCH_SETTINGS,
        iconSize: 40,
        radius: 21,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateSearchSettings({
        ...DEFAULT_SEARCH_SETTINGS,
        backgroundMode: 'online',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateSearchSettings({
        ...DEFAULT_SEARCH_SETTINGS,
        openInNewTab: null as never,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateSearchSettings({ ...DEFAULT_SEARCH_SETTINGS, itemsPerLine: NaN }),
    ).toThrow(BadRequestException);
  });
  it('validates request IDs, unknown fields and optimistic versions at the DTO boundary', () => {
    expect(
      validateSync(
        plainToInstance(CreateSearchDto, {
          query: 'ok',
          engine: 'google',
          requestId: 'bad',
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      validateSync(plainToInstance(UpdateSearchSettingsDto, { iconSize: 80 })),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(CreateSearchDto, {
          query: 'ok',
          engine: 'google',
          requestId: '00000000-0000-4000-8000-000000000001',
          userId: '2',
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).not.toHaveLength(0);
  });
});
