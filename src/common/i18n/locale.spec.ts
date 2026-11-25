import { getMessages, resolveLocale } from './locale';
import { LOCALES } from './lang';

describe('resolveLocale', () => {
  it('defaults to en-US when the header is missing or unsupported', () => {
    expect(resolveLocale(undefined)).toBe('en-US');
    expect(resolveLocale('')).toBe('en-US');
    expect(resolveLocale('fr-FR')).toBe('en-US');
  });

  it('maps zh and en variants', () => {
    expect(resolveLocale('zh-CN')).toBe('zh-CN');
    expect(resolveLocale('zh-TW')).toBe('zh-CN');
    expect(resolveLocale('en-US')).toBe('en-US');
  });

  it('honours quality values and order', () => {
    expect(resolveLocale('en;q=0.5,zh-CN;q=0.9')).toBe('zh-CN');
    expect(resolveLocale('fr,zh-CN;q=0.8,en;q=0.7')).toBe('zh-CN');
    expect(resolveLocale('zh-CN;q=0,en')).toBe('en-US');
  });
});

describe('getMessages', () => {
  it('returns messages for every registered locale', () => {
    for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      const verification = getMessages(locale).mail.verification;
      expect(verification.subject(verification.purposes.login)).toBeTruthy();
    }
  });

  it('falls back to the default locale for unknown values', () => {
    expect(getMessages('xx' as never)).toBe(getMessages('en-US'));
  });
});
