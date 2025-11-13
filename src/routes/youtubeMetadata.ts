import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import {
  subscribedChannelService,
  youtubeMetadataService,
  youtubeSubscriptionService,
} from "../services";
import { AppError } from "../utils/appError";

export const youtubeMetadataRouter = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

youtubeMetadataRouter.use(requireAuth);

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

youtubeMetadataRouter.get("/channels", async (_req, res, next) => {
  try {
    const channels = await youtubeMetadataService.listChannels();
    res.json({ data: channels });
  } catch (error) {
    next(error);
  }
});

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
      const videos = await youtubeMetadataService.listVideosByChannel(channelId, {
        limit,
        offset,
      });
      res.json({ data: videos, pagination: { limit, offset } });
    } catch (error) {
      next(error);
    }
  },
);

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

    const subscriptions = await subscribedChannelService.listUserSubscriptions(
      currentUser.id,
      {
        limit,
        offset,
        filters: {
          channelId: channelIdFilter,
          customUrl: customUrlFilter,
          channelName: channelNameFilter,
          country: countryFilter,
        },
      },
    );

    res.json({ data: subscriptions, pagination: { limit, offset } });
  } catch (error) {
    next(error);
  }
});

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

function parsePagination(
  rawLimit: unknown,
  rawOffset: unknown,
): { limit: number; offset: number } {
  const limitValue = normalizeQueryValue(rawLimit);
  const offsetValue = normalizeQueryValue(rawOffset);

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

function normalizeQueryValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return String(value);
}
