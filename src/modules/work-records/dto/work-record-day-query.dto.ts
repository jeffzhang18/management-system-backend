import { ApiProperty } from '@nestjs/swagger';

export class WorkRecordDayQueryDto {
  @ApiProperty({
    description: '查询日期（YYYY-MM-DD）',
    example: '2026-08-18',
  })
  date: string;
}
;