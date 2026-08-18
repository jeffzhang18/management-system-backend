import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportWorkRecordsQueryDto {
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

  @ApiPropertyOptional({
    description: '导出格式（txt | json | pdf）',
    example: 'json',
    enum: ['txt', 'json', 'pdf'],
    default: 'json',
  })
  format?: 'txt' | 'json' | 'pdf';
}
