// auth/dto/register.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'test@test.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'my_nick_name' })
  @IsString()
  @MinLength(1)
  nickName: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;

  
}
