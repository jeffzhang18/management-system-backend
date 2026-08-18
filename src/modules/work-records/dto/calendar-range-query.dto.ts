import { ApiProperty } from '@nestjs/swagger';

export class CalendarRangeQueryDto {
  @ApiProperty({
    description: '起始日期（YYYY-MM-DD）',
    example: '2026-08-01',
  })
  startDate: string;

  @ApiProperty({
    description: '结束日期（YYYY-MM-DD）',
    example: '2026-08-31',
  })
  endDate: string;
}
