import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { UpdateUiSettingsDto } from './ui-settings.dto';

@Injectable()
export class UiSettingsService {
  constructor(private readonly dataSource: DataSource) {}

  private owner(input: unknown): string {
    if (
      !/^[1-9]\d*$/.test(String(input)) ||
      BigInt(String(input)) > 2147483647n
    )
      throw new UnauthorizedException();
    return String(input);
  }

  async get(userId: unknown) {
    const rows: Array<{ settings: Record<string, unknown> }> =
      await this.dataSource.query(
        'SELECT settings FROM user_ui_settings WHERE user_id = $1',
        [this.owner(userId)],
      );
    return { settings: rows[0]?.settings ?? {} };
  }

  // Atomic upsert that merges the submitted keys into the stored document.
  async save(userId: unknown, dto: UpdateUiSettingsDto) {
    const owner = this.owner(userId);
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    const rows: Array<{ settings: Record<string, unknown> }> =
      await this.dataSource.query(
        `INSERT INTO user_ui_settings (user_id, settings)
         SELECT id, $2::jsonb FROM user_info WHERE id = $1
         ON CONFLICT (user_id) DO UPDATE
           SET settings = user_ui_settings.settings || EXCLUDED.settings,
               updated_at = NOW()
         RETURNING settings`,
        [owner, JSON.stringify(patch)],
      );
    if (!rows.length) throw new UnauthorizedException();
    return { settings: rows[0].settings };
  }
}
