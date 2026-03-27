import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SaveLocationDto {
  @ApiProperty({
    example: '101190202',
    description: '需要保存的地区 LocationID',
  })
  @IsString()
  locationId: string;
}
