import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';

export enum AiReportType {
  WEEKLY_REPORT = 'WEEKLY_REPORT',
  NEXT_WEEK_PLAN = 'NEXT_WEEK_PLAN',
}

export enum AiReportOutputFormat {
  MARKDOWN = 'MARKDOWN',
}

export enum AiReportLanguage {
  ZH_CN = 'zh-CN',
}

export class GenerateAiReportDto {
  @ApiProperty({ example: '2026-08-17', format: 'date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-08-21', format: 'date' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ enum: AiReportType, example: AiReportType.WEEKLY_REPORT })
  @IsEnum(AiReportType)
  reportType: AiReportType;

  @ApiProperty({
    enum: AiReportOutputFormat,
    example: AiReportOutputFormat.MARKDOWN,
  })
  @IsEnum(AiReportOutputFormat)
  outputFormat: AiReportOutputFormat;

  @ApiProperty({ enum: AiReportLanguage, example: AiReportLanguage.ZH_CN })
  @IsEnum(AiReportLanguage)
  language: AiReportLanguage;
}
