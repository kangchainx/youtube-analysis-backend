import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { YouTubeChannel } from "../models/youtube";

export interface UserSubscribedChannel {
  id: string;
  userId: string;
  channelId: string;
  customUrl: string | null;
  channel: YouTubeChannel | null;
}

export interface SubscriptionFilterOptions {
  channelId?: string;
  customUrl?: string;
  channelName?: string;
  country?: string;
}

export interface SubscriptionListOptions {
  limit: number;
  offset: number;
  filters?: SubscriptionFilterOptions;
}

export class SubscribedChannelService {
  constructor(private readonly pool: Pool) {}

  async subscribeUserToChannel(
    userId: string,
    channelId: string,
    customUrl: string | null,
    client?: PoolClient,
  ): Promise<boolean> {
    const normalizedCustomUrl = customUrl ?? channelId;

    const executor = client ?? this.pool;
    const result = await executor.query(
      `INSERT INTO subscribed_channel_info (id, channel_id, custom_url, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, channel_id) DO NOTHING
       RETURNING 1`,
      [randomUUID(), channelId, normalizedCustomUrl, userId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async unsubscribeUserFromChannel(
    userId: string,
    channelId: string,
    client?: PoolClient,
  ): Promise<boolean> {
    const executor = client ?? this.pool;
    const result = await executor.query(
      `DELETE FROM subscribed_channel_info
       WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listUserSubscriptions(
    userId: string,
    options: SubscriptionListOptions,
  ): Promise<UserSubscribedChannel[]> {
    const { limit, offset, filters } = options;

    const whereClauses = ["sci.user_id = $1"];
    const values: unknown[] = [userId];

    const addFilter = (clauseFactory: (index: number) => string, value: string) => {
      values.push(value);
      whereClauses.push(clauseFactory(values.length));
    };

    if (filters?.channelId) {
      addFilter((index) => `sci.channel_id = $${index}`, filters.channelId);
    }

    if (filters?.customUrl) {
      addFilter(
        (index) => `(sci.custom_url = $${index} OR yc.custom_url = $${index})`,
        filters.customUrl,
      );
    }

    if (filters?.country) {
      addFilter((index) => `yc.country = $${index}`, filters.country);
    }

    if (filters?.channelName) {
      addFilter((index) => `yc.title ILIKE $${index}`, `%${filters.channelName}%`);
    }

    values.push(limit);
    values.push(offset);

    const { rows } = await this.pool.query<{
      id: string;
      user_id: string;
      channel_id: string;
      custom_url: string | null;
      channel_title: string | null;
      channel_description: string | null;
      channel_custom_url: string | null;
      channel_country: string | null;
      channel_published_at: Date | null;
      channel_thumbnail_url: string | null;
      channel_uploads_playlist_id: string | null;
      channel_last_sync: Date | null;
    }>(
      `SELECT sci.id,
              sci.user_id,
              sci.channel_id,
              sci.custom_url,
              yc.title AS channel_title,
              yc.description AS channel_description,
              yc.custom_url AS channel_custom_url,
              yc.country AS channel_country,
              yc.published_at AS channel_published_at,
              yc.thumbnail_url AS channel_thumbnail_url,
              yc.uploads_playlist_id AS channel_uploads_playlist_id,
              yc.last_sync AS channel_last_sync
       FROM subscribed_channel_info sci
       LEFT JOIN youtube_channels yc ON yc.id = sci.channel_id
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY COALESCE(yc.title, sci.custom_url, sci.channel_id) ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      channelId: row.channel_id,
      customUrl: row.custom_url,
      channel: row.channel_id
        ? {
            id: row.channel_id,
            title: row.channel_title ?? row.channel_id,
            description: row.channel_description,
            customUrl: row.channel_custom_url,
            country: row.channel_country,
            publishedAt: row.channel_published_at
              ? row.channel_published_at.toISOString()
              : null,
            thumbnailUrl: row.channel_thumbnail_url,
            uploadsPlaylistId: row.channel_uploads_playlist_id,
            lastSync: row.channel_last_sync ? row.channel_last_sync.toISOString() : null,
          }
        : null,
    }));
  }

  async listDistinctChannelIds(): Promise<string[]> {
    const { rows } = await this.pool.query<{ channel_id: string }>(
      `SELECT DISTINCT channel_id
       FROM subscribed_channel_info
       ORDER BY channel_id ASC`,
    );

    return rows.map((row) => row.channel_id);
  }

  async isUserSubscribedToChannel(userId: string, channelId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
       FROM subscribed_channel_info
       WHERE user_id = $1 AND channel_id = $2
       LIMIT 1`,
      [userId, channelId],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
