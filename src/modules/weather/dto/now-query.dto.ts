import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class NowQueryDto {
  @ApiProperty({
    example: "101190202",
    description:"地区ID"
  })
    @IsString()
    location: string;
  }
  