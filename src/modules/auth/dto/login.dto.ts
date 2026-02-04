import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin',
    description: '用户名',
  })
  @IsString()
  email: string;

  @ApiProperty({
    example: '123456',
    description: '密码',
  })
  @IsString()
  password: string;
}
