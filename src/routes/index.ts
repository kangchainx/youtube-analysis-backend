import { Router } from "express";
import { authRouter } from "./auth";
import { exportRouter } from "./export";
import { healthRouter } from "./health";
import { videosRouter } from "./videos";
import { usersRouter } from "./users";

const router = Router();

router.use("/auth", authRouter);
router.use("/export", exportRouter);
router.use("/health", healthRouter);
router.use("/videos", videosRouter);
router.use("/users", usersRouter);

export default router;
