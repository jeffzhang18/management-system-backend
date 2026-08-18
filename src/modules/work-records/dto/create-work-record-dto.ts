import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkRecordDto {
  @ApiProperty({
    description: '记录日期（YYYY-MM-DD）',
    example: '2026-08-18',
  })
  recordDate: string;

  @ApiProperty({
    description: '记录标题',
    maxLength: 80,
    example: '完成项目排期评审',
  })
  title: string;

  @ApiPropertyOptional({
    description: '主题 ID，不传时自动选取当前用户可用主题',
    example: 3,
  })
  themeId?: number;

  @ApiPropertyOptional({
    description: '开始时间（HH:mm 或 HH:mm:ss）',
    example: '09:00',
    nullable: true,
  })
  startTime?: string | null;

  @ApiPropertyOptional({
    description: '结束时间（HH:mm 或 HH:mm:ss）',
    example: '10:30',
    nullable: true,
  })
  endTime?: string | null;

  @ApiPropertyOptional({
    description: 'Markdown 记录内容',
    example: '今天完成了接口联调与测试。',
    nullable: true,
  })
  contentMd?: string | null;
}
