import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { SendResetPasswordCodeDto } from './send-reset-password-code.dto';

export class ResetPasswordDto extends SendResetPasswordCodeDto {
  @ApiProperty({ example: '123456', description: 'Password reset email code' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;

  @ApiProperty({ minLength: 6, maxLength: 72, description: 'New password' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
