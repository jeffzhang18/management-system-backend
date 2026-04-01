import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SaveLocationListDto {
  @ApiProperty({
    example: ['101190202', '101010100'],
    description: '需要保存的地区 LocationID 列表',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  locationList: string[];
}
