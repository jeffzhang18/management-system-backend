import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { WeatherModule } from './modules/weather/weather.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './domain/user/user.model';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ApiCallLogModule } from './common/logging/api-call-log.module';
import { ApiCallLogInterceptor } from './common/interceptors/api-call-log.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { WsModule } from './ws/ws.module';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,   // ✅ 关键
      synchronize: true, // ⚠️ 仅开发环境
    }),
    UserModule,
    WeatherModule,
    HolidaysModule,
    AuthModule,
    ApiCallLogModule,
    WsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    }, 
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiCallLogInterceptor
    }
  ],
})
export class AppModule {}
