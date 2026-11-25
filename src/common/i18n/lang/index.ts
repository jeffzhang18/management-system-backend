import type { LocaleDefinition } from '../types';
import enUS from './en-US';
import zhCN from './zh-CN';

export const LOCALES = {
  'en-US': enUS,
  'zh-CN': zhCN,
} satisfies Record<string, LocaleDefinition>;

export type Locale = keyof typeof LOCALES;
