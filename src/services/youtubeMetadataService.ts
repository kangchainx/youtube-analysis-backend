import type { Pool } from "pg";
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

export interface UpsertVideoStatisticsInput {
  videoId: string;
  viewCount?: string | null;
  likeCount?: string | null;
  favoriteCount?: string | null;
  commentCount?: string | null;
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
}

const DEFAULT_VIDEO_LIMIT = 50;
const MAX_VIDEO_LIMIT = 100;

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
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
  return {
    id: row.id,
    channelId: row.channel_id,
    playlistId: row.playlist_id,
    title: row.title,
    description: row.description,
    publishedAt: toIso(row.published_at),
    duration: row.duration,
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

  return { ...video, statistics };
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

  async getChannelById(channelId: string): Promise<YouTubeChannelWithStats | null> {
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
       WHERE c.id = $1`,
      [channelId],
    );

    const row = rows[0];
    return row ? mapChannelWithStatsRow(row) : null;
  }

  async upsertChannel(input: UpsertChannelInput): Promise<YouTubeChannel> {
    const { rows } = await this.pool.query<ChannelRow>(
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
  ): Promise<YouTubeChannelStatistics> {
    const { rows } = await this.pool.query<ChannelWithStatsRow>(
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

  async upsertPlaylist(input: UpsertPlaylistInput): Promise<YouTubePlaylist> {
    const { rows } = await this.pool.query<PlaylistRow>(
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

    const { rows } = await this.pool.query<VideoWithStatsRow>(
      `SELECT v.id,
              v.channel_id,
              v.playlist_id,
              v.title,
              v.description,
              v.published_at,
              v.duration,
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

    const { rows } = await this.pool.query<VideoWithStatsRow>(
      `SELECT v.id,
              v.channel_id,
              v.playlist_id,
              v.title,
              v.description,
              v.published_at,
              v.duration,
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

  async upsertVideo(input: UpsertVideoInput): Promise<YouTubeVideo> {
    const { rows } = await this.pool.query<VideoRow>(
      `INSERT INTO youtube_videos (
         id,
         channel_id,
         playlist_id,
         title,
         description,
         published_at,
         duration,
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         playlist_id = EXCLUDED.playlist_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         published_at = EXCLUDED.published_at,
         duration = EXCLUDED.duration,
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

  async upsertVideoStatistics(
    input: UpsertVideoStatisticsInput,
  ): Promise<YouTubeVideoStatistics> {
    const { rows } = await this.pool.query<VideoWithStatsRow>(
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

  async getEtag(
    resourceType: YouTubeResourceType,
    resourceId: string,
  ): Promise<YouTubeEtagCacheEntry | null> {
    const { rows } = await this.pool.query<EtagRow>(
      `SELECT resource_type, resource_id, etag, last_checked
       FROM youtube_etag_cache
       WHERE resource_type = $1 AND resource_id = $2`,
      [resourceType, resourceId],
    );

    const row = rows[0];
    return row ? mapEtagRow(row) : null;
  }

  async upsertEtag(input: UpsertEtagInput): Promise<YouTubeEtagCacheEntry> {
    const { rows } = await this.pool.query<EtagRow>(
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
