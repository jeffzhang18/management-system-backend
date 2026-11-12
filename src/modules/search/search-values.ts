import { BadRequestException } from '@nestjs/common';
import type { SearchEngine, SearchSettings } from './search.entity';

type SettingsValues = Omit<SearchSettings, 'userId' | 'updatedAt'>;
export const DEFAULT_SEARCH_SETTINGS: Readonly<SettingsValues> = Object.freeze({
  version: 0,
  defaultEngine: 'google' as SearchEngine,
  openInNewTab: true,
  backgroundMode: 'default' as 'default' | 'online',
  wallpaperUrl: null as string | null,
  overlayOpacity: 0.3,
  iconSize: 72,
  gap: 24,
  radius: 20,
  layoutDirection: 'row' as 'row' | 'column',
  itemsPerLine: 8,
});

export function normalizeSearchUrl(value: unknown, image = false): string {
  if (typeof value !== 'string' || value.length > 2048 || !value.trim())
    throw new BadRequestException('请输入有效的网址');
  try {
    const url = new URL(value.trim());
    if (
      !(image ? ['https:'] : ['https:', 'http:']).includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      throw new Error();
    const result = url.href;
    if (result.length > 2048) throw new Error();
    return result;
  } catch {
    throw new BadRequestException(
      image
        ? '图片必须使用不含账号密码的 HTTPS 链接'
        : '网址必须使用不含账号密码的 HTTP 或 HTTPS 链接',
    );
  }
}

export function createSearchTarget(query: unknown, engine: unknown) {
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 1000)
    throw new BadRequestException('搜索内容须为1至1000个字符');
  const engines = {
    google: ['https://www.google.com/search', 'q'],
    baidu: ['https://www.baidu.com/s', 'wd'],
    bing: ['https://www.bing.com/search', 'q'],
  } as const;
  if (typeof engine !== 'string' || !Object.hasOwn(engines, engine))
    throw new BadRequestException('不支持此搜索引擎');
  const [base, key] = engines[engine as SearchEngine];
  const url = new URL(base);
  url.searchParams.set(key, query.trim());
  return {
    query: query.trim(),
    engine: engine as SearchEngine,
    targetUrl: url.href,
    targetHost: url.hostname,
  };
}

export function validateSearchSettings(value: typeof DEFAULT_SEARCH_SETTINGS) {
  if (
    !['google', 'baidu', 'bing'].includes(value.defaultEngine) ||
    typeof value.openInNewTab !== 'boolean' ||
    !['default', 'online'].includes(value.backgroundMode) ||
    !['row', 'column'].includes(value.layoutDirection)
  )
    throw new BadRequestException('无效的搜索设置');
  const ranges: [unknown, number, number, boolean][] = [
    [value.iconSize, 40, 112, true],
    [value.gap, 8, 48, true],
    [value.radius, 0, value.iconSize / 2, true],
    [value.itemsPerLine, 1, 12, true],
    [value.overlayOpacity, 0, 0.85, false],
  ];
  for (const [item, min, max, integer] of ranges) {
    if (
      typeof item !== 'number' ||
      !Number.isFinite(item) ||
      item < min ||
      item > max ||
      (integer && !Number.isInteger(item))
    )
      throw new BadRequestException('布局参数超出允许范围');
  }
  const wallpaperUrl =
    value.wallpaperUrl === null || value.wallpaperUrl === ''
      ? null
      : normalizeSearchUrl(value.wallpaperUrl, true);
  if (value.backgroundMode === 'online' && !wallpaperUrl)
    throw new BadRequestException('请填写在线壁纸链接');
  return { ...value, wallpaperUrl };
}
