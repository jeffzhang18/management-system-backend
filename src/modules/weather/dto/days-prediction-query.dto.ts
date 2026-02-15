import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class DaysPredictionQueryDto {
  @ApiProperty({
    example: "101190202",
    description:"地区ID"
  })
    @IsString()
    location: string;


    @ApiProperty({
      example: "3d",
      description:"预测天数('3d' | '7d' | '10d' | '15d' | '30d')"
    })
    @IsString()
    days: '3d' | '7d' | '10d' | '15d' | '30d';
  }
  