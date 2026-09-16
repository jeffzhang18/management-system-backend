import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from '../../domain/user/user.service';
import {
  BrowsingHistoryEventType,
  CreateUserBrowsingHistoryDto,
} from './dto/create-user-browsing-history.dto';
import { UserBrowsingHistory } from './entities/user-browsing-history.entity';

@Injectable()
export class SysService {
  constructor(
    @InjectRepository(UserBrowsingHistory)
    private readonly userBrowsingHistoryRepository: Repository<UserBrowsingHistory>,
    private readonly userService: UserService,
  ) {}

  async createUserBrowsingHistory(
    email: string,
    payload: CreateUserBrowsingHistoryDto,
    userIp?: string | null,
    userAgent?: string,
  ) {
    const isLeave = payload.eventType === BrowsingHistoryEventType.Leave;

    if (
      !isLeave &&
      payload.leaveReason !== undefined &&
      payload.leaveReason !== null
    ) {
      throw new BadRequestException(
        'leaveReason is only valid for leave events',
      );
    }

    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.findPageView(user.user_id, payload.pageViewId);

    if (
      existing &&
      payload.sequence > existing.last_sequence &&
      payload.activeDurationMs < Number(existing.active_duration_ms)
    ) {
      throw new BadRequestException('activeDurationMs cannot decrease');
    }

    const rows = await this.userBrowsingHistoryRepository.query(
      `
        INSERT INTO sys_user_browsing_history (
          user_id,
          page_url,
          user_ip,
          device,
          page_view_id,
          active_duration_ms,
          last_sequence,
          last_reported_at,
          ended_at,
          leave_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(),
          CASE WHEN $8 THEN NOW() ELSE NULL END,
          $9
        )
        ON CONFLICT (user_id, page_view_id) WHERE page_view_id IS NOT NULL
        DO UPDATE SET
          active_duration_ms = EXCLUDED.active_duration_ms,
          last_sequence = EXCLUDED.last_sequence,
          last_reported_at = NOW(),
          ended_at = CASE
            WHEN EXCLUDED.ended_at IS NOT NULL THEN EXCLUDED.ended_at
            ELSE sys_user_browsing_history.ended_at
          END,
          leave_reason = COALESCE(
            EXCLUDED.leave_reason,
            sys_user_browsing_history.leave_reason
          )
        WHERE sys_user_browsing_history.ended_at IS NULL
          AND EXCLUDED.last_sequence > sys_user_browsing_history.last_sequence
          AND EXCLUDED.active_duration_ms >= sys_user_browsing_history.active_duration_ms
        RETURNING page_view_id, last_sequence, active_duration_ms, ended_at
      `,
      [
        user.user_id,
        payload.pageUrl,
        userIp ?? null,
        payload.device || userAgent || null,
        payload.pageViewId,
        payload.activeDurationMs,
        payload.sequence,
        isLeave,
        isLeave ? payload.leaveReason : null,
      ],
    );

    const record =
      rows[0] ?? (await this.findPageView(user.user_id, payload.pageViewId));

    if (!record) {
      throw new NotFoundException('Page view not found after report');
    }

    return this.toReportResponse(record);
  }

  private findPageView(userId: string, pageViewId: string) {
    return this.userBrowsingHistoryRepository.findOne({
      where: {
        user_id: userId,
        page_view_id: pageViewId,
      },
    });
  }

  private toReportResponse(
    record: UserBrowsingHistory | Record<string, unknown>,
  ) {
    const pageViewId = String(
      'page_view_id' in record ? record.page_view_id : '',
    );
    const lastSequence = Number(
      'last_sequence' in record ? record.last_sequence : 0,
    );
    const activeDurationMs = Number(
      'active_duration_ms' in record ? record.active_duration_ms : 0,
    );
    const endedAt = 'ended_at' in record ? record.ended_at : null;

    return {
      pageViewId,
      acceptedSequence: lastSequence,
      activeDurationMs,
      ended: endedAt !== null && endedAt !== undefined,
    };
  }
}
