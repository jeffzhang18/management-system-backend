import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RevokeRefreshTokenDto {
  @ApiProperty({
    description: '待失效的 refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  refreshToken: string;
}
