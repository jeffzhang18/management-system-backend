import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum BrowsingHistoryEventType {
  Enter = 'enter',
  Heartbeat = 'heartbeat',
  Leave = 'leave',
}

export enum BrowsingHistoryLeaveReason {
  RouteChange = 'route_change',
  PageHide = 'pagehide',
  Logout = 'logout',
}

export class CreateUserBrowsingHistoryDto {
  @ApiProperty({
    description: '一次页面访问的唯一标识',
    example: '8ad14814-d97a-44b0-a088-0e9c80909c19',
  })
  @IsUUID()
  pageViewId: string;

  @ApiProperty({
    description: '访问页面 pathname，不包含 query 和 hash',
    example: '/dashboard/overview',
  })
  @IsString()
  @MaxLength(1024)
  @Matches(/^\/[^?#]*$/, {
    message: 'pageUrl must be a pathname without query or hash',
  })
  pageUrl: string;

  @ApiProperty({
    description: '上报事件类型',
    enum: BrowsingHistoryEventType,
    example: BrowsingHistoryEventType.Enter,
  })
  @IsEnum(BrowsingHistoryEventType)
  eventType: BrowsingHistoryEventType;

  @ApiProperty({ description: '本次页面访问内单调递增的上报序号', example: 0 })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  sequence: number;

  @ApiProperty({
    description: '累计有效停留时间，单位毫秒',
    example: 60231,
  })
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  activeDurationMs: number;

  @ApiProperty({
    description: '设备标识或客户端信息',
    example: 'Chrome 134 / Windows 11',
  })
  @IsString()
  @MaxLength(255)
  device: string;

  @ApiPropertyOptional({
    description: '离开原因，仅 leave 事件必填',
    enum: BrowsingHistoryLeaveReason,
    nullable: true,
  })
  @ValidateIf(
    (payload: CreateUserBrowsingHistoryDto) =>
      payload.eventType === BrowsingHistoryEventType.Leave,
  )
  @IsEnum(BrowsingHistoryLeaveReason)
  leaveReason?: BrowsingHistoryLeaveReason | null;
}
