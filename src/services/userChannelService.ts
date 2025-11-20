import { randomUUID } from "crypto";
import type { Pool } from "pg";
import type { ChannelSummary, YouTubeChannelService } from "./youtubeChannelService";

interface UserChannelRow {
  channel_id: string;
  channel_name: string;
  custom_url: string;
  channel_type: string | null;
  description: string | null;
  viewcount: number | null;
  subscribercount: number | null;
  hiddensubscribercount: boolean | null;
  videocount: number | null;
  published_at: Date | null;
}

export class UserChannelService {
  constructor(
    private readonly pool: Pool,
    private readonly youtubeChannelService: YouTubeChannelService,
  ) {}

  async syncUserChannels(userId: string, accessToken: string): Promise<ChannelSummary[]> {
    const channels = await this.youtubeChannelService.fetchOwnedAndManagedChannels(
      accessToken,
    );
    await this.replaceUserChannels(userId, channels);
    return channels;
  }

  async listChannels(userId: string): Promise<ChannelSummary[]> {
    const result = await this.pool.query<UserChannelRow>(
      `SELECT channel_id,
              channel_name,
              custom_url,
              channel_type,
              description,
              viewCount,
              subscriberCount,
              hiddenSubscriberCount,
              videoCount,
              published_at
       FROM users_channels
       WHERE user_id = $1`,
      [userId],
    );

    return result.rows.map((row) => ({
      channelId: row.channel_id,
      channelName: row.channel_name,
      customUrl: row.custom_url,
      type: row.channel_type === "managed" ? "managed" : "mine",
      description: row.description,
      viewCount: row.viewcount ?? null,
      subscriberCount: row.subscribercount ?? null,
      hiddenSubscriberCount: row.hiddensubscribercount ?? null,
      videoCount: row.videocount ?? null,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
    }));
  }

  private async replaceUserChannels(userId: string, channels: ChannelSummary[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM users_channels WHERE user_id = $1`, [userId]);

      for (const channel of channels) {
        const channelName = normalizeChannelName(channel.channelName);
        const customUrl = channel.customUrl ?? "";
        const publishedAt = channel.publishedAt ? new Date(channel.publishedAt) : null;
        await client.query(
          `INSERT INTO users_channels (
             id,
             user_id,
             channel_id,
             custom_url,
             channel_name,
             channel_type,
             description,
             viewCount,
             subscriberCount,
             hiddenSubscriberCount,
             videoCount,
             published_at,
             created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
          [
            randomUUID(),
            userId,
            channel.channelId,
            customUrl,
            channelName,
            channel.type,
            channel.description,
            channel.viewCount ?? 0,
            channel.subscriberCount ?? 0,
            channel.hiddenSubscriberCount ?? false,
            channel.videoCount ?? 0,
            publishedAt,
          ],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function normalizeChannelName(name: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.length === 0) {
    return "unknown";
  }

  return trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed;
}
