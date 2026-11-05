import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type { Currency, CycleUnit, Device } from './subscription.entity';

export const CURRENCIES: Currency[] = ['USD', 'CNY', 'AUD'];
const DEVICES: Device[] = ['phone', 'computer', 'other'];
const UNITS: CycleUnit[] = ['day', 'month', 'year', 'once'];

export class SubscriptionInput {
  @ApiProperty({ example: 'Claude' }) name: string;
  @ApiProperty({ enum: DEVICES, isArray: true }) devices: Device[];
  @ApiProperty({ example: '2026-11-04' }) startDate: string;
  @ApiPropertyOptional({ nullable: true }) endDate?: string | null;
  @ApiProperty({ enum: UNITS }) cycleUnit: CycleUnit;
  @ApiProperty({ minimum: 1, maximum: 1200 }) cycleInterval: number;
  @ApiProperty({
    example: '20.00',
    description: 'Price per billing cycle, decimal string',
  })
  amount: string;
  @ApiProperty({ enum: CURRENCIES }) currency: Currency;
  @ApiProperty({ default: true }) autoRenew: boolean;
}

export class UpdateSubscriptionInput extends PartialType(SubscriptionInput) {}

export function currencyValue(value: unknown): Currency {
  if (!CURRENCIES.includes(value as Currency))
    throw new BadRequestException('Unsupported currency');
  return value as Currency;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '1900-01-01' &&
    value <= '9998-12-31' &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

/** Validate at the service boundary as the application does not install a global ValidationPipe. */
export function validateInput(
  input: unknown,
  partial = false,
): Partial<SubscriptionInput> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Invalid subscription');
  const body = input as Record<string, unknown>;
  const allowed = [
    'name',
    'devices',
    'startDate',
    'endDate',
    'cycleUnit',
    'cycleInterval',
    'amount',
    'currency',
    'autoRenew',
  ];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new BadRequestException('Unknown subscription field');
  const has = (key: string) => !partial || key in body;
  const fail = (field: string): never => {
    throw new BadRequestException(`Invalid ${field}`);
  };
  const out: Partial<SubscriptionInput> = {};
  if (has('name')) {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 200
    )
      fail('name');
    out.name = (body.name as string).trim();
  }
  if (has('devices')) {
    if (
      !Array.isArray(body.devices) ||
      !body.devices.length ||
      body.devices.some((d) => !DEVICES.includes(d))
    )
      fail('devices');
    out.devices = [...new Set(body.devices as Device[])];
  }
  if (has('startDate')) {
    if (!validDate(body.startDate)) fail('startDate');
    out.startDate = body.startDate as string;
  }
  if ('endDate' in body) {
    if (body.endDate !== null && !validDate(body.endDate)) fail('endDate');
    out.endDate = body.endDate as string | null;
  } else if (!partial) out.endDate = null;
  if (has('cycleUnit')) {
    if (!UNITS.includes(body.cycleUnit as CycleUnit)) fail('cycleUnit');
    out.cycleUnit = body.cycleUnit as CycleUnit;
  }
  if (has('cycleInterval')) {
    if (
      typeof body.cycleInterval !== 'number' ||
      !Number.isInteger(body.cycleInterval) ||
      body.cycleInterval < 1 ||
      body.cycleInterval > 1200
    )
      fail('cycleInterval');
    out.cycleInterval = body.cycleInterval as number;
  }
  if (has('amount')) {
    if (
      typeof body.amount !== 'string' ||
      !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(body.amount)
    )
      fail('amount');
    out.amount = fixedAmount(body.amount as string);
  }
  if (has('currency')) out.currency = currencyValue(body.currency);
  if (has('autoRenew')) {
    if (typeof body.autoRenew !== 'boolean') fail('autoRenew');
    out.autoRenew = body.autoRenew as boolean;
  }
  return out;
}

function fixedAmount(value: string): string {
  const [whole, part = ''] = value.split('.');
  return `${whole}.${part.padEnd(2, '0')}`;
}

export function validateCombined(value: SubscriptionInput): void {
  if (value.endDate && value.endDate <= value.startDate)
    throw new BadRequestException('Stop date must be after start date');
  if (value.cycleUnit === 'once') {
    value.autoRenew = false;
    value.cycleInterval = 1;
  }
}
