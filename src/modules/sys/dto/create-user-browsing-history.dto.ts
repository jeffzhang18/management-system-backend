import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserBrowsingHistoryDto {
  @ApiProperty({
    description: '访问页面 URL',
    example: '/dashboard/overview',
  })
  @IsString()
  @MaxLength(1024)
  pageUrl: string;

  @ApiPropertyOptional({
    description: '设备标识或客户端信息',
    example: 'Chrome 134 / Windows 11',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  device?: string;
}
