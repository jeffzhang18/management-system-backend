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

@ApiTags('analysis')
@ApiBearerAuth('access-token')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @ApiOperation({
    summary: '查询总页面浏览量',
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
    @User('userId') userId: string,
    @Query() query: PageViewAnalysisQueryDto,
  ) {
    return this.analysisService.getTotalPageViews(userId, query);
  }

  @ApiOperation({
    summary: '查询页面平均停留时长',
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
    @User('userId') userId: string,
    @Query() query: PageViewAnalysisQueryDto,
  ) {
    return this.analysisService.getAverageTimeOnPage(userId, query);
  }
}
