import {
  Body,
  Controller,
  Get,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '../../common/decorators/user.decorator';
import { UpdateUiSettingsDto } from './ui-settings.dto';
import { UiSettingsService } from './ui-settings.service';

@ApiTags('ui-settings')
@ApiBearerAuth('access-token')
@Controller('ui-settings')
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class UiSettingsController {
  constructor(private readonly service: UiSettingsService) {}

  @Get() get(@User('userId') userId: number) {
    return this.service.get(userId);
  }

  @Put() save(
    @User('userId') userId: number,
    @Body() body: UpdateUiSettingsDto,
  ) {
    return this.service.save(userId, body);
  }
}
