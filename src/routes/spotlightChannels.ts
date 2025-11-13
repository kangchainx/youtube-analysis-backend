import { createHash } from "crypto";
import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import { spotlightChannelService } from "../services";

export const spotlightChannelsRouter = Router();

spotlightChannelsRouter.use(requireAuth);

const CACHE_TTL_SECONDS = 300;

spotlightChannelsRouter.get("/", async (req, res, next) => {
  try {
    const channels = await spotlightChannelService.listActiveChannels();

    const payload = channels.map((channel) => ({
      handle: channel.handle,
      channelId: channel.channelId,
      title: channel.title,
      description: channel.description,
      avatarUrl: channel.avatarUrl,
      totalViews: channel.totalViews,
      totalSubscribers: channel.totalSubscribers,
      order: channel.order,
      updatedAt: channel.updatedAt,
    }));

    const serialized = JSON.stringify(payload);
    const etag = createHash("sha256").update(serialized).digest("base64url");
    const etagHeaderValue = `"${etag}"`;

    if (req.headers["if-none-match"] === etagHeaderValue) {
      res.status(304).end();
      return;
    }

    res.setHeader("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
    res.setHeader("ETag", etagHeaderValue);

    res.json(payload);
  } catch (error) {
    next(error);
  }
});
