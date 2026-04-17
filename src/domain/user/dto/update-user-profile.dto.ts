import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: '昵称', example: 'Alice' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '用户名', example: 'alice_01' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userName?: string;

  @ApiPropertyOptional({ description: '性别(数字枚举)', example: 1 })
  @IsOptional()
  @IsInt()
  gender?: number;

  @ApiPropertyOptional({
    description: '头像地址',
    example: 'https://example.com/avatar.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;

  @ApiPropertyOptional({ description: '语言', example: 'zh-CN' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @ApiPropertyOptional({ description: '国家', example: 'China' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: '城市', example: 'Shanghai' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: '联系方式', example: '+86-13800138000' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;

  @ApiPropertyOptional({
    description: '个人简介',
    example: 'Loves building products.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  about?: string;
}
