import { Router } from "express";
import { config } from "../config/env";
import { requireAuth } from "../middleware/authentication";

export const configRouter = Router();

configRouter.use(requireAuth);

configRouter.get("/youtube-api-key", (_req, res) => {
  res.json({
    youtubeApiKey: config.youtube.apiKey,
  });
});
