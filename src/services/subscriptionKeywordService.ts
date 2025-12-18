import type { Pool } from "pg";

export interface TitleKeywordItem {
  keyword: string;
  score: number;
  videoCount: number;
  channelCount: number;
}

export interface TitleKeywordsResult {
  windowDays: number;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC)
  candidateLimit: number;
  likeWeight: number;
  limit: number;
  keywords: TitleKeywordItem[];
}

interface CandidateVideoRow {
  video_id: string;
  channel_id: string;
  title: string;
  view_delta: string;
  like_delta: string;
  hot_score: string;
}

type TokenType = "han" | "latin" | "num";

interface Token {
  type: TokenType;
  text: string;
  start: number;
  end: number;
}

const DEFAULT_DAYS = 30;
const DEFAULT_KEYWORD_LIMIT = 10;
const DEFAULT_CANDIDATE_LIMIT = 500;
const DEFAULT_LIKE_WEIGHT = 50;

const ENGLISH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "you",
]);

const CHINESE_STOPWORDS = new Set([
  "官方",
  "完整版",
  "合集",
  "教程",
  "推荐",
  "更新",
  "第",
  "期",
  "集",
  "直播",
  "回放",
  "视频",
  "频道",
]);

const KEEP_SHORT_LATIN = new Set(["ai", "gpt"]);

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, deltaDays: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + deltaDays);
  return copy;
}

function normalizeKeywordKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isValidKeyword(display: string, key: string): boolean {
  if (display.length === 0) {
    return false;
  }

  if (/^\d+$/.test(display)) {
    return false;
  }

  // 过滤单个中文字符
  if (/^[\u4e00-\u9fff]$/.test(display)) {
    return false;
  }

  if (/^[a-z0-9 ]+$/i.test(display)) {
    const compact = key.replace(/ /g, "");
    if (compact.length < 2 && !KEEP_SHORT_LATIN.has(compact)) {
      return false;
    }
    if (ENGLISH_STOPWORDS.has(key)) {
      return false;
    }
  }

  if (/^[\u4e00-\u9fff]+$/.test(display) && CHINESE_STOPWORDS.has(display)) {
    return false;
  }

  return true;
}

function classifyToken(text: string): TokenType {
  if (/^\d+$/.test(text)) {
    return "num";
  }
  if (/^[A-Za-z]+$/.test(text)) {
    return "latin";
  }
  return "han";
}

function tokenizeTitle(title: string): Token[] {
  const tokens: Token[] = [];
  const re = /[\u4e00-\u9fff]+|[A-Za-z]+|\d+/g;
  for (const match of title.matchAll(re)) {
    const text = match[0];
    const start = match.index ?? 0;
    tokens.push({
      type: classifyToken(text),
      text,
      start,
      end: start + text.length,
    });
  }
  return tokens;
}

function extractKeywordsFromTitle(title: string): Array<{ key: string; display: string }> {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const tokens = tokenizeTitle(trimmed);
  if (tokens.length === 0) {
    return [];
  }

  const perTitle = new Map<string, { display: string }>();

  const add = (display: string) => {
    const key = normalizeKeywordKey(display);
    if (!isValidKeyword(display, key)) {
      return;
    }
    if (!perTitle.has(key)) {
      perTitle.set(key, { display });
    }
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    if (!current) {
      continue;
    }

    const next = tokens[index + 1];

    if (current.type === "latin" && next) {
      const gap = trimmed.slice(current.end, next.start);
      const whitespaceOnly = /^\s*$/.test(gap);
      if (whitespaceOnly && next.type === "num") {
        const third = tokens[index + 2];
        if (third && third.type === "latin") {
          const gap2 = trimmed.slice(next.end, third.start);
          if (/^\s*$/.test(gap2)) {
            add(`${current.text} ${next.text} ${third.text}`);
            index += 2;
            continue;
          }
        }
        add(`${current.text} ${next.text}`);
        index += 1;
        continue;
      }

      if (whitespaceOnly && next.type === "han") {
        add(`${current.text}${next.text}`);
        index += 1;
        continue;
      }
    }

    if (current.type === "num") {
      continue;
    }

    add(current.text);
  }

  return [...perTitle.entries()].map(([key, value]) => ({ key, display: value.display }));
}

function safeHotScoreWeight(hotScore: string): number {
  const asNumber = Number(hotScore);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return 0;
  }
  return Math.log1p(asNumber);
}

export class SubscriptionKeywordService {
  constructor(private readonly pool: Pool) {}

  async getTitleKeywords(
    userId: string,
    options?: {
      days?: number;
      limit?: number;
      candidateLimit?: number;
      likeWeight?: number;
    },
  ): Promise<TitleKeywordsResult> {
    const windowDaysRaw = options?.days ?? DEFAULT_DAYS;
    const windowDays = Math.min(Math.max(windowDaysRaw, 1), 3650);
    const limitRaw = options?.limit ?? DEFAULT_KEYWORD_LIMIT;
    const limit = Math.min(Math.max(limitRaw, 1), 50);
    const candidateLimitRaw = options?.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
    const candidateLimit = Math.min(Math.max(candidateLimitRaw, 50), 5000);
    const likeWeightRaw = options?.likeWeight ?? DEFAULT_LIKE_WEIGHT;
    const likeWeight = Math.min(Math.max(likeWeightRaw, 0), 1000);

    const end = new Date();
    const endDate = toUtcDateString(end);
    const startDate = toUtcDateString(shiftUtcDays(end, -(windowDays - 1)));

    const candidates = await this.fetchCandidates(userId, endDate, windowDays, likeWeight, candidateLimit);
    if (candidates.length === 0) {
      return {
        windowDays,
        startDate,
        endDate,
        candidateLimit,
        likeWeight,
        limit,
        keywords: [],
      };
    }

    type Agg = {
      key: string;
      keyword: string;
      score: number;
      bestWeight: number;
      videoIds: Set<string>;
      channelIds: Set<string>;
    };

    const aggByKey = new Map<string, Agg>();

    for (const video of candidates) {
      const weight = safeHotScoreWeight(video.hot_score);
      if (weight <= 0) {
        continue;
      }

      const extracted = extractKeywordsFromTitle(video.title);
      for (const item of extracted) {
        const existing = aggByKey.get(item.key);
        if (!existing) {
          aggByKey.set(item.key, {
            key: item.key,
            keyword: item.display,
            score: weight,
            bestWeight: weight,
            videoIds: new Set([video.video_id]),
            channelIds: new Set([video.channel_id]),
          });
          continue;
        }

        existing.score += weight;
        existing.videoIds.add(video.video_id);
        existing.channelIds.add(video.channel_id);
        if (weight > existing.bestWeight) {
          existing.bestWeight = weight;
          existing.keyword = item.display;
        }
      }
    }

    const keywords = [...aggByKey.values()]
      .map((item) => ({
        keyword: item.keyword,
        score: Number(item.score.toFixed(4)),
        videoCount: item.videoIds.size,
        channelCount: item.channelIds.size,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      windowDays,
      startDate,
      endDate,
      candidateLimit,
      likeWeight,
      limit,
      keywords,
    };
  }

  private async fetchCandidates(
    userId: string,
    endDate: string,
    windowDays: number,
    likeWeight: number,
    candidateLimit: number,
  ): Promise<CandidateVideoRow[]> {
    const { rows } = await this.pool.query<CandidateVideoRow>(
      `
      WITH params AS (
        SELECT $1::uuid AS user_id,
               $2::date AS d_end,
               ($2::date - GREATEST($3::int - 1, 0)) AS d_start,
               $4::bigint AS like_weight
      ),
      channels AS (
        SELECT DISTINCT sci.channel_id
        FROM subscribed_channel_info sci, params
        WHERE sci.user_id = params.user_id
      ),
      recent_videos AS (
        SELECT v.id AS video_id,
               v.channel_id,
               v.title
        FROM youtube_videos v
        JOIN channels c ON c.channel_id = v.channel_id
        JOIN params p ON TRUE
        WHERE v.published_at IS NOT NULL
          AND (v.published_at AT TIME ZONE 'utc')::date BETWEEN p.d_start AND p.d_end
          AND v.duration_seconds IS NOT NULL
          AND v.duration_seconds > 180
          AND v.title IS NOT NULL
          AND length(trim(v.title)) > 0
      ),
      baseline AS (
        SELECT DISTINCT ON (d.video_id)
          d.video_id,
          d.view_count::bigint AS view_count,
          d.like_count::bigint AS like_count
        FROM youtube_video_statistics_daily d
        JOIN recent_videos rv ON rv.video_id = d.video_id
        JOIN params p ON TRUE
        WHERE d.snapshot_date::date BETWEEN p.d_start AND p.d_end
        ORDER BY d.video_id, d.snapshot_date::date ASC
      ),
      latest AS (
        SELECT DISTINCT ON (d.video_id)
          d.video_id,
          d.view_count::bigint AS view_count,
          d.like_count::bigint AS like_count
        FROM youtube_video_statistics_daily d
        JOIN recent_videos rv ON rv.video_id = d.video_id
        JOIN params p ON TRUE
        WHERE d.snapshot_date::date BETWEEN p.d_start AND p.d_end
        ORDER BY d.video_id, d.snapshot_date::date DESC
      ),
      scored AS (
        SELECT
          rv.video_id,
          rv.channel_id,
          rv.title,
          GREATEST(l.view_count - b.view_count, 0)::bigint AS view_delta,
          GREATEST(l.like_count - b.like_count, 0)::bigint AS like_delta,
          (
            GREATEST(l.view_count - b.view_count, 0)
            + GREATEST(l.like_count - b.like_count, 0) * p.like_weight
          )::bigint AS hot_score
        FROM recent_videos rv
        JOIN latest l ON l.video_id = rv.video_id
        JOIN baseline b ON b.video_id = rv.video_id
        JOIN params p ON TRUE
      )
      SELECT
        video_id,
        channel_id,
        title,
        view_delta::text AS view_delta,
        like_delta::text AS like_delta,
        hot_score::text AS hot_score
      FROM scored
      ORDER BY hot_score DESC NULLS LAST
      LIMIT $5::int
      `,
      [userId, endDate, windowDays, likeWeight, candidateLimit],
    );

    return rows;
  }
}
