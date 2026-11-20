// auth/dto/register.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'test@test.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'my_user_name' })
  @IsString()
  @MinLength(1)
  userName: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '123456', description: 'Email verification code' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({ example: true, description: '是否公开个人资料' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
