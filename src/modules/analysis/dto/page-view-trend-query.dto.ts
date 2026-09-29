import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class PageViewTrendQueryDto {
  @ApiProperty({
    description: 'Start date (YYYY-MM-DD), inclusive',
    example: '2026-09-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date (YYYY-MM-DD), inclusive',
    example: '2026-09-30',
  })
  @IsDateString()
  endDate: string;
}
