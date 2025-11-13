import { Router } from "express";
import { configRouter } from "./config";
import { authRouter } from "./auth";
import { exportRouter } from "./export";
import { healthRouter } from "./health";
import { videosRouter } from "./videos";
import { usersRouter } from "./users";
import { spotlightChannelsRouter } from "./spotlightChannels";
import { videoTranscriptionRouter } from "./videoTranscription";
import { notificationsRouter } from "./notifications";
import { youtubeMetadataRouter } from "./youtubeMetadata";

const router = Router();

router.use("/auth", authRouter);
router.use("/config", configRouter);
router.use("/export", exportRouter);
router.use("/health", healthRouter);
router.use("/videos", videosRouter);
router.use("/users", usersRouter);
router.use("/spotlight-channels", spotlightChannelsRouter);
router.use("/video-transcription", videoTranscriptionRouter);
router.use("/notifications", notificationsRouter);
router.use("/youtube", youtubeMetadataRouter);

export default router;
