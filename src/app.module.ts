import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherModule } from './modules/weather/weather.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { AuthModule } from './modules/auth/auth.module';
import {UserModule } from './domain/user/user.model'
import { User } from './domain/user/user.entity';


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
      entities: [User],
      synchronize: true, // ⚠️ 仅开发环境
    }),
    UserModule,
    WeatherModule,
    HolidaysModule,
    AuthModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
