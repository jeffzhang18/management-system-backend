import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchMetadataService } from './search-metadata.service';
import { SearchController } from './search.controller';
import { SearchBookmark, SearchHistory, SearchSettings } from './search.entity';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchSettings, SearchBookmark, SearchHistory]),
  ],
  controllers: [SearchController],
  providers: [SearchService, SearchMetadataService],
})
export class SearchModule {}