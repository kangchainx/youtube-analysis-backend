import { Router } from "express";
import { config } from "../config/env";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    api: "youtube-analysis-backend",
    status: "healthy",
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});