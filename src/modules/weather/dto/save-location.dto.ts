import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SaveLocationDto {
  @ApiProperty({
    example: '101190202',
    description: '需要保存的地区 LocationID',
  })
  @IsString()
  locationId: string;

  @ApiProperty({
    example: 'China',
    description: '国家',
  })
  @IsString()
  country: string;

  @ApiProperty({
    example: 'Nanjing',
    description: '城市名称',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Jiangsu',
    description: '一级行政区',
  })
  @IsString()
  adm1: string;
}
