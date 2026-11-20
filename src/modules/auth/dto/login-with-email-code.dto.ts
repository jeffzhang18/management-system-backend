import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { SendLoginCodeDto } from './send-login-code.dto';

export class LoginWithEmailCodeDto extends SendLoginCodeDto {
  @ApiProperty({
    example: '123456',
    description: 'Email login verification code',
  })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
