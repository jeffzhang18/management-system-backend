import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '../../common/decorators/user.decorator';
import {
  CreateSearchBookmarkDto,
  CreateSearchDto,
  ReorderSearchBookmarksDto,
  SearchHistoryQueryDto,
  SearchMetadataDto,
  UpdateSearchBookmarkDto,
  UpdateSearchSettingsDto,
} from './search.dto';
import { SearchMetadataService } from './search-metadata.service';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth('access-token')
@Controller('search')
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class SearchController {
  constructor(
    private readonly service: SearchService,
    private readonly metadata: SearchMetadataService,
  ) {}

  @Get('settings') settings(@User('userId') userId: number) {
    return this.service.settings(userId);
  }
  @Patch('settings') saveSettings(
    @User('userId') userId: number,
    @Body() body: UpdateSearchSettingsDto,
  ) {
    return this.service.saveSettings(userId, body);
  }
  @Get('bookmarks') bookmarks(@User('userId') userId: number) {
    return this.service.bookmarks(userId);
  }
  @Post('bookmarks') createBookmark(
    @User('userId') userId: number,
    @Body() body: CreateSearchBookmarkDto,
  ) {
    return this.service.createBookmark(userId, body);
  }
  @Put('bookmarks/order') reorder(
    @User('userId') userId: number,
    @Body() body: ReorderSearchBookmarksDto,
  ) {
    return this.service.reorder(userId, body.ids);
  }
  @Patch('bookmarks/:id') updateBookmark(
    @User('userId') userId: number,
    @Param('id') id: string,
    @Body() body: UpdateSearchBookmarkDto,
  ) {
    return this.service.updateBookmark(userId, id, body);
  }
  @Delete('bookmarks/:id') deleteBookmark(
    @User('userId') userId: number,
    @Param('id') id: string,
  ) {
    return this.service.deleteBookmark(userId, id);
  }
  @Post('metadata') @HttpCode(200) fetchMetadata(
    @Body() body: SearchMetadataDto,
  ) {
    return this.metadata.fetch(body.url);
  }
  @Post('searches') @HttpCode(200) search(
    @User('userId') userId: number,
    @Body() body: CreateSearchDto,
  ) {
    return this.service.search(userId, body);
  }
  @Get('history') history(
    @User('userId') userId: number,
    @Query() query: SearchHistoryQueryDto,
  ) {
    return this.service.history(userId, query);
  }
  @Delete('history/:id') deleteHistory(
    @User('userId') userId: number,
    @Param('id') id: string,
  ) {
    return this.service.deleteHistory(userId, id);
  }
  @Delete('history') clearHistory(@User('userId') userId: number) {
    return this.service.clearHistory(userId);
  }
}
