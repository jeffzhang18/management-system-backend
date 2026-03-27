import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class NowQueryDto {
  @ApiProperty({
    example: '101190202',
    description: '地区ID',
  })
  @IsString()
  location: string;

  @ApiProperty({
    example: 'zh-hans',
    description: '多语言标识',
  })
  @IsString()
  lang: string;

  @ApiPropertyOptional({
    example: 'm',
    description: '数据单位(m 或 i)',
  })
  @IsOptional()
  @IsString()
  unit?: 'm' | 'i';
}
