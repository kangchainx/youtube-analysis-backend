import { Router } from "express";

export const videosRouter = Router();

const SAMPLE_VIDEOS = [
  {
    id: "demo-video-1",
    title: "Sample video",
    description: "Replace this with real YouTube analysis results.",
  },
];

videosRouter.get("/", (_req, res) => {
  res.json({ data: SAMPLE_VIDEOS });
});

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

videosRouter.get("/:id", (req, res) => {
  const video = SAMPLE_VIDEOS.find((item) => item.id === req.params.id);

  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }

  return res.json({ data: video });
});
