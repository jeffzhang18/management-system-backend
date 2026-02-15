import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";


export class HoursPredictionQueryDto {
    @ApiProperty({
      example: "101190202",
      description:"地区ID"
    })
    @IsString()
    location: string;


    @ApiProperty({
      example: "24h",
      description:"预测小时数('24h' | '72h' | '168h')"
    })
    @IsString()
    hours: '24h' | '72h' | '168h';
    
  }
  