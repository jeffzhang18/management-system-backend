import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { User } from '../../common/decorators/user.decorator';
import { CalendarRangeQueryDto } from './dto/calendar-range-query.dto';
import { CreateWorkRecordDto } from './dto/create-work-record.dto';
import { CreateWorkRecordThemeDto } from './dto/create-work-record-theme.dto';
import { ExportWorkRecordsQueryDto } from './dto/export-work-records-query.dto';
import { ImportWorkRecordsDto } from './dto/import-work-records.dto';
import { PatchWorkRecordDto } from './dto/patch-work-record.dto';
import { UpdateWorkRecordDto } from './dto/update-work-record.dto';
import { WorkRecordDayQueryDto } from './dto/work-record-day-query.dto';
import { WorkRecordsService } from './work-records.service';
import { GenerateAiReportDto } from './dto/generate-ai-report.dto';

@ApiTags('work-records')
@ApiBearerAuth('access-token')
@Controller('work-records')
export class WorkRecordsController {
  constructor(private readonly workRecordsService: WorkRecordsService) {}

  @ApiOperation({
    summary: 'AI 生成工作周报或下周安排',
    description:
      '根据当前用户在指定日期范围内的工作记录生成 Markdown 报告。提示词模板当前由后端固定配置。',
  })
  @ApiBody({ type: GenerateAiReportDto })
  @Post('ai-report/generate')
  generateAiReport(
    @User('userId') userId: number,
    @Body() body: GenerateAiReportDto,
  ) {
    return this.workRecordsService.generateAiReport(userId, body);
  }

  @ApiOperation({
    summary: '查询日历范围内记录摘要',
    description: '返回记录 ID、日期、主题颜色，用于绘制日历圆点。',
  })
  @Get('calendar')
  getCalendarSummary(
    @User('userId') userId: number,
    @Query() query: CalendarRangeQueryDto,
  ) {
    return this.workRecordsService.getCalendarSummary(
      userId,
      query.startDate,
      query.endDate,
    );
  }

  @ApiOperation({
    summary: '查询指定年份每日工作强度',
    description: '返回指定自然年内每日记录数量和五级工作强度，按日期升序排列。',
  })
  @ApiQuery({ name: 'year', example: 2026, description: '四位数年份' })
  @Get('contributions')
  getContributions(
    @User('userId') userId: number,
    @Query('year') year: string,
  ) {
    return this.workRecordsService.getContributions(userId, year);
  }

  @ApiOperation({
    summary: '按日期查询记录列表',
    description: '查询某一天的全部工作记录。',
  })
  @Get()
  getRecordsByDate(
    @User('userId') userId: number,
    @Query() query: WorkRecordDayQueryDto,
  ) {
    return this.workRecordsService.getRecordsByDate(userId, query.date);
  }

  @ApiOperation({
    summary: '查询主题列表',
    description: '返回系统主题 + 当前用户自定义主题。',
  })
  @Get('themes')
  getThemeList(@User('userId') userId: number) {
    return this.workRecordsService.getThemeList(userId);
  }

  @ApiOperation({
    summary: '创建主题',
    description: '创建当前用户的自定义主题。',
  })
  @ApiBody({ type: CreateWorkRecordThemeDto })
  @Post('themes')
  createTheme(
    @User('userId') userId: number,
    @Body() body: CreateWorkRecordThemeDto,
  ) {
    return this.workRecordsService.createTheme(userId, body);
  }
  @ApiOperation({
    summary: '按日期范围导出记录',
    description: '支持 txt、json、pdf 三种格式导出。',
  })
  @ApiQuery({ name: 'startDate', example: '2026-08-01' })
  @ApiQuery({ name: 'endDate', example: '2026-08-31' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['txt', 'json', 'pdf'],
    example: 'json',
  })
  @Get('export')
  async exportRecords(
    @User('userId') userId: number,
    @Query() query: ExportWorkRecordsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.workRecordsService.exportRecords(userId, query);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );

    return new StreamableFile(file.buffer);
  }

  @ApiOperation({
    summary: '批量导入 JSON 记录',
    description:
      '支持 body 为 { records: [...] } 或直接传数组 [...], 导入结果返回成功/失败统计。',
  })
  @ApiBody({ type: ImportWorkRecordsDto })
  @Post('import')
  importRecords(
    @User('userId') userId: number,
    @Body() body: ImportWorkRecordsDto | CreateWorkRecordDto[],
  ) {
    return this.workRecordsService.importRecords(userId, body);
  }

  @ApiOperation({ summary: '按 ID 查询记录详情' })
  @Get(':id')
  getRecordDetail(@User('userId') userId: number, @Param('id') id: string) {
    return this.workRecordsService.getRecordDetail(userId, id);
  }

  @ApiOperation({
    summary: '新建记录',
    description: '创建快速记录或详细记录。',
  })
  @ApiBody({ type: CreateWorkRecordDto })
  @Post()
  createRecord(
    @User('userId') userId: number,
    @Body() body: CreateWorkRecordDto,
  ) {
    return this.workRecordsService.createRecord(userId, body);
  }

  @ApiOperation({ summary: '完整更新记录' })
  @ApiBody({ type: UpdateWorkRecordDto })
  @Put(':id')
  replaceRecord(
    @User('userId') userId: number,
    @Param('id') id: string,
    @Body() body: UpdateWorkRecordDto,
  ) {
    return this.workRecordsService.replaceRecord(userId, id, body);
  }

  @ApiOperation({ summary: '局部更新记录' })
  @ApiBody({ type: PatchWorkRecordDto })
  @Patch(':id')
  patchRecord(
    @User('userId') userId: number,
    @Param('id') id: string,
    @Body() body: PatchWorkRecordDto,
  ) {
    return this.workRecordsService.patchRecord(userId, id, body);
  }

  @ApiOperation({ summary: '逻辑删除记录' })
  @Delete(':id')
  deleteRecord(@User('userId') userId: number, @Param('id') id: string) {
    return this.workRecordsService.deleteRecord(userId, id);
  }
}
