import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from '../../common/decorators/user.decorator';
import { ExchangeRatesService } from './exchange-rates.service';
import {
  currencyValue,
  SubscriptionInput,
  UpdateSubscriptionInput,
} from './subscription-input';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth('access-token')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  list(@User('userId') userId: number) {
    return this.service.list(userId);
  }

  @Get('summary')
  @ApiQuery({ name: 'currency', enum: ['USD', 'CNY', 'AUD'], required: false })
  summary(
    @User('userId') userId: number,
    @Query('currency') currency?: string,
  ) {
    return this.service.summary(userId, currencyValue(currency ?? 'CNY'));
  }

  @Post()
  @ApiBody({ type: SubscriptionInput })
  create(@User('userId') userId: number, @Body() body: SubscriptionInput) {
    return this.service.create(userId, body);
  }

  @Patch(':id')
  @ApiBody({
    type: UpdateSubscriptionInput,
    description: 'Partial subscription update; omitted fields are retained.',
  })
  update(
    @User('userId') userId: number,
    @Param('id') id: string,
    @Body() body: UpdateSubscriptionInput,
  ) {
    return this.service.update(userId, id, body);
  }

  @Delete(':id')
  remove(@User('userId') userId: number, @Param('id') id: string) {
    return this.service.remove(userId, id);
  }
}

@ApiTags('exchange-rates')
@ApiBearerAuth('access-token')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly service: ExchangeRatesService) {}

  @Get()
  @ApiQuery({ name: 'base', enum: ['USD', 'CNY', 'AUD'], required: false })
  get(@Query('base') base?: string) {
    return this.service.get(currencyValue(base ?? 'USD'));
  }
}
