import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SearchEngine = 'google' | 'baidu' | 'bing';

@Entity({ name: 'search_settings', synchronize: false })
export class SearchSettings {
  @PrimaryColumn({ name: 'user_id', type: 'bigint' }) userId: string;
  @Column({ name: 'default_engine', type: 'varchar', length: 8 })
  defaultEngine: SearchEngine;
  @Column({ name: 'open_in_new_tab', type: 'boolean' }) openInNewTab: boolean;
  @Column({ name: 'background_mode', type: 'varchar', length: 8 })
  backgroundMode: 'default' | 'gradient' | 'online';
  @Column({
    name: 'gradient_from',
    type: 'varchar',
    length: 7,
    default: '#1e3a8a',
  })
  gradientFrom: string;
  @Column({
    name: 'gradient_to',
    type: 'varchar',
    length: 7,
    default: '#6d28d9',
  })
  gradientTo: string;
  @Column({ name: 'gradient_angle', type: 'integer', default: 135 })
  gradientAngle: number;
  @Column({
    name: 'wallpaper_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  wallpaperUrl: string | null;
  @Column({ name: 'overlay_opacity', type: 'double precision' })
  overlayOpacity: number;
  @Column({ name: 'icon_size', type: 'integer' }) iconSize: number;
  @Column({ type: 'integer' }) gap: number;
  @Column({ type: 'integer' }) radius: number;
  @Column({ name: 'layout_direction', type: 'varchar', length: 8 })
  layoutDirection: 'row' | 'column';
  @Column({ name: 'items_per_line', type: 'integer' }) itemsPerLine: number;
  @Column({ type: 'integer', default: 1 }) version: number;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity({ name: 'search_bookmark', synchronize: false })
@Index('idx_search_bookmark_user_order', ['userId', 'sortOrder', 'id'])
export class SearchBookmark {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ name: 'user_id', type: 'bigint' }) userId: string;
  @Column({ type: 'varchar', length: 80 }) name: string;
  @Column({ type: 'varchar', length: 2048 }) url: string;
  @Column({ name: 'title_source', type: 'varchar', length: 8 }) titleSource:
    | 'auto'
    | 'custom';
  @Column({ name: 'icon_source', type: 'varchar', length: 8 }) iconSource:
    | 'auto'
    | 'custom';
  @Column({ name: 'icon_url', type: 'varchar', length: 2048, nullable: true })
  iconUrl: string | null;
  @Column({ name: 'sort_order', type: 'integer' }) sortOrder: number;
  @Column({ name: 'metadata_fetched_at', type: 'timestamptz', nullable: true })
  metadataFetchedAt: Date | null;
  @Column({ type: 'integer', default: 1 }) version: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity({ name: 'search_history', synchronize: false })
@Index('uq_search_history_request', ['userId', 'requestId'], { unique: true })
@Index('idx_search_history_user_time', ['userId', 'createdAt', 'id'])
export class SearchHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ name: 'user_id', type: 'bigint' }) userId: string;
  @Column({ type: 'varchar', length: 1000 }) query: string;
  @Column({ type: 'varchar', length: 8 }) engine: SearchEngine;
  @Column({ name: 'target_url', type: 'text' }) targetUrl: string;
  @Column({ name: 'target_host', type: 'varchar', length: 100 })
  targetHost: string;
  @Column({ type: 'varchar', length: 32 }) source: string;
  @Column({ name: 'request_id', type: 'uuid' }) requestId: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
