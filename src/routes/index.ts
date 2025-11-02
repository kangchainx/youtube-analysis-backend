import { Router } from "express";
import { authRouter } from "./auth";
import { exportRouter } from "./export";
import { healthRouter } from "./health";
import { videosRouter } from "./videos";

const router = Router();

router.use("/auth", authRouter);
router.use("/export", exportRouter);
router.use("/health", healthRouter);
router.use("/videos", videosRouter);

export default router;
