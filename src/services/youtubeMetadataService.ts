import type { Pool, PoolClient } from "pg";
import type {
  YouTubeChannel,
  YouTubeChannelStatistics,
  YouTubeChannelWithStats,
  YouTubeEtagCacheEntry,
  YouTubePlaylist,
  YouTubeResourceType,
  YouTubeVideo,
  YouTubeVideoStatistics,
  YouTubeVideoWithStats,
  YouTubeVideoTopComment,
} from "../models/youtube";

interface ChannelRow {
  id: string;
  title: string;
  description: string | null;
  custom_url: string | null;
  country: string | null;
  published_at: Date | null;
  thumbnail_url: string | null;
  uploads_playlist_id: string | null;
  last_sync: Date | null;
}

interface ChannelWithStatsRow extends ChannelRow {
  subscriber_count: string | null;
  video_count: number | null;
  view_count: string | null;
  hidden_subscriber_count: boolean | null;
  statistics_last_update: Date | null;
}

interface ChannelDailyStatisticsRow {
  snapshot_date: string;
  subscriber_count: string;
  video_count: number;
  view_count: string;
}

interface PlaylistRow {
  id: string;
  channel_id: string;
  title: string;
  description: string | null;
  item_count: number | null;
  published_at: Date | null;
  thumbnail_url: string | null;
  last_sync: Date | null;
}

interface VideoRow {
  id: string;
  channel_id: string;
  playlist_id: string | null;
  title: string;
  description: string | null;
  published_at: Date | null;
  duration: string | null;
  duration_seconds: number | string | null;
  is_short: boolean | null;
  short_rule_version: string | null;
  dimension: string | null;
  definition: string | null;
  caption: boolean | null;
  licensed_content: boolean | null;
  thumbnail_url: string | null;
  tags: string[] | null;
  default_language: string | null;
  default_audio_language: string | null;
  privacy_status: string | null;
  last_sync: Date | null;
}

interface VideoWithStatsRow extends VideoRow {
  view_count: string | null;
  like_count: string | null;
  favorite_count: string | null;
  comment_count: string | null;
  statistics_last_update: Date | null;
  top_comment_video_id?: string | null;
  top_comment_channel_id?: string | null;
  top_comment_comment_content?: string | null;
  top_comment_can_reply?: boolean | null;
  top_comment_is_public?: boolean | null;
  top_comment_like_count?: number | null;
  top_comment_total_reply_count?: number | null;
  top_comment_author_display_name?: string | null;
  top_comment_author_profile_image_url?: string | null;
  top_comment_author_channel_url?: string | null;
  top_comment_author_channel_id?: string | null;
  top_comment_published_at?: Date | null;
  top_comment_updated_at?: Date | null;
  top_comment_last_update?: Date | null;
}

interface VideoTopCommentRow {
  video_id: string;
  channel_id: string;
  comment_content: string | null;
  can_reply: boolean | null;
  is_public: boolean | null;
  like_count: number | null;
  total_reply_count: number | null;
  author_display_name: string | null;
  author_profile_image_url: string | null;
  author_channel_url: string | null;
  author_channel_id: string | null;
  published_at: Date | null;
  updated_at: Date | null;
  last_update: Date | null;
}
interface EtagRow {
  resource_type: YouTubeResourceType;
  resource_id: string;
  etag: string | null;
  last_checked: Date | null;
}

export interface UpsertChannelInput {
  id: string;
  title: string;
  description?: string | null;
  customUrl?: string | null;
  country?: string | null;
  publishedAt?: Date | null;
  thumbnailUrl?: string | null;
  uploadsPlaylistId?: string | null;
  lastSync?: Date | null;
}

export interface UpsertChannelStatisticsInput {
  channelId: string;
  subscriberCount?: string | null;
  videoCount?: number | null;
  viewCount?: string | null;
  hiddenSubscriberCount?: boolean;
  lastUpdate?: Date | null;
}

export interface UpsertChannelStatisticsDailySnapshotInput {
  channelId: string;
  snapshotDate: string; // YYYY-MM-DD (UTC)
  subscriberCount?: string | null;
  videoCount?: number | null;
  viewCount?: string | null;
  hiddenSubscriberCount?: boolean;
  capturedAt?: Date | null;
}

export interface UpsertPlaylistInput {
  id: string;
  channelId: string;
  title: string;
  description?: string | null;
  itemCount?: number | null;
  publishedAt?: Date | null;
  thumbnailUrl?: string | null;
  lastSync?: Date | null;
}

export interface UpsertVideoInput {
  id: string;
  channelId: string;
  playlistId?: string | null;
  title: string;
  description?: string | null;
  publishedAt?: Date | null;
  duration?: string | null;
  durationSeconds?: number | null;
  isShort?: boolean | null;
  shortRuleVersion?: string | null;
  dimension?: string | null;
  definition?: string | null;
  caption?: boolean | null;
  licensedContent?: boolean | null;
  thumbnailUrl?: string | null;
  tags?: string[] | null;
  defaultLanguage?: string | null;
  defaultAudioLanguage?: string | null;
  privacyStatus?: string | null;
  lastSync?: Date | null;
}

export interface UpdateVideoShortMetadataInput {
  videoId: string;
  duration?: string | null;
  durationSeconds?: number | null;
  isShort?: boolean | null;
  shortRuleVersion?: string | null;
}

export interface UpsertVideoStatisticsInput {
  videoId: string;
  viewCount?: string | null;
  likeCount?: string | null;
  favoriteCount?: string | null;
  commentCount?: string | null;
  lastUpdate?: Date | null;
}

export interface UpsertVideoStatisticsDailySnapshotInput {
  videoId: string;
  channelId: string;
  snapshotDate: string; // YYYY-MM-DD (UTC)
  viewCount?: string | null;
  likeCount?: string | null;
  favoriteCount?: string | null;
  commentCount?: string | null;
  capturedAt?: Date | null;
}

export interface UpsertVideoTopCommentInput {
  videoId: string;
  channelId: string;
  commentContent?: string | null;
  canReply?: boolean | null;
  isPublic?: boolean | null;
  likeCount?: number | null;
  totalReplyCount?: number | null;
  authorDisplayName?: string | null;
  authorProfileImageUrl?: string | null;
  authorChannelUrl?: string | null;
  authorChannelId?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  lastUpdate?: Date | null;
}

export interface UpsertEtagInput {
  resourceType: YouTubeResourceType;
  resourceId: string;
  etag?: string | null;
  lastChecked?: Date | null;
}

export interface VideoListOptions {
  limit?: number;
  offset?: number;
  includeTopComment?: boolean;
}

const DEFAULT_VIDEO_LIMIT = 50;
const MAX_VIDEO_LIMIT = 100;

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toPgBigInt(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "0";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "0";
}

function mapChannelRow(row: ChannelRow): YouTubeChannel {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    customUrl: row.custom_url,
    country: row.country,
    publishedAt: toIso(row.published_at),
    thumbnailUrl: row.thumbnail_url,
    uploadsPlaylistId: row.uploads_playlist_id,
    lastSync: toIso(row.last_sync),
  };
}

function mapChannelWithStatsRow(row: ChannelWithStatsRow): YouTubeChannelWithStats {
  const channel = mapChannelRow(row);
  const hasStats =
    row.subscriber_count !== null ||
    row.video_count !== null ||
    row.view_count !== null ||
    row.hidden_subscriber_count !== null ||
    row.statistics_last_update !== null;

  const statistics: YouTubeChannelStatistics | null = hasStats
    ? {
        channelId: row.id,
        subscriberCount: row.subscriber_count,
        videoCount: row.video_count,
        viewCount: row.view_count,
        hiddenSubscriberCount: row.hidden_subscriber_count ?? false,
        lastUpdate: toIso(row.statistics_last_update),
      }
    : null;

  return { ...channel, statistics };
}

function mapPlaylistRow(row: PlaylistRow): YouTubePlaylist {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    description: row.description,
    itemCount: row.item_count,
    publishedAt: toIso(row.published_at),
    thumbnailUrl: row.thumbnail_url,
    lastSync: toIso(row.last_sync),
  };
}

function mapVideoRow(row: VideoRow): YouTubeVideo {
  const durationSecondsRaw = row.duration_seconds;
  const durationSeconds =
    typeof durationSecondsRaw === "number"
      ? durationSecondsRaw
      : typeof durationSecondsRaw === "string"
        ? Number.parseInt(durationSecondsRaw, 10)
        : null;

  return {
    id: row.id,
    channelId: row.channel_id,
    playlistId: row.playlist_id,
    title: row.title,
    description: row.description,
    publishedAt: toIso(row.published_at),
    duration: row.duration,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    isShort: row.is_short ?? null,
    shortRuleVersion: row.short_rule_version ?? null,
    dimension: row.dimension,
    definition: row.definition,
    caption: row.caption,
    licensedContent: row.licensed_content,
    thumbnailUrl: row.thumbnail_url,
    tags: row.tags ?? [],
    defaultLanguage: row.default_language,
    defaultAudioLanguage: row.default_audio_language,
    privacyStatus: row.privacy_status,
    lastSync: toIso(row.last_sync),
  };
}

function mapVideoWithStatsRow(row: VideoWithStatsRow): YouTubeVideoWithStats {
  const video = mapVideoRow(row);
  const hasStats =
    row.view_count !== null ||
    row.like_count !== null ||
    row.favorite_count !== null ||
    row.comment_count !== null ||
    row.statistics_last_update !== null;

  const statistics: YouTubeVideoStatistics | null = hasStats
    ? {
        videoId: row.id,
        viewCount: row.view_count,
        likeCount: row.like_count,
        favoriteCount: row.favorite_count,
        commentCount: row.comment_count,
        lastUpdate: toIso(row.statistics_last_update),
      }
    : null;

  const hasTopComment =
    row.top_comment_video_id !== null && row.top_comment_video_id !== undefined;
  const topComment: YouTubeVideoTopComment | null = hasTopComment
    ? {
        videoId: row.top_comment_video_id ?? row.id,
        channelId: row.top_comment_channel_id ?? video.channelId,
        commentContent: row.top_comment_comment_content ?? null,
        canReply: row.top_comment_can_reply ?? null,
        isPublic: row.top_comment_is_public ?? null,
        likeCount: row.top_comment_like_count ?? null,
        totalReplyCount: row.top_comment_total_reply_count ?? null,
        authorDisplayName: row.top_comment_author_display_name ?? null,
        authorProfileImageUrl: row.top_comment_author_profile_image_url ?? null,
        authorChannelUrl: row.top_comment_author_channel_url ?? null,
        authorChannelId: row.top_comment_author_channel_id ?? null,
        publishedAt: toIso(row.top_comment_published_at ?? null),
        updatedAt: toIso(row.top_comment_updated_at ?? null),
        lastUpdate: toIso(row.top_comment_last_update ?? null),
      }
    : null;

  return { ...video, statistics, topComment };
}

function mapVideoTopCommentRow(row: VideoTopCommentRow): YouTubeVideoTopComment {
  return {
    videoId: row.video_id,
    channelId: row.channel_id,
    commentContent: row.comment_content,
    canReply: row.can_reply,
    isPublic: row.is_public,
    likeCount: row.like_count,
    totalReplyCount: row.total_reply_count,
    authorDisplayName: row.author_display_name,
    authorProfileImageUrl: row.author_profile_image_url,
    authorChannelUrl: row.author_channel_url,
    authorChannelId: row.author_channel_id,
    publishedAt: toIso(row.published_at),
    updatedAt: toIso(row.updated_at),
    lastUpdate: toIso(row.last_update),
  };
}

function mapEtagRow(row: EtagRow): YouTubeEtagCacheEntry {
  return {
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    etag: row.etag,
    lastChecked: toIso(row.last_checked),
  };
}

export class YouTubeMetadataService {
  constructor(private readonly pool: Pool) {}

  async runInTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    // 统一事务封装，确保调用方出现异常后自动回滚
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // eslint-disable-next-line no-console
        console.error("Failed to rollback transaction", rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async listChannels(): Promise<YouTubeChannelWithStats[]> {
    const { rows } = await this.pool.query<ChannelWithStatsRow>(
      `SELECT c.id,
              c.title,
              c.description,
              c.custom_url,
              c.country,
              c.published_at,
              c.thumbnail_url,
              c.uploads_playlist_id,
              c.last_sync,
              stats.subscriber_count,
              stats.video_count,
              stats.view_count,
              stats.hidden_subscriber_count,
              stats.last_update AS statistics_last_update
       FROM youtube_channels c
       LEFT JOIN youtube_channel_statistics stats ON stats.channel_id = c.id
       ORDER BY c.published_at DESC NULLS LAST, c.title ASC`,
    );

    return rows.map(mapChannelWithStatsRow);
  }

  async getChannelById(
    channelId: string,
    client?: PoolClient,
  ): Promise<YouTubeChannelWithStats | null> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<ChannelWithStatsRow>(
      `SELECT c.id,
              c.title,
              c.description,
              c.custom_url,
              c.country,
              c.published_at,
              c.thumbnail_url,
              c.uploads_playlist_id,
              c.last_sync,
              stats.subscriber_count,
              stats.video_count,
              stats.view_count,
              stats.hidden_subscriber_count,
              stats.last_update AS statistics_last_update
       FROM youtube_channels c
       LEFT JOIN youtube_channel_statistics stats ON stats.channel_id = c.id
       WHERE c.id = $1`,
      [channelId],
    );

    const row = rows[0];
    return row ? mapChannelWithStatsRow(row) : null;
  }

  async getChannelByCustomUrl(
    customUrl: string,
    client?: PoolClient,
  ): Promise<YouTubeChannelWithStats | null> {
    const normalizedHandle = customUrl.startsWith("@") ? customUrl : `@${customUrl}`;
    const executor = client ?? this.pool;
    const { rows } = await executor.query<ChannelWithStatsRow>(
      `SELECT c.id,
              c.title,
              c.description,
              c.custom_url,
              c.country,
              c.published_at,
              c.thumbnail_url,
              c.uploads_playlist_id,
              c.last_sync,
              stats.subscriber_count,
              stats.video_count,
              stats.view_count,
              stats.hidden_subscriber_count,
              stats.last_update AS statistics_last_update
       FROM youtube_channels c
       LEFT JOIN youtube_channel_statistics stats ON stats.channel_id = c.id
       WHERE LOWER(c.custom_url) = LOWER($1)`,
      [normalizedHandle],
    );

    const row = rows[0];
    return row ? mapChannelWithStatsRow(row) : null;
  }

  async upsertChannel(input: UpsertChannelInput, client?: PoolClient): Promise<YouTubeChannel> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<ChannelRow>(
      `INSERT INTO youtube_channels (
         id,
         title,
         description,
         custom_url,
         country,
         published_at,
         thumbnail_url,
         uploads_playlist_id,
         last_sync
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id)
       DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         custom_url = EXCLUDED.custom_url,
         country = EXCLUDED.country,
         published_at = EXCLUDED.published_at,
         thumbnail_url = EXCLUDED.thumbnail_url,
         uploads_playlist_id = EXCLUDED.uploads_playlist_id,
         last_sync = EXCLUDED.last_sync
       RETURNING id,
                 title,
                 description,
                 custom_url,
                 country,
                 published_at,
                 thumbnail_url,
                 uploads_playlist_id,
                 last_sync`,
      [
        input.id,
        input.title,
        input.description ?? null,
        input.customUrl ?? null,
        input.country ?? null,
        input.publishedAt ?? null,
        input.thumbnailUrl ?? null,
        input.uploadsPlaylistId ?? null,
        input.lastSync ?? new Date(),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Unable to upsert youtube_channels record");
    }

    return mapChannelRow(row);
  }

  async upsertChannelStatistics(
    input: UpsertChannelStatisticsInput,
    client?: PoolClient,
  ): Promise<YouTubeChannelStatistics> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<ChannelWithStatsRow>(
      `INSERT INTO youtube_channel_statistics (
         channel_id,
         subscriber_count,
         video_count,
         view_count,
         hidden_subscriber_count,
         last_update
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (channel_id)
       DO UPDATE SET
         subscriber_count = EXCLUDED.subscriber_count,
         video_count = EXCLUDED.video_count,
         view_count = EXCLUDED.view_count,
         hidden_subscriber_count = EXCLUDED.hidden_subscriber_count,
         last_update = EXCLUDED.last_update
       RETURNING channel_id AS id,
                 NULL::text AS title,
                 NULL::text AS description,
                 NULL::text AS custom_url,
                 NULL::text AS country,
                 NULL::timestamptz AS published_at,
                 NULL::text AS thumbnail_url,
                 NULL::text AS uploads_playlist_id,
                 NULL::timestamptz AS last_sync,
                 subscriber_count,
                 video_count,
                 view_count,
                 hidden_subscriber_count,
                 last_update AS statistics_last_update`,
      [
        input.channelId,
        input.subscriberCount ?? null,
        input.videoCount ?? null,
        input.viewCount ?? null,
        input.hiddenSubscriberCount ?? false,
        input.lastUpdate ?? new Date(),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Unable to upsert youtube_channel_statistics record");
    }

    return mapChannelWithStatsRow(row).statistics ?? {
      channelId: input.channelId,
      subscriberCount: input.subscriberCount ?? null,
      videoCount: input.videoCount ?? null,
      viewCount: input.viewCount ?? null,
      hiddenSubscriberCount: input.hiddenSubscriberCount ?? false,
      lastUpdate: toIso(input.lastUpdate ?? null),
    };
  }

  async upsertChannelStatisticsDailySnapshot(
    input: UpsertChannelStatisticsDailySnapshotInput,
    client?: PoolClient,
  ): Promise<void> {
    const executor = client ?? this.pool;
    await executor.query(
      `INSERT INTO youtube_channel_statistics_daily (
         channel_id,
         snapshot_date,
         subscriber_count,
         video_count,
         view_count,
         hidden_subscriber_count,
         captured_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (channel_id, snapshot_date)
       DO UPDATE SET
         subscriber_count = EXCLUDED.subscriber_count,
         video_count = EXCLUDED.video_count,
         view_count = EXCLUDED.view_count,
         hidden_subscriber_count = EXCLUDED.hidden_subscriber_count,
         captured_at = EXCLUDED.captured_at`,
      [
        input.channelId,
        input.snapshotDate,
        toPgBigInt(input.subscriberCount),
        input.videoCount ?? 0,
        toPgBigInt(input.viewCount),
        input.hiddenSubscriberCount ?? false,
        input.capturedAt ?? new Date(),
      ],
    );
  }

  async listChannelStatisticsDaily(
    channelId: string,
    range: { startDate: string; endDate: string },
    client?: PoolClient,
  ): Promise<
    Array<{
      snapshotDate: string;
      subscriberCount: string;
      viewCount: string;
      videoCount: number;
    }>
  > {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<ChannelDailyStatisticsRow>(
      `SELECT snapshot_date::text AS snapshot_date,
              subscriber_count::text AS subscriber_count,
              video_count,
              view_count::text AS view_count
       FROM youtube_channel_statistics_daily
       WHERE channel_id = $1
         AND snapshot_date::date >= $2::date
         AND snapshot_date::date <= $3::date
       ORDER BY snapshot_date::date ASC`,
      [channelId, range.startDate, range.endDate],
    );

    return rows.map((row) => ({
      snapshotDate: row.snapshot_date,
      subscriberCount: row.subscriber_count,
      viewCount: row.view_count,
      videoCount: row.video_count,
    }));
  }

  async listPlaylistsByChannel(channelId: string): Promise<YouTubePlaylist[]> {
    const { rows } = await this.pool.query<PlaylistRow>(
      `SELECT id,
              channel_id,
              title,
              description,
              item_count,
              published_at,
              thumbnail_url,
              last_sync
       FROM youtube_playlists
       WHERE channel_id = $1
       ORDER BY published_at DESC NULLS LAST, title ASC`,
      [channelId],
    );

    return rows.map(mapPlaylistRow);
  }

  async getPlaylistById(playlistId: string): Promise<YouTubePlaylist | null> {
    const { rows } = await this.pool.query<PlaylistRow>(
      `SELECT id,
              channel_id,
              title,
              description,
              item_count,
              published_at,
              thumbnail_url,
              last_sync
       FROM youtube_playlists
       WHERE id = $1`,
      [playlistId],
    );

    const row = rows[0];
    return row ? mapPlaylistRow(row) : null;
  }

  async upsertPlaylist(input: UpsertPlaylistInput, client?: PoolClient): Promise<YouTubePlaylist> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<PlaylistRow>(
      `INSERT INTO youtube_playlists (
         id,
         channel_id,
         title,
         description,
         item_count,
         published_at,
         thumbnail_url,
         last_sync
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         item_count = EXCLUDED.item_count,
         published_at = EXCLUDED.published_at,
         thumbnail_url = EXCLUDED.thumbnail_url,
         last_sync = EXCLUDED.last_sync
       RETURNING id,
                 channel_id,
                 title,
                 description,
                 item_count,
                 published_at,
                 thumbnail_url,
                 last_sync`,
      [
        input.id,
        input.channelId,
        input.title,
        input.description ?? null,
        input.itemCount ?? null,
        input.publishedAt ?? null,
        input.thumbnailUrl ?? null,
        input.lastSync ?? new Date(),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Unable to upsert youtube_playlists record");
    }

    return mapPlaylistRow(row);
  }

  async listVideosByChannel(
    channelId: string,
    options?: VideoListOptions,
  ): Promise<YouTubeVideoWithStats[]> {
    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_VIDEO_LIMIT, 1), MAX_VIDEO_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);
    const includeTopComment = options?.includeTopComment ?? false;
    // 按需拼接置顶评论字段，避免默认查询带来额外 JOIN
    const topCommentSelect = includeTopComment
      ? `,
         top.video_id AS top_comment_video_id,
         top.channel_id AS top_comment_channel_id,
         top.comment_content AS top_comment_comment_content,
         top.can_reply AS top_comment_can_reply,
         top.is_public AS top_comment_is_public,
         top.like_count AS top_comment_like_count,
         top.total_reply_count AS top_comment_total_reply_count,
         top.author_display_name AS top_comment_author_display_name,
         top.author_profile_image_url AS top_comment_author_profile_image_url,
         top.author_channel_url AS top_comment_author_channel_url,
         top.author_channel_id AS top_comment_author_channel_id,
         top.published_at AS top_comment_published_at,
         top.updated_at AS top_comment_updated_at,
         top.last_update AS top_comment_last_update`
      : "";
    const topCommentJoin = includeTopComment
      ? "LEFT JOIN youtube_video_top_comment top ON top.video_id = v.id"
      : "";

    const { rows } = await this.pool.query<VideoWithStatsRow>(
      `SELECT v.id,
              v.channel_id,
              v.playlist_id,
              v.title,
              v.description,
              v.published_at,
              v.duration,
              v.duration_seconds,
              v.is_short,
              v.short_rule_version,
              v.dimension,
              v.definition,
              v.caption,
              v.licensed_content,
              v.thumbnail_url,
              v.tags,
              v.default_language,
              v.default_audio_language,
              v.privacy_status,
              v.last_sync,
              stats.view_count,
              stats.like_count,
              stats.favorite_count,
              stats.comment_count,
              stats.last_update AS statistics_last_update
              ${topCommentSelect}
       FROM youtube_videos v
       LEFT JOIN youtube_video_statistics stats ON stats.video_id = v.id
       ${topCommentJoin}
       WHERE v.channel_id = $1
       ORDER BY v.published_at DESC NULLS LAST, v.title ASC
       LIMIT $2 OFFSET $3`,
      [channelId, limit, offset],
    );

    return rows.map(mapVideoWithStatsRow);
  }

  async listVideosByPlaylist(
    playlistId: string,
    options?: VideoListOptions,
  ): Promise<YouTubeVideoWithStats[]> {
    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_VIDEO_LIMIT, 1), MAX_VIDEO_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);
    const includeTopComment = options?.includeTopComment ?? false;
    // 复用 channel 查询的可选置顶评论逻辑
    const topCommentSelect = includeTopComment
      ? `,
         top.video_id AS top_comment_video_id,
         top.channel_id AS top_comment_channel_id,
         top.comment_content AS top_comment_comment_content,
         top.can_reply AS top_comment_can_reply,
         top.is_public AS top_comment_is_public,
         top.like_count AS top_comment_like_count,
         top.total_reply_count AS top_comment_total_reply_count,
         top.author_display_name AS top_comment_author_display_name,
         top.author_profile_image_url AS top_comment_author_profile_image_url,
         top.author_channel_url AS top_comment_author_channel_url,
         top.author_channel_id AS top_comment_author_channel_id,
         top.published_at AS top_comment_published_at,
         top.updated_at AS top_comment_updated_at,
         top.last_update AS top_comment_last_update`
      : "";
    const topCommentJoin = includeTopComment
      ? "LEFT JOIN youtube_video_top_comment top ON top.video_id = v.id"
      : "";

    const { rows } = await this.pool.query<VideoWithStatsRow>(
      `SELECT v.id,
              v.channel_id,
              v.playlist_id,
              v.title,
              v.description,
              v.published_at,
              v.duration,
              v.duration_seconds,
              v.is_short,
              v.short_rule_version,
              v.dimension,
              v.definition,
              v.caption,
              v.licensed_content,
              v.thumbnail_url,
              v.tags,
              v.default_language,
              v.default_audio_language,
              v.privacy_status,
              v.last_sync,
              stats.view_count,
              stats.like_count,
              stats.favorite_count,
              stats.comment_count,
              stats.last_update AS statistics_last_update
              ${topCommentSelect}
       FROM youtube_videos v
       LEFT JOIN youtube_video_statistics stats ON stats.video_id = v.id
       ${topCommentJoin}
       WHERE v.playlist_id = $1
       ORDER BY v.published_at DESC NULLS LAST, v.title ASC
       LIMIT $2 OFFSET $3`,
      [playlistId, limit, offset],
    );

    return rows.map(mapVideoWithStatsRow);
  }

  async getVideoById(videoId: string): Promise<YouTubeVideoWithStats | null> {
    const { rows } = await this.pool.query<VideoWithStatsRow>(
      `SELECT v.id,
              v.channel_id,
              v.playlist_id,
              v.title,
              v.description,
              v.published_at,
              v.duration,
              v.duration_seconds,
              v.is_short,
              v.short_rule_version,
              v.dimension,
              v.definition,
              v.caption,
              v.licensed_content,
              v.thumbnail_url,
              v.tags,
              v.default_language,
              v.default_audio_language,
              v.privacy_status,
              v.last_sync,
              stats.view_count,
              stats.like_count,
              stats.favorite_count,
              stats.comment_count,
              stats.last_update AS statistics_last_update
       FROM youtube_videos v
       LEFT JOIN youtube_video_statistics stats ON stats.video_id = v.id
       WHERE v.id = $1`,
      [videoId],
    );

    const row = rows[0];
    return row ? mapVideoWithStatsRow(row) : null;
  }

  async upsertVideo(input: UpsertVideoInput, client?: PoolClient): Promise<YouTubeVideo> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<VideoRow>(
      `INSERT INTO youtube_videos (
         id,
         channel_id,
         playlist_id,
         title,
         description,
         published_at,
         duration,
         duration_seconds,
         is_short,
         short_rule_version,
         dimension,
         definition,
         caption,
         licensed_content,
         thumbnail_url,
         tags,
         default_language,
         default_audio_language,
         privacy_status,
         last_sync
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (id)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         playlist_id = EXCLUDED.playlist_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         published_at = EXCLUDED.published_at,
         duration = EXCLUDED.duration,
         duration_seconds = EXCLUDED.duration_seconds,
         is_short = EXCLUDED.is_short,
         short_rule_version = EXCLUDED.short_rule_version,
         dimension = EXCLUDED.dimension,
         definition = EXCLUDED.definition,
         caption = EXCLUDED.caption,
         licensed_content = EXCLUDED.licensed_content,
         thumbnail_url = EXCLUDED.thumbnail_url,
         tags = EXCLUDED.tags,
         default_language = EXCLUDED.default_language,
         default_audio_language = EXCLUDED.default_audio_language,
         privacy_status = EXCLUDED.privacy_status,
         last_sync = EXCLUDED.last_sync
       RETURNING id,
                 channel_id,
                 playlist_id,
                 title,
                 description,
                 published_at,
                 duration,
                 duration_seconds,
                 is_short,
                 short_rule_version,
                 dimension,
                 definition,
                 caption,
                 licensed_content,
                 thumbnail_url,
                 tags,
                 default_language,
                 default_audio_language,
                 privacy_status,
                 last_sync`,
      [
        input.id,
        input.channelId,
        input.playlistId ?? null,
        input.title,
        input.description ?? null,
        input.publishedAt ?? null,
        input.duration ?? null,
        input.durationSeconds ?? null,
        input.isShort ?? null,
        input.shortRuleVersion ?? null,
        input.dimension ?? null,
        input.definition ?? null,
        input.caption ?? null,
        input.licensedContent ?? null,
        input.thumbnailUrl ?? null,
        input.tags ?? null,
        input.defaultLanguage ?? null,
        input.defaultAudioLanguage ?? null,
        input.privacyStatus ?? null,
        input.lastSync ?? new Date(),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Unable to upsert youtube_videos record");
    }

    return mapVideoRow(row);
  }

  async updateVideoShortMetadata(
    input: UpdateVideoShortMetadataInput,
    client?: PoolClient,
  ): Promise<number> {
    const executor = client ?? this.pool;
    const result = await executor.query(
      `UPDATE youtube_videos
       SET duration = $2,
           duration_seconds = $3,
           is_short = $4,
           short_rule_version = $5
       WHERE id = $1
         AND (
           duration IS DISTINCT FROM $2
           OR duration_seconds IS DISTINCT FROM $3
           OR is_short IS DISTINCT FROM $4
           OR short_rule_version IS DISTINCT FROM $5
         )`,
      [
        input.videoId,
        input.duration ?? null,
        input.durationSeconds ?? null,
        input.isShort ?? null,
        input.shortRuleVersion ?? null,
      ],
    );

    return result.rowCount ?? 0;
  }

  async upsertVideoStatistics(
    input: UpsertVideoStatisticsInput,
    client?: PoolClient,
  ): Promise<YouTubeVideoStatistics> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<VideoWithStatsRow>(
      `INSERT INTO youtube_video_statistics (
         video_id,
         view_count,
         like_count,
         favorite_count,
         comment_count,
         last_update
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (video_id)
       DO UPDATE SET
         view_count = EXCLUDED.view_count,
         like_count = EXCLUDED.like_count,
         favorite_count = EXCLUDED.favorite_count,
         comment_count = EXCLUDED.comment_count,
         last_update = EXCLUDED.last_update
	       RETURNING video_id AS id,
	                 NULL::text AS channel_id,
	                 NULL::text AS playlist_id,
	                 NULL::text AS title,
	                 NULL::text AS description,
	                 NULL::timestamptz AS published_at,
	                 NULL::text AS duration,
	                 NULL::int AS duration_seconds,
	                 NULL::boolean AS is_short,
	                 NULL::text AS short_rule_version,
	                 NULL::text AS dimension,
	                 NULL::text AS definition,
	                 NULL::boolean AS caption,
	                 NULL::boolean AS licensed_content,
	                 NULL::text AS thumbnail_url,
                 NULL::text[] AS tags,
                 NULL::text AS default_language,
                 NULL::text AS default_audio_language,
                 NULL::text AS privacy_status,
                 NULL::timestamptz AS last_sync,
                 view_count,
                 like_count,
                 favorite_count,
                 comment_count,
                 last_update AS statistics_last_update`,
      [
        input.videoId,
        input.viewCount ?? null,
        input.likeCount ?? null,
        input.favoriteCount ?? null,
        input.commentCount ?? null,
        input.lastUpdate ?? new Date(),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Unable to upsert youtube_video_statistics record");
    }

    return mapVideoWithStatsRow(row).statistics ?? {
      videoId: input.videoId,
      viewCount: input.viewCount ?? null,
      likeCount: input.likeCount ?? null,
      favoriteCount: input.favoriteCount ?? null,
      commentCount: input.commentCount ?? null,
      lastUpdate: toIso(input.lastUpdate ?? null),
    };
  }

  async upsertVideoStatisticsDailySnapshot(
    input: UpsertVideoStatisticsDailySnapshotInput,
    client?: PoolClient,
  ): Promise<void> {
    const executor = client ?? this.pool;
    await executor.query(
      `INSERT INTO youtube_video_statistics_daily (
         video_id,
         channel_id,
         snapshot_date,
         view_count,
         like_count,
         favorite_count,
         comment_count,
         captured_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (video_id, snapshot_date)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         view_count = EXCLUDED.view_count,
         like_count = EXCLUDED.like_count,
         favorite_count = EXCLUDED.favorite_count,
         comment_count = EXCLUDED.comment_count,
         captured_at = EXCLUDED.captured_at`,
      [
        input.videoId,
        input.channelId,
        input.snapshotDate,
        toPgBigInt(input.viewCount),
        toPgBigInt(input.likeCount),
        toPgBigInt(input.favoriteCount),
        toPgBigInt(input.commentCount),
        input.capturedAt ?? new Date(),
      ],
    );
  }

  async upsertVideoTopComment(
    input: UpsertVideoTopCommentInput,
    client?: PoolClient,
  ): Promise<YouTubeVideoTopComment> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<VideoTopCommentRow>(
      `INSERT INTO youtube_video_top_comment (
         video_id,
         channel_id,
         comment_content,
         can_reply,
         is_public,
         like_count,
         total_reply_count,
         author_display_name,
         author_profile_image_url,
         author_channel_url,
         author_channel_id,
         published_at,
         updated_at,
         last_update
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (video_id)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         comment_content = EXCLUDED.comment_content,
         can_reply = EXCLUDED.can_reply,
         is_public = EXCLUDED.is_public,
         like_count = EXCLUDED.like_count,
         total_reply_count = EXCLUDED.total_reply_count,
         author_display_name = EXCLUDED.author_display_name,
         author_profile_image_url = EXCLUDED.author_profile_image_url,
         author_channel_url = EXCLUDED.author_channel_url,
         author_channel_id = EXCLUDED.author_channel_id,
         published_at = EXCLUDED.published_at,
         updated_at = EXCLUDED.updated_at,
         last_update = EXCLUDED.last_update
       RETURNING video_id,
                 channel_id,
                 comment_content,
                 can_reply,
                 is_public,
                 like_count,
                 total_reply_count,
                 author_display_name,
                 author_profile_image_url,
                 author_channel_url,
                 author_channel_id,
                 published_at,
                 updated_at,
                 last_update`,
      [
        input.videoId,
        input.channelId,
        input.commentContent ?? null,
        input.canReply ?? null,
        input.isPublic ?? null,
        input.likeCount ?? null,
        input.totalReplyCount ?? null,
        input.authorDisplayName ?? null,
        input.authorProfileImageUrl ?? null,
        input.authorChannelUrl ?? null,
        input.authorChannelId ?? null,
        input.publishedAt ?? null,
        input.updatedAt ?? null,
        input.lastUpdate ?? new Date(),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Unable to upsert youtube_video_top_comment record");
    }

    return mapVideoTopCommentRow(row);
  }

  async getEtag(
    resourceType: YouTubeResourceType,
    resourceId: string,
    client?: PoolClient,
  ): Promise<YouTubeEtagCacheEntry | null> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<EtagRow>(
      `SELECT resource_type, resource_id, etag, last_checked
       FROM youtube_etag_cache
       WHERE resource_type = $1 AND resource_id = $2`,
      [resourceType, resourceId],
    );

    const row = rows[0];
    return row ? mapEtagRow(row) : null;
  }

  async upsertEtag(
    input: UpsertEtagInput,
    client?: PoolClient,
  ): Promise<YouTubeEtagCacheEntry> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<EtagRow>(
      `INSERT INTO youtube_etag_cache (
         resource_type,
         resource_id,
         etag,
         last_checked
       )
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (resource_type, resource_id)
       DO UPDATE SET
         etag = EXCLUDED.etag,
         last_checked = EXCLUDED.last_checked
       RETURNING resource_type, resource_id, etag, last_checked`,
      [
        input.resourceType,
        input.resourceId,
        input.etag ?? null,
        input.lastChecked ?? new Date(),
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Unable to upsert youtube_etag_cache record");
    }

    return mapEtagRow(row);
  }
}
