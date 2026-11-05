import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { ExchangeRatesService } from './exchange-rates.service';
import { Subscription } from './subscription.entity';
import {
  ExchangeRatesController,
  SubscriptionsController,
} from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, ExchangeRate])],
  controllers: [SubscriptionsController, ExchangeRatesController],
  providers: [SubscriptionsService, ExchangeRatesService],
})
export class SubscriptionsModule {}
