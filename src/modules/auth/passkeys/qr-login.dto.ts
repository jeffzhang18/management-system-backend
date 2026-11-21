import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';
import { VerifyPasskeyLoginDto } from './passkey.dto';

export class QrSessionTokenDto {
  @ApiProperty() @IsUUID() sessionId: string;
  @ApiProperty() @IsString() @Length(43, 43) token: string;
}

export class ApproveQrLoginDto extends VerifyPasskeyLoginDto {
  @ApiProperty() @IsUUID() sessionId: string;
  @ApiProperty() @IsString() @Length(43, 43) token: string;
}
