import type { Subscription } from './subscription.entity';

const DAY = 86_400_000;
export const shanghaiToday = (now = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now);

export function addDays(date: string, days: number): string {
  const result = Date.parse(`${date}T00:00:00Z`) + days * DAY;
  return new Date(Math.min(result, Date.parse('9999-12-31T00:00:00Z')))
    .toISOString()
    .slice(0, 10);
}

/** Every date is calculated from the original anchor, never the previous clamped date. */
export function cycleDate(
  s: Pick<Subscription, 'startDate' | 'cycleUnit' | 'cycleInterval'>,
  index: number,
): string {
  if (s.cycleUnit === 'once') return s.startDate;
  const distance = s.cycleInterval * index;
  if (s.cycleUnit === 'day') return addDays(s.startDate, distance);
  const [year, month, day] = s.startDate.split('-').map(Number);
  const months =
    year * 12 + month - 1 + distance * (s.cycleUnit === 'year' ? 12 : 1);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y > 9999) return '9999-12-31';
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)))
    .toISOString()
    .slice(0, 10);
}

export function effectiveEnd(s: Subscription): string | null {
  const paidEnd =
    s.cycleUnit !== 'once' && !s.autoRenew ? cycleDate(s, 1) : null;
  return paidEnd && (!s.endDate || paidEnd < s.endDate) ? paidEnd : s.endDate;
}

/** First renewal on or after today; the initial purchase is not a renewal. */
export function renewalIndex(s: Subscription, today: string): number {
  const days = Math.max(
    0,
    Math.floor((Date.parse(today) - Date.parse(s.startDate)) / DAY),
  );
  const [year, month] = today.split('-').map(Number);
  const [startYear, startMonth] = s.startDate.split('-').map(Number);
  const elapsedMonths = Math.max(
    0,
    (year - startYear) * 12 + month - startMonth,
  );
  const elapsed =
    s.cycleUnit === 'day'
      ? days
      : s.cycleUnit === 'year'
        ? elapsedMonths / 12
        : elapsedMonths;
  let low = 1;
  let high = Math.max(2, Math.ceil(elapsed / s.cycleInterval) + 2);
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (cycleDate(s, mid) < today) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function describeSubscription(s: Subscription, today: string) {
  const endsAt = effectiveEnd(s);
  const status =
    endsAt && endsAt <= today
      ? 'ended'
      : s.startDate > today
        ? 'scheduled'
        : 'active';
  let nextRenewalDate: string | null = null;
  if (status !== 'ended' && s.autoRenew && s.cycleUnit !== 'once') {
    const next = cycleDate(s, renewalIndex(s, today));
    if (!endsAt || next < endsAt) nextRenewalDate = next;
  }
  return {
    status,
    nextRenewalDate,
    expiresOn: endsAt,
    upcoming:
      status === 'active' &&
      !!nextRenewalDate &&
      nextRenewalDate < addDays(today, 7),
  };
}

export function renewalCount(
  s: Subscription,
  today: string,
  days = 30,
): number {
  if (!s.autoRenew || s.cycleUnit === 'once') return 0;
  const end = effectiveEnd(s);
  const limit = end && end < addDays(today, days) ? end : addDays(today, days);
  let count = 0;
  for (let index = renewalIndex(s, today); cycleDate(s, index) < limit; index++)
    count++;
  return count;
}

export type Fraction = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b ? gcd(b, a % b) : a);
export function fraction(n: bigint, d = 1n): Fraction {
  const divisor = gcd(n < 0n ? -n : n, d);
  return { n: n / divisor, d: d / divisor };
}
export const zero = (): Fraction => fraction(0n);
export const add = (a: Fraction, b: Fraction): Fraction =>
  fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const multiply = (a: Fraction, b: Fraction): Fraction =>
  fraction(a.n * b.n, a.d * b.d);
export function decimal(value: string): Fraction {
  const [whole, part = ''] = value.split('.');
  return fraction(BigInt(whole + part), 10n ** BigInt(part.length));
}
export function fixed(value: Fraction): string {
  const cents = (value.n * 100n * 2n + value.d) / (value.d * 2n);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
export function monthlyCost(s: Subscription): Fraction {
  if (s.cycleUnit === 'once') return zero();
  const interval = BigInt(s.cycleInterval);
  const factor =
    s.cycleUnit === 'day'
      ? fraction(365n, 12n * interval)
      : fraction(1n, interval * (s.cycleUnit === 'year' ? 12n : 1n));
  return multiply(decimal(s.amount), factor);
}
