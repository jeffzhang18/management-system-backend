import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchNavigation1794355200000 implements MigrationInterface {
  name = 'AddSearchNavigation1794355200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE search_settings (
        user_id BIGINT PRIMARY KEY REFERENCES user_info(id) ON DELETE CASCADE,
        default_engine VARCHAR(8) NOT NULL DEFAULT 'google' CHECK (default_engine IN ('google','baidu','bing')),
        open_in_new_tab BOOLEAN NOT NULL DEFAULT TRUE,
        background_mode VARCHAR(8) NOT NULL DEFAULT 'default' CHECK (background_mode IN ('default','online')),
        wallpaper_url VARCHAR(2048),
        overlay_opacity DOUBLE PRECISION NOT NULL DEFAULT 0.3 CHECK (overlay_opacity BETWEEN 0 AND 0.85),
        icon_size INTEGER NOT NULL DEFAULT 72 CHECK (icon_size BETWEEN 40 AND 112),
        gap INTEGER NOT NULL DEFAULT 24 CHECK (gap BETWEEN 8 AND 48),
        radius INTEGER NOT NULL DEFAULT 20 CHECK (radius >= 0 AND radius <= icon_size / 2.0),
        layout_direction VARCHAR(8) NOT NULL DEFAULT 'row' CHECK (layout_direction IN ('row','column')),
        items_per_line INTEGER NOT NULL DEFAULT 8 CHECK (items_per_line BETWEEN 1 AND 12),
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (wallpaper_url IS NULL OR wallpaper_url ~ '^https://'),
        CHECK (background_mode <> 'online' OR wallpaper_url IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE search_bookmark (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES user_info(id) ON DELETE CASCADE,
        name VARCHAR(80) NOT NULL CHECK (length(btrim(name)) > 0),
        url VARCHAR(2048) NOT NULL CHECK (url ~ '^https?://'),
        title_source VARCHAR(8) NOT NULL CHECK (title_source IN ('auto','custom')),
        icon_source VARCHAR(8) NOT NULL CHECK (icon_source IN ('auto','custom')),
        icon_url VARCHAR(2048),
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        metadata_fetched_at TIMESTAMPTZ,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (icon_url IS NULL OR icon_url ~ '^https://'),
        CHECK (icon_source <> 'custom' OR icon_url IS NOT NULL)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX idx_search_bookmark_user_order ON search_bookmark(user_id, sort_order, id)',
    );
    await queryRunner.query(`
      CREATE TABLE search_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES user_info(id) ON DELETE CASCADE,
        query VARCHAR(1000) NOT NULL CHECK (length(btrim(query)) > 0),
        engine VARCHAR(8) NOT NULL CHECK (engine IN ('google','baidu','bing')),
        target_url TEXT NOT NULL,
        target_host VARCHAR(100) NOT NULL,
        source VARCHAR(32) NOT NULL DEFAULT '/search' CHECK (source = '/search'),
        request_id UUID NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_search_history_request UNIQUE (user_id, request_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX idx_search_history_user_time ON search_history(user_id, created_at DESC, id DESC)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE search_history');
    await queryRunner.query('DROP TABLE search_bookmark');
    await queryRunner.query('DROP TABLE search_settings');
  }
}
