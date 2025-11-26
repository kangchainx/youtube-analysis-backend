import { Router } from "express";
import { requireAuth } from "../middleware/authentication";

export const videosRouter = Router();

videosRouter.use(requireAuth);

const SAMPLE_VIDEOS = [
  {
    id: "demo-video-1",
    title: "Sample video",
    description: "Replace this with real YouTube analysis results.",
  },
];

// GET /videos：示例接口，返回静态样例视频列表
videosRouter.get("/", (_req, res) => {
  res.json({ data: SAMPLE_VIDEOS });
});

// POST /videos：示例接口，创建一条临时视频记录
videosRouter.post("/", (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Missing required field: title" });
  }

  const payload = {
    id: `video-${Date.now()}`,
    title,
    description: description ?? "",
  };

  return res.status(201).json({ data: payload });
});

// GET /videos/:id：示例接口，根据 ID 查询样例视频
videosRouter.get("/:id", (req, res) => {
  const video = SAMPLE_VIDEOS.find((item) => item.id === req.params.id);

  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }

  return res.json({ data: video });
});
