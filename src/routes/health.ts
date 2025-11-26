import { Router } from "express";
import { config } from "../config/env";

export const healthRouter = Router();

// GET /health：健康检查接口，返回基础环境信息
healthRouter.get("/", (_req, res) => {
  res.json({
    api: "youtube-analysis-backend",
    status: "healthy",
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});
