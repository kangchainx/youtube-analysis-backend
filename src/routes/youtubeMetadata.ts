import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import {
  subscribedChannelService,
  subscriptionCardService,
  subscriptionKeywordService,
  youtubeMetadataService,
  youtubeSubscriptionService,
} from "../services";
import type { SubscriptionFilterOptions } from "../services/subscribedChannelService";
import { AppError } from "../utils/appError";

export const youtubeMetadataRouter = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// 该路由下所有接口都要求已登录
youtubeMetadataRouter.use(requireAuth);

// POST /youtube/subscribe：订阅指定频道，支持 channel_id 或 channelId
youtubeMetadataRouter.post("/subscribe", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录后再订阅频道", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    if (!req.body || typeof req.body !== "object") {
      throw new AppError("请求体格式不正确", {
        statusCode: 400,
        code: "INVALID_REQUEST_BODY",
      });
    }

    const record = req.body as Record<string, unknown>;
    const candidate = (record.channel_id ?? record.channelId) as unknown;
    const rawChannelId = Array.isArray(candidate) ? candidate[0] : candidate;

    // 支持 snake/camel 两种风格，取第一个 channelId
    if (typeof rawChannelId !== "string" || rawChannelId.trim().length === 0) {
      throw new AppError("channel_id 必须是非空字符串", {
        statusCode: 400,
        code: "CHANNEL_ID_REQUIRED",
      });
    }

    const result = await youtubeSubscriptionService.subscribeChannel(
      rawChannelId.trim(),
      currentUser.id,
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

// DELETE /youtube/subscribe：退订指定频道
youtubeMetadataRouter.delete("/subscribe", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录后再退订频道", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    if (!req.body || typeof req.body !== "object") {
      throw new AppError("请求体格式不正确", {
        statusCode: 400,
        code: "INVALID_REQUEST_BODY",
      });
    }

    const record = req.body as Record<string, unknown>;
    const candidate = (record.channel_id ?? record.channelId) as unknown;
    const rawChannelId = Array.isArray(candidate) ? candidate[0] : candidate;
    if (typeof rawChannelId !== "string" || rawChannelId.trim().length === 0) {
      throw new AppError("channel_id 必须是非空字符串", {
        statusCode: 400,
        code: "CHANNEL_ID_REQUIRED",
      });
    }

    const result = await youtubeSubscriptionService.unsubscribeChannel(
      rawChannelId.trim(),
      currentUser.id,
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/channels：获取全部已同步的频道列表
youtubeMetadataRouter.get("/channels", async (_req, res, next) => {
  try {
    const channels = await youtubeMetadataService.listChannels();
    res.json({ data: channels });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/channels/custom/:customUrl：通过自定义域名查询频道
youtubeMetadataRouter.get("/channels/custom/:customUrl", async (req, res, next) => {
  try {
    const customUrl = req.params.customUrl?.trim();
    if (!customUrl) {
      throw new AppError("需要提供 custom_url", {
        statusCode: 400,
        code: "CUSTOM_URL_REQUIRED",
      });
    }

    const channel = await youtubeMetadataService.getChannelByCustomUrl(customUrl);
    if (!channel) {
      throw new AppError("未找到频道", {
        statusCode: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    }

    res.json({ data: channel });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/channels/:channelId：根据频道 ID 查询频道信息
youtubeMetadataRouter.get("/channels/:channelId", async (req, res, next) => {
  try {
    const channelId = req.params.channelId?.trim();
    if (!channelId) {
      throw new AppError("频道 ID 必须提供", {
        statusCode: 400,
        code: "CHANNEL_ID_REQUIRED",
      });
    }

    const channel = await youtubeMetadataService.getChannelById(channelId);
    if (!channel) {
      throw new AppError("未找到频道", {
        statusCode: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    }

    res.json({ data: channel });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/channels/:channelId/playlists：列出频道下的播放列表
youtubeMetadataRouter.get(
  "/channels/:channelId/playlists",
  async (req, res, next) => {
    try {
      const channelId = req.params.channelId?.trim();
      if (!channelId) {
        throw new AppError("频道 ID 必须提供", {
          statusCode: 400,
          code: "CHANNEL_ID_REQUIRED",
        });
      }

      const playlists = await youtubeMetadataService.listPlaylistsByChannel(channelId);
      res.json({ data: playlists });
    } catch (error) {
      next(error);
    }
  },
);

youtubeMetadataRouter.get(
  "/channels/:channelId/videos",
  async (req, res, next) => {
    try {
      const channelId = req.params.channelId?.trim();
      if (!channelId) {
        throw new AppError("频道 ID 必须提供", {
          statusCode: 400,
          code: "CHANNEL_ID_REQUIRED",
        });
      }

      const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
      const includeTopComment = parseBooleanFlag(
        req.query.includeTopComment ?? req.query.include_top_comment,
      );
      const videos = await youtubeMetadataService.listVideosByChannel(channelId, {
        limit,
        offset,
        includeTopComment,
      });
      res.json({ data: videos, pagination: { limit, offset }, meta: { includeTopComment } });
    } catch (error) {
      next(error);
      }
    },
);

// GET /youtube/playlists/:playlistId：获取单个播放列表详情
youtubeMetadataRouter.get("/playlists/:playlistId", async (req, res, next) => {
  try {
    const playlistId = req.params.playlistId?.trim();
    if (!playlistId) {
      throw new AppError("播放列表 ID 必须提供", {
        statusCode: 400,
        code: "PLAYLIST_ID_REQUIRED",
      });
    }

    const playlist = await youtubeMetadataService.getPlaylistById(playlistId);
    if (!playlist) {
      throw new AppError("未找到播放列表", {
        statusCode: 404,
        code: "PLAYLIST_NOT_FOUND",
      });
    }

    res.json({ data: playlist });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/playlists/:playlistId/videos：列出播放列表内的视频，支持分页
youtubeMetadataRouter.get(
  "/playlists/:playlistId/videos",
  async (req, res, next) => {
    try {
      const playlistId = req.params.playlistId?.trim();
      if (!playlistId) {
        throw new AppError("播放列表 ID 必须提供", {
          statusCode: 400,
          code: "PLAYLIST_ID_REQUIRED",
        });
      }

      const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
      const videos = await youtubeMetadataService.listVideosByPlaylist(playlistId, {
        limit,
        offset,
      });
      res.json({ data: videos, pagination: { limit, offset } });
    } catch (error) {
      next(error);
    }
    },
);

// GET /youtube/videos/:videoId：查询单个视频详情
youtubeMetadataRouter.get("/videos/:videoId", async (req, res, next) => {
  try {
    const videoId = req.params.videoId?.trim();
    if (!videoId) {
      throw new AppError("视频 ID 必须提供", {
        statusCode: 400,
        code: "VIDEO_ID_REQUIRED",
      });
    }

    const video = await youtubeMetadataService.getVideoById(videoId);
    if (!video) {
      throw new AppError("未找到视频", {
        statusCode: 404,
        code: "VIDEO_NOT_FOUND",
      });
    }

    res.json({ data: video });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/subscriptions：分页获取当前用户订阅列表，可按频道信息筛选
youtubeMetadataRouter.get("/subscriptions", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const channelIdFilter = normalizeQueryValue(req.query.channel_id ?? req.query.channelId);
    const customUrlFilter = normalizeQueryValue(req.query.custom_url ?? req.query.customUrl);
    const channelNameFilter = normalizeQueryValue(req.query.channel_name ?? req.query.channelName);
    const countryFilter = normalizeQueryValue(req.query.country);

    const filters: SubscriptionFilterOptions = {};
    if (channelIdFilter) {
      filters.channelId = channelIdFilter;
    }
    if (customUrlFilter) {
      filters.customUrl = customUrlFilter;
    }
    if (channelNameFilter) {
      filters.channelName = channelNameFilter;
    }
    if (countryFilter) {
      filters.country = countryFilter;
    }

    const hasFilters = Object.keys(filters).length > 0;

    const subscriptions = await subscribedChannelService.listUserSubscriptions(
      currentUser.id,
      {
        limit,
        offset,
        ...(hasFilters ? { filters } : {}),
      },
    );

    res.json({ data: subscriptions, pagination: { limit, offset } });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/subscriptions/cards：返回订阅频道的卡片指标 Top1（涨粉/流量/勤奋）
youtubeMetadataRouter.get("/subscriptions/cards", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const days = parseWindowDays(req.query.days);
    const cards = await subscriptionCardService.getTop1Cards(currentUser.id, { days });
    res.json({ data: cards });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/subscriptions/title-keywords：订阅频道标题高频关键词（近 N 天发布 + 热度 Top 视频）
youtubeMetadataRouter.get("/subscriptions/title-keywords", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const days = parseWindowDays(req.query.days);
    const limit = parseKeywordLimit(req.query.limit);
    const candidateLimit = parseCandidateLimit(req.query.candidate_limit ?? req.query.candidateLimit);
    const likeWeight = parseLikeWeight(req.query.like_weight ?? req.query.likeWeight);

    const result = await subscriptionKeywordService.getTitleKeywords(currentUser.id, {
      days,
      limit,
      candidateLimit,
      likeWeight,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/subscription-status：查询当前用户是否已订阅指定频道
youtubeMetadataRouter.get("/subscription-status", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const channelId = normalizeQueryValue(req.query.channel_id ?? req.query.channelId);
    if (!channelId) {
      throw new AppError("channel_id 参数必填", {
        statusCode: 400,
        code: "CHANNEL_ID_REQUIRED",
      });
    }

    const subscribed = await subscribedChannelService.isUserSubscribedToChannel(
      currentUser.id,
      channelId,
    );

    res.json({ data: { subscribed } });
  } catch (error) {
    next(error);
  }
});

// GET /youtube/channels/:channelId/statistics/daily：按天返回订阅频道的趋势数据（用于折线图）
youtubeMetadataRouter.get("/channels/:channelId/statistics/daily", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const channelId = req.params.channelId?.trim();
    if (!channelId) {
      throw new AppError("频道 ID 必须提供", {
        statusCode: 400,
        code: "CHANNEL_ID_REQUIRED",
      });
    }

    const subscribed = await subscribedChannelService.isUserSubscribedToChannel(
      currentUser.id,
      channelId,
    );
    if (!subscribed) {
      throw new AppError("需要先订阅频道后再查看趋势数据", {
        statusCode: 403,
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    const metric = parseTrendMetric(req.query.metric ?? req.query.type);
    const days = parseWindowDays(req.query.days);

    const end = new Date();
    const endDate = end.toISOString().slice(0, 10);
    const startDate = toUtcDateString(shiftUtcDays(end, -(days - 1)));

    const daily = await youtubeMetadataService.listChannelStatisticsDaily(channelId, {
      startDate,
      endDate,
    });

    const valueByDate = new Map<string, string>();
    for (const point of daily) {
      if (metric === "viewCount") {
        valueByDate.set(point.snapshotDate, point.viewCount);
      } else if (metric === "subscriberCount") {
        valueByDate.set(point.snapshotDate, point.subscriberCount);
      } else {
        valueByDate.set(point.snapshotDate, String(point.videoCount));
      }
    }

    const dates: string[] = [];
    const points: Array<{ date: string; value: string | null }> = [];
    let cursor = new Date(`${startDate}T00:00:00.000Z`);
    const endCursor = new Date(`${endDate}T00:00:00.000Z`);
    let lastValue: string | null = null;

    while (cursor.getTime() <= endCursor.getTime()) {
      const date = toUtcDateString(cursor);
      dates.push(date);
      const raw = valueByDate.get(date);
      if (raw !== undefined) {
        lastValue = raw;
      }
      points.push({ date, value: lastValue });
      cursor = shiftUtcDays(cursor, 1);
    }

    res.json({
      data: {
        channelId,
        metric,
        windowDays: days,
        startDate,
        endDate,
        points,
      },
    });
  } catch (error) {
    next(error);
  }
});

function parsePagination(
  rawLimit: unknown,
  rawOffset: unknown,
): { limit: number; offset: number } {
  const limitValue = normalizeQueryValue(rawLimit);
  const offsetValue = normalizeQueryValue(rawOffset);

  // 统一分页参数并限制上限，避免单次查询过大
  let limit = DEFAULT_LIMIT;
  if (limitValue !== undefined) {
    const parsed = Number.parseInt(limitValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError("limit 必须是正整数", {
        statusCode: 400,
        code: "INVALID_LIMIT",
      });
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  let offset = 0;
  if (offsetValue !== undefined) {
    const parsed = Number.parseInt(offsetValue, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError("offset 必须是 >= 0 的整数", {
        statusCode: 400,
        code: "INVALID_OFFSET",
      });
    }
    offset = parsed;
  }

  return { limit, offset };
}

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }

  return false;
}

function normalizeQueryValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return String(value);
}

function parseWindowDays(rawDays: unknown): number {
  const value = normalizeQueryValue(rawDays);
  if (value === undefined) {
    return 30;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("days 必须是正整数", {
      statusCode: 400,
      code: "INVALID_DAYS",
    });
  }

  return Math.min(parsed, 3650);
}

type TrendMetric = "viewCount" | "subscriberCount" | "videoCount";

function parseTrendMetric(rawMetric: unknown): TrendMetric {
  const value = normalizeQueryValue(rawMetric);
  const normalized = value?.trim();
  if (!normalized) {
    return "viewCount";
  }

  switch (normalized) {
    case "viewCount":
    case "view_count":
    case "views":
      return "viewCount";
    case "subscriberCount":
    case "subscriber_count":
    case "subscribers":
      return "subscriberCount";
    case "videoCount":
    case "video_count":
    case "videos":
      return "videoCount";
    default:
      throw new AppError("metric 参数不合法", {
        statusCode: 400,
        code: "INVALID_METRIC",
        details: { allowed: ["viewCount", "subscriberCount", "videoCount"] },
      });
  }
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(date: Date, deltaDays: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + deltaDays);
  return copy;
}

function parseKeywordLimit(rawLimit: unknown): number {
  const value = normalizeQueryValue(rawLimit);
  if (value === undefined) {
    return 10;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("limit 必须是正整数", {
      statusCode: 400,
      code: "INVALID_LIMIT",
    });
  }

  return Math.min(parsed, 50);
}

function parseCandidateLimit(rawLimit: unknown): number {
  const value = normalizeQueryValue(rawLimit);
  if (value === undefined) {
    return 500;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("candidate_limit 必须是正整数", {
      statusCode: 400,
      code: "INVALID_CANDIDATE_LIMIT",
    });
  }

  return Math.min(Math.max(parsed, 50), 5000);
}

function parseLikeWeight(rawWeight: unknown): number {
  const value = normalizeQueryValue(rawWeight);
  if (value === undefined) {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError("like_weight 必须是 >= 0 的整数", {
      statusCode: 400,
      code: "INVALID_LIKE_WEIGHT",
    });
  }

  return Math.min(parsed, 1000);
}
