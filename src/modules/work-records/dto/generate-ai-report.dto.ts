import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsString } from 'class-validator';

export enum AiReportType {
  WEEKLY_REPORT = 'WEEKLY_REPORT',
  NEXT_WEEK_PLAN = 'NEXT_WEEK_PLAN',
}

export enum AiReportOutputFormat {
  MARKDOWN = 'MARKDOWN',
}

export enum AiReportLanguage {
  ZH_CN = 'zh-CN',
  EN_US = 'en-US',
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

  @ApiProperty({
    enum: AiReportLanguage,
    example: AiReportLanguage.ZH_CN,
    description:
      '客户端语言。兼容输入 zh/zh-CN 和 en/en-US，服务端会按工作记录主语言输出',
  })
  @IsString()
  language: string;
}