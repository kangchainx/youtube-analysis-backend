import type { Pool } from "pg";

export interface SubscriptionCardChannel {
  id: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
}

export interface SubscriptionCardTopMetric {
  channel: SubscriptionCardChannel;
  value: string; // bigint as string
  growthRate: string | null; // delta / baseline (numeric as string)
}

export interface SubscriptionCardsResult {
  windowDays: number;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC)
  top1: {
    subscriberGrowth: SubscriptionCardTopMetric | null;
    traffic: SubscriptionCardTopMetric | null;
    diligence: SubscriptionCardTopMetric | null;
  };
}

interface ChannelTopRow {
  metric: "subscriberGrowth" | "traffic" | "diligence";
  channel_id: string;
  value: string;
  growth_rate: string | null;
  title: string | null;
  custom_url: string | null;
  thumbnail_url: string | null;
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, deltaDays: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + deltaDays);
  return copy;
}

function normalizeChannel(row: {
  channel_id: string;
  title: string | null;
  custom_url: string | null;
  thumbnail_url: string | null;
}): SubscriptionCardChannel {
  return {
    id: row.channel_id,
    title: row.title ?? row.channel_id,
    customUrl: row.custom_url,
    thumbnailUrl: row.thumbnail_url,
  };
}

export class SubscriptionCardService {
  constructor(private readonly pool: Pool) {}

  async getTop1Cards(userId: string, options?: { days?: number }): Promise<SubscriptionCardsResult> {
    const windowDaysRaw = options?.days ?? 30;
    const windowDays = Math.min(Math.max(windowDaysRaw, 1), 3650);

    const end = new Date();
    const endDate = toUtcDateString(end);
    const startDate = toUtcDateString(shiftUtcDays(end, -windowDays));

    const channelMetrics = await this.fetchChannelTopMetrics(userId, endDate, windowDays);

    const subscriberGrowth = channelMetrics.find((row) => row.metric === "subscriberGrowth");
    const traffic = channelMetrics.find((row) => row.metric === "traffic");
    const diligence = channelMetrics.find((row) => row.metric === "diligence");

    return {
      windowDays,
      startDate,
      endDate,
      top1: {
        subscriberGrowth: subscriberGrowth
          ? {
              channel: normalizeChannel(subscriberGrowth),
              value: subscriberGrowth.value,
              growthRate: subscriberGrowth.growth_rate,
            }
          : null,
        traffic: traffic
          ? { channel: normalizeChannel(traffic), value: traffic.value, growthRate: traffic.growth_rate }
          : null,
        diligence: diligence
          ? { channel: normalizeChannel(diligence), value: diligence.value, growthRate: diligence.growth_rate }
          : null,
      },
    };
  }

  private async fetchChannelTopMetrics(
    userId: string,
    endDate: string,
    windowDays: number,
  ): Promise<ChannelTopRow[]> {
    const { rows } = await this.pool.query<ChannelTopRow>(
      `
      WITH params AS (
        SELECT $1::uuid AS user_id,
               $2::date AS d_end,
               ($2::date - $3::int) AS d_start
      ),
      channels AS (
        SELECT DISTINCT sci.channel_id
        FROM subscribed_channel_info sci, params
        WHERE sci.user_id = params.user_id
      ),
      latest AS (
        SELECT DISTINCT ON (d.channel_id)
          d.channel_id,
          d.snapshot_date::date AS snapshot_date,
          d.subscriber_count::bigint AS subscriber_count,
          d.view_count::bigint AS view_count,
          d.video_count::bigint AS video_count
        FROM youtube_channel_statistics_daily d
        JOIN channels c ON c.channel_id = d.channel_id
        JOIN params p ON TRUE
        WHERE d.snapshot_date::date >= p.d_start AND d.snapshot_date::date <= p.d_end
        ORDER BY d.channel_id, d.snapshot_date::date DESC
      ),
      baseline AS (
        SELECT DISTINCT ON (d.channel_id)
          d.channel_id,
          d.snapshot_date::date AS snapshot_date,
          d.subscriber_count::bigint AS subscriber_count,
          d.view_count::bigint AS view_count,
          d.video_count::bigint AS video_count
        FROM youtube_channel_statistics_daily d
        JOIN channels c ON c.channel_id = d.channel_id
        JOIN params p ON TRUE
        WHERE d.snapshot_date::date >= p.d_start AND d.snapshot_date::date <= p.d_end
        ORDER BY d.channel_id, d.snapshot_date::date ASC
      ),
      deltas AS (
        SELECT
          l.channel_id,
          (l.subscriber_count - b.subscriber_count)::bigint AS subscriber_growth,
          (l.view_count - b.view_count)::bigint AS view_growth,
          (l.video_count - b.video_count)::bigint AS video_growth,
          CASE
            WHEN b.subscriber_count > 0
              THEN (l.subscriber_count - b.subscriber_count)::numeric / b.subscriber_count
            ELSE NULL
          END AS subscriber_growth_rate,
          CASE
            WHEN b.view_count > 0
              THEN (l.view_count - b.view_count)::numeric / b.view_count
            ELSE NULL
          END AS view_growth_rate,
          CASE
            WHEN b.video_count > 0
              THEN (l.video_count - b.video_count)::numeric / b.video_count
            ELSE NULL
          END AS video_growth_rate
        FROM latest l
        JOIN baseline b ON b.channel_id = l.channel_id
      ),
      top_subscriber AS (
        SELECT 'subscriberGrowth'::text AS metric,
               channel_id,
               subscriber_growth::text AS value,
               subscriber_growth_rate::text AS growth_rate
        FROM deltas
        ORDER BY subscriber_growth DESC NULLS LAST
        LIMIT 1
      ),
      top_traffic AS (
        SELECT 'traffic'::text AS metric,
               channel_id,
               view_growth::text AS value,
               view_growth_rate::text AS growth_rate
        FROM deltas
        ORDER BY view_growth DESC NULLS LAST
        LIMIT 1
      ),
      top_diligence AS (
        SELECT 'diligence'::text AS metric,
               channel_id,
               video_growth::text AS value,
               video_growth_rate::text AS growth_rate
        FROM deltas
        ORDER BY video_growth DESC NULLS LAST
        LIMIT 1
      )
      SELECT t.metric::text AS metric,
             t.channel_id,
             t.value,
             t.growth_rate,
             yc.title,
             yc.custom_url,
             yc.thumbnail_url
      FROM (
        SELECT * FROM top_subscriber
        UNION ALL
        SELECT * FROM top_traffic
        UNION ALL
        SELECT * FROM top_diligence
      ) t
      LEFT JOIN youtube_channels yc ON yc.id = t.channel_id
      `,
      [userId, endDate, windowDays],
    );

    return rows;
  }
}
