import { LOCALES, type Locale } from './lang';
import type { LocaleDefinition } from './types';

export type { Locale };

export const DEFAULT_LOCALE: Locale = 'en-US';

const LOCALE_BY_LANGUAGE = new Map<string, Locale>(
  (Object.entries(LOCALES) as [Locale, LocaleDefinition][]).map(
    ([locale, definition]) => [definition.language, locale],
  ),
);

export function getMessages(locale: Locale = DEFAULT_LOCALE) {
  return (LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE]).messages;
}

export function resolveLocale(header?: string | string[]): Locale {
  const raw = Array.isArray(header) ? header.join(',') : header;
  if (!raw) return DEFAULT_LOCALE;
  const candidates = raw
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qParam ? Number(qParam.trim().slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split('-')[0],
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((item) => item.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { language } of candidates) {
    const locale = LOCALE_BY_LANGUAGE.get(language);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
