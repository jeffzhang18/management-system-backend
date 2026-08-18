import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkRecordDto {
  @ApiProperty({
    description: '记录日期（YYYY-MM-DD）',
    example: '2026-08-18',
  })
  recordDate: string;

  @ApiProperty({
    description: '记录标题',
    maxLength: 80,
    example: '完成项目排期评审（更新）',
  })
  title: string;

  @ApiProperty({
    description: '主题 ID',
    example: 3,
  })
  themeId: number;

  @ApiPropertyOptional({
    description: '开始时间（HH:mm 或 HH:mm:ss），不传或传 null 表示清空时间段',
    example: '09:00',
    nullable: true,
  })
  startTime?: string | null;

  @ApiPropertyOptional({
    description: '结束时间（HH:mm 或 HH:mm:ss），不传或传 null 表示清空时间段',
    example: '10:30',
    nullable: true,
  })
  endTime?: string | null;

  @ApiPropertyOptional({
    description: 'Markdown 记录内容，不传或传 null 表示清空内容',
    example: '更新后的详细记录。',
    nullable: true,
  })
  contentMd?: string | null;
}
