import {
  add,
  cycleDate,
  decimal,
  describeSubscription,
  fixed,
  monthlyCost,
  renewalCount,
  shanghaiToday,
} from './billing';
import { Subscription } from './subscription.entity';
import { validateCombined, validateInput } from './subscription-input';

export const subscriptionFixture = (
  overrides: Partial<Subscription> = {},
): Subscription => ({
  id: '1',
  userId: '10',
  name: 'Software',
  devices: ['phone', 'computer'],
  startDate: '2026-01-31',
  endDate: null,
  cycleUnit: 'month',
  cycleInterval: 1,
  amount: '20.00',
  currency: 'USD',
  autoRenew: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('Subscription date and billing rules', () => {
  it('clamps month ends without drifting away from the original anchor', () => {
    const item = subscriptionFixture();
    expect(cycleDate(item, 1)).toBe('2026-02-28');
    expect(cycleDate(item, 2)).toBe('2026-03-31');
    expect(describeSubscription(item, '2026-02-28').nextRenewalDate).toBe(
      '2026-02-28',
    );
    expect(describeSubscription(item, '2026-03-01').nextRenewalDate).toBe(
      '2026-03-31',
    );
  });

  it('retains February 29 as the yearly anchor', () => {
    const item = subscriptionFixture({
      startDate: '2024-02-29',
      cycleUnit: 'year',
    });
    expect(cycleDate(item, 1)).toBe('2025-02-28');
    expect(cycleDate(item, 4)).toBe('2028-02-29');
    expect(describeSubscription(item, '2026-11-04').nextRenewalDate).toBe(
      '2027-02-28',
    );
  });

  it('does not renew on the stop date', () => {
    const item = subscriptionFixture({ endDate: '2026-02-28' });
    expect(describeSubscription(item, '2026-02-27').nextRenewalDate).toBeNull();
    expect(describeSubscription(item, '2026-02-28').status).toBe('ended');
    expect(renewalCount(item, '2026-02-01')).toBe(0);
  });

  it('expires after one paid period when auto-renew is off', () => {
    const item = subscriptionFixture({ autoRenew: false });
    expect(describeSubscription(item, '2026-02-27')).toMatchObject({
      status: 'active',
      nextRenewalDate: null,
      expiresOn: '2026-02-28',
    });
    expect(describeSubscription(item, '2026-02-28').status).toBe('ended');
    expect(renewalCount(item, '2026-02-01')).toBe(0);
  });

  it('supports future starts and one-time purchases', () => {
    expect(
      describeSubscription(subscriptionFixture(), '2026-01-01').status,
    ).toBe('scheduled');
    const item = subscriptionFixture({ cycleUnit: 'once', autoRenew: false });
    expect(describeSubscription(item, '2026-11-04')).toMatchObject({
      status: 'active',
      nextRenewalDate: null,
      expiresOn: null,
    });
    expect(fixed(monthlyCost(item))).toBe('0.00');
    expect(renewalCount(item, '2026-11-04')).toBe(0);
  });

  it('counts every daily renewal, includes today, excludes the day at +30', () => {
    const item = subscriptionFixture({
      startDate: '2026-11-01',
      cycleUnit: 'day',
    });
    expect(renewalCount(item, '2026-11-04')).toBe(30);
    expect(renewalCount({ ...item, endDate: '2026-11-06' }, '2026-11-04')).toBe(
      2,
    );
    expect(
      renewalCount({ ...item, startDate: '2026-11-05' }, '2026-11-04'),
    ).toBe(28);
  });

  it('flags the seven-day window and uses Shanghai calendar dates', () => {
    const item = subscriptionFixture({ startDate: '2026-10-11' });
    expect(describeSubscription(item, '2026-11-04').upcoming).toBe(false);
    expect(describeSubscription(item, '2026-11-05').upcoming).toBe(true);
    expect(shanghaiToday(new Date('2026-11-03T16:01:00Z'))).toBe('2026-11-04');
  });

  it('normalizes cycles and rounds after summation, without floating-point drift', () => {
    expect(
      fixed(
        monthlyCost(
          subscriptionFixture({ amount: '120.00', cycleUnit: 'year' }),
        ),
      ),
    ).toBe('10.00');
    expect(
      fixed(
        monthlyCost(subscriptionFixture({ amount: '90.00', cycleInterval: 3 })),
      ),
    ).toBe('30.00');
    expect(
      fixed(
        monthlyCost(subscriptionFixture({ amount: '1.00', cycleUnit: 'day' })),
      ),
    ).toBe('30.42');
    expect(fixed(add(decimal('0.10'), decimal('0.20')))).toBe('0.30');
    const third = monthlyCost(
      subscriptionFixture({ amount: '1.00', cycleInterval: 3 }),
    );
    expect(fixed(add(add(third, third), third))).toBe('1.00');
  });
});

describe('Subscription request validation', () => {
  const body = () => ({
    name: ' Software ',
    devices: ['computer', 'phone'],
    startDate: '2026-01-31',
    endDate: null,
    cycleUnit: 'month',
    cycleInterval: 1,
    amount: '0',
    currency: 'USD',
    autoRenew: true,
  });
  it('accepts zero price and normalizes money and whitespace', () => {
    expect(validateInput(body())).toMatchObject({
      name: 'Software',
      amount: '0.00',
      devices: ['computer', 'phone'],
    });
  });
  it.each([
    { devices: [] },
    { devices: ['watch'] },
    { startDate: '2026-02-30' },
    { cycleInterval: 0 },
    { cycleInterval: 1.5 },
    { amount: '20.123' },
    { amount: '-1' },
    { amount: 20 },
    { currency: 'EUR' },
    { autoRenew: 'false' },
    { userId: '20' },
  ])('rejects invalid or owner-injected fields: %j', (overrides) => {
    expect(() => validateInput({ ...body(), ...overrides })).toThrow();
  });
  it('validates dates after merging partial updates', () => {
    expect(validateInput({ name: 'Renamed' }, true)).toEqual({
      name: 'Renamed',
    });
    expect(() =>
      validateCombined(subscriptionFixture({ endDate: '2026-01-31' })),
    ).toThrow();
  });
});
