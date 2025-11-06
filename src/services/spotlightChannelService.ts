import type { Pool } from "pg";
import type { SpotlightChannel } from "../models/spotlightChannel";

interface SpotlightChannelRow {
  id: string;
  handle: string;
  channel_id: string | null;
  title: string;
  description: string | null;
  avatar_url: string | null;
  total_views: string | null;
  total_subscribers: string | null;
  order_index: number | null;
  is_active: boolean;
  last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function parseBigInt(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function mapSpotlightChannelRow(row: SpotlightChannelRow): SpotlightChannel {
  return {
    id: row.id,
    handle: row.handle,
    channelId: row.channel_id,
    title: row.title,
    description: row.description,
    avatarUrl: row.avatar_url,
    totalViews: parseBigInt(row.total_views),
    totalSubscribers: parseBigInt(row.total_subscribers),
    order: row.order_index,
    isActive: row.is_active,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class SpotlightChannelService {
  constructor(private readonly pool: Pool) {}

  async listActiveChannels(): Promise<SpotlightChannel[]> {
    const { rows } = await this.pool.query<SpotlightChannelRow>(
      `SELECT id,
              handle,
              channel_id,
              title,
              description,
              avatar_url,
              total_views,
              total_subscribers,
              order_index,
              is_active,
              last_synced_at,
              created_at,
              updated_at
       FROM spotlight_channels
       WHERE is_active = TRUE
       ORDER BY order_index ASC NULLS LAST, updated_at DESC`,
    );

    return rows.map(mapSpotlightChannelRow);
  }

  async upsertChannel(params: {
    handle: string;
    channelId: string;
    title: string;
    description: string | null;
    avatarUrl: string | null;
    totalViews: string | null;
    totalSubscribers: string | null;
    lastSyncedAt: Date;
    orderIndex?: number;
    isActive?: boolean;
  }): Promise<void> {
    const now = new Date();

    await this.pool.query(
      `INSERT INTO spotlight_channels (
         handle,
         channel_id,
         title,
         description,
         avatar_url,
         total_views,
         total_subscribers,
         order_index,
         is_active,
         last_synced_at,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (handle)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         avatar_url = EXCLUDED.avatar_url,
         total_views = EXCLUDED.total_views,
         total_subscribers = EXCLUDED.total_subscribers,
         order_index = EXCLUDED.order_index,
         is_active = EXCLUDED.is_active,
         last_synced_at = EXCLUDED.last_synced_at,
         updated_at = EXCLUDED.updated_at`,
      [
        params.handle,
        params.channelId,
        params.title,
        params.description,
        params.avatarUrl,
        params.totalViews,
        params.totalSubscribers,
        params.orderIndex ?? null,
        params.isActive ?? true,
        params.lastSyncedAt,
        now,
        now,
      ],
    );
  }

  async deactivateMissingHandles(handles: string[]): Promise<void> {
    if (handles.length === 0) {
      await this.pool.query(
        `UPDATE spotlight_channels
         SET is_active = FALSE,
             updated_at = NOW()
         WHERE is_active = TRUE`,
      );
      return;
    }

    await this.pool.query(
      `UPDATE spotlight_channels
       SET is_active = FALSE,
           updated_at = NOW()
       WHERE is_active = TRUE
         AND handle <> ALL($1::text[])`,
      [handles],
    );
  }
}
