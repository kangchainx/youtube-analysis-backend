import { Router } from "express";
import { config } from "../config/env";
import { requireAuth } from "../middleware/authentication";

export const configRouter = Router();

configRouter.use(requireAuth);

// GET /config/youtube-api-key：返回前端使用的 YouTube API Key
configRouter.get("/youtube-api-key", (_req, res) => {
  res.json({
    youtubeApiKey: config.youtube.apiKey,
  });
});
