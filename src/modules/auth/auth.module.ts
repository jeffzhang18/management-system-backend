import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from 'src/domain/user/user.model';
import { TokenRevocation } from './entities/token-revocation.entity';
import { TokenRevocationService } from './token-revocation.service';
import { EmailVerificationCode } from './entities/email-verification-code.entity';
import { EmailVerificationService } from './email-verification.service';
import { Passkey, PasskeyChallenge } from './passkeys/passkey.entity';
import { PasskeyService } from './passkeys/passkey.service';
import { PasskeyController } from './passkeys/passkey.controller';
import { QrLoginSession } from './passkeys/qr-login.entity';
import { QrLoginService } from './passkeys/qr-login.service';
import { QrLoginController } from './passkeys/qr-login.controller';
import { MailService } from './mail.service';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([
      TokenRevocation,
      EmailVerificationCode,
      Passkey,
      PasskeyChallenge,
      QrLoginSession,
    ]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController, PasskeyController, QrLoginController],
  providers: [
    AuthService,
    PasskeyService,
    QrLoginService,
    JwtStrategy,
    TokenRevocationService,
    EmailVerificationService,
    MailService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
