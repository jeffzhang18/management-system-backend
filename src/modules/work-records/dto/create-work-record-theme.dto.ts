import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkRecordThemeDto {
  @ApiProperty({
    description: '主题名称',
    maxLength: 50,
    example: '深度工作',
  })
  themeName: string;

  @ApiProperty({
    description: '主题颜色（#RRGGBB）',
    example: '#4F46E5',
  })
  color: string;

  @ApiPropertyOptional({
    description: '主题 key，不传则后端自动生成',
    maxLength: 64,
    example: 'deep-work',
  })
  themeKey?: string;

  @ApiPropertyOptional({
    description: '排序号，不传默认为当前用户最大值+1',
    example: 10,
  })
  sortNo?: number;
}
