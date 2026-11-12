import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { SearchEngine } from './search.entity';

const ENGINES: SearchEngine[] = ['google', 'baidu', 'bing'];
const SOURCES = ['auto', 'custom'] as const;

export class UpdateSearchSettingsDto {
  @ApiProperty({ description: '当前设置版本（乐观锁）', example: 0 })
  @IsInt()
  @Min(0)
  version: number;

  @ApiPropertyOptional({ enum: ENGINES })
  @IsOptional()
  @IsIn(ENGINES)
  defaultEngine?: SearchEngine;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @ApiPropertyOptional({ enum: ['default', 'online'] })
  @IsOptional()
  @IsIn(['default', 'online'])
  backgroundMode?: 'default' | 'online';

  @ApiPropertyOptional({ nullable: true, description: '在线壁纸 HTTPS 链接' })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(2048)
  wallpaperUrl?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 0.85 })
  @IsOptional()
  @IsNumber()
  overlayOpacity?: number;

  @ApiPropertyOptional({ minimum: 40, maximum: 112 })
  @IsOptional()
  @IsInt()
  iconSize?: number;

  @ApiPropertyOptional({ minimum: 8, maximum: 48 })
  @IsOptional()
  @IsInt()
  gap?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  radius?: number;

  @ApiPropertyOptional({ enum: ['row', 'column'] })
  @IsOptional()
  @IsIn(['row', 'column'])
  layoutDirection?: 'row' | 'column';

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  itemsPerLine?: number;
}

export class CreateSearchBookmarkDto {
  @ApiProperty({ example: 'Example', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'https://example.com' })
  @IsString()
  @MaxLength(2048)
  url: string;

  @ApiProperty({ enum: SOURCES })
  @IsIn(SOURCES)
  titleSource: 'auto' | 'custom';

  @ApiProperty({ enum: SOURCES })
  @IsIn(SOURCES)
  iconSource: 'auto' | 'custom';

  @ApiPropertyOptional({ nullable: true, description: '图标 HTTPS 链接' })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(2048)
  iconUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, description: '网站信息获取时间' })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  metadataFetchedAt?: string | null;
}

export class UpdateSearchBookmarkDto {
  @ApiProperty({ description: '当前收藏版本（乐观锁）', example: 1 })
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ enum: SOURCES })
  @IsOptional()
  @IsIn(SOURCES)
  titleSource?: 'auto' | 'custom';

  @ApiPropertyOptional({ enum: SOURCES })
  @IsOptional()
  @IsIn(SOURCES)
  iconSource?: 'auto' | 'custom';

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(2048)
  iconUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsString()
  metadataFetchedAt?: string | null;
}

export class ReorderSearchBookmarksDto {
  @ApiProperty({ type: [String], description: '按新顺序排列的收藏 ID' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids: string[];
}

export class SearchMetadataDto {
  @ApiProperty({ example: 'https://example.com' })
  @IsString()
  @MaxLength(2048)
  url: string;
}

export class CreateSearchDto {
  @ApiProperty({ example: 'nestjs', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  query: string;

  @ApiProperty({ enum: ENGINES })
  @IsIn(ENGINES)
  engine: SearchEngine;

  @ApiProperty({ description: '客户端生成的 UUID v4，用于幂等' })
  @IsUUID('4')
  requestId: string;

  @ApiPropertyOptional({ example: '/search' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class SearchHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: '分页游标' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
