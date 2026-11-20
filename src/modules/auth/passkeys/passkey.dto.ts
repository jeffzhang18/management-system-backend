import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

export class PasskeyOptionsDto {
  @ApiPropertyOptional({ enum: ['local', 'phone'] })
  @IsOptional()
  @IsIn(['local', 'phone'])
  mode?: 'local' | 'phone';
}

export class VerifyPasskeyLoginDto {
  @ApiProperty()
  @IsUUID()
  challengeId: string;

  @ApiProperty({ type: Object })
  @IsObject()
  response: AuthenticationResponseJSON;
}

export class VerifyPasskeyRegistrationDto {
  @ApiProperty()
  @IsUUID()
  challengeId: string;

  @ApiProperty({ type: Object })
  @IsObject()
  response: RegistrationResponseJSON;

  @ApiProperty({ description: 'Verification code sent to the account email' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
