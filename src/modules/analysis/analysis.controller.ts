import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '../../common/decorators/user.decorator';
import { AnalysisService } from './analysis.service';
import { PageViewAnalysisQueryDto } from './dto/page-view-analysis-query.dto';
import { PageViewTrendQueryDto } from './dto/page-view-trend-query.dto';

@ApiTags('analysis')
@ApiBearerAuth('access-token')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @ApiOperation({
    summary: 'Query page-view analytics by day',
    description:
      'Returns daily page views and time on page, together with summary metrics for the requested period. Dates use Asia/Shanghai natural days.',
  })
  @Get('page-views')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  getPageViews(
    @User('email') email: string,
    @Query() query: PageViewTrendQueryDto,
  ) {
    return this.analysisService.getPageViews(email, query);
  }

  @ApiOperation({
    summary: '查询总页面浏览量',
    deprecated: true,
    description:
      '支持按某天 date 统计，或按 startDate/endDate 日期范围统计。日期按 Asia/Shanghai 自然日计算。',
  })
  @Get('total-page-views')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  getTotalPageViews(
    @User('email') email: string,
    @Query() query: PageViewAnalysisQueryDto,
  ) {
    return this.analysisService.getTotalPageViews(email, query);
  }

  @ApiOperation({
    summary: '查询页面平均停留时长',
    deprecated: true,
    description:
      '支持按某天 date 统计，或按 startDate/endDate 日期范围统计。平均值基于 activeDurationMs。',
  })
  @Get('average-time-on-page')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  getAverageTimeOnPage(
    @User('email') email: string,
    @Query() query: PageViewAnalysisQueryDto,
  ) {
    return this.analysisService.getAverageTimeOnPage(email, query);
  }
}
