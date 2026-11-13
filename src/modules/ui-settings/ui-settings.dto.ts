import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateUiSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['default', 'cyan', 'purple', 'blue', 'orange', 'red'])
  themeColorPresets?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['light', 'dark'])
  themeMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  themeFollowSystem?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['vertical', 'horizontal', 'mini'])
  themeLayout?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() themeStretch?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() breadCrumb?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() accordion?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() multiTab?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() darkSidebar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fontFamily?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(32)
  fontSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ltr', 'rtl'])
  direction?: string;
}
