import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class PageViewAnalysisQueryDto {
  @ApiPropertyOptional({
    description: '指定日期（YYYY-MM-DD）。传入 date 时按该自然日统计。',
    example: '2026-09-18',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: '起始日期（YYYY-MM-DD）。与 endDate 一起用于日期范围统计。',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: '结束日期（YYYY-MM-DD）。日期范围统计包含该日期。',
    example: '2026-09-18',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
