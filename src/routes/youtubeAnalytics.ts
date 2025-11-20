import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import { userChannelService, youtubeAnalyticsApi } from "../services";
import { AppError } from "../utils/appError";

export const youtubeAnalyticsRouter = Router();

youtubeAnalyticsRouter.use(requireAuth);

youtubeAnalyticsRouter.get("/reports", async (req, res, next) => {
  try {
    const session = req.authSession;
    if (!session?.tokens.accessToken) {
      throw new AppError("当前会话缺少 Google access_token", {
        statusCode: 401,
        code: "ACCESS_TOKEN_REQUIRED",
      });
    }

    const data = await youtubeAnalyticsApi.queryReports(
      req.query,
      session.tokens.accessToken,
    );

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

youtubeAnalyticsRouter.get("/channels/mine", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("需要先登录后再查看频道列表", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const channels = await userChannelService.listChannels(currentUser.id);
    res.json({ data: channels });
  } catch (error) {
    next(error);
  }
});
