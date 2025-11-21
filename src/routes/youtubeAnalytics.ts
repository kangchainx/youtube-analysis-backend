import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import {
  googleOAuthService,
  sessionService,
  userChannelService,
  youtubeAnalyticsApi,
} from "../services";
import type { SessionRecord } from "../services/sessionService";
import type { GoogleTokens } from "../services/googleOAuth";
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

    const accessToken = await ensureFreshAccessToken(session);

    const data = await youtubeAnalyticsApi.queryReports(
      req.query,
      accessToken,
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

const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

function isAccessTokenExpired(tokens: GoogleTokens): boolean {
  if (!tokens.expiryDate) {
    return false;
  }

  return tokens.expiryDate - TOKEN_REFRESH_SKEW_MS <= Date.now();
}

async function ensureFreshAccessToken(session: SessionRecord): Promise<string> {
  const tokens = session.tokens;

  if (!isAccessTokenExpired(tokens)) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    throw new AppError("Google access_token 已过期，请重新登录", {
      statusCode: 401,
      code: "GOOGLE_TOKEN_EXPIRED",
    });
  }

  try {
    const refreshed = await googleOAuthService.refreshAccessToken(
      tokens.refreshToken,
      tokens.idToken,
    );

    const mergedTokens: GoogleTokens = {
      accessToken: refreshed.accessToken,
      idToken: refreshed.idToken ?? tokens.idToken,
      ...(refreshed.refreshToken
        ? { refreshToken: refreshed.refreshToken }
        : tokens.refreshToken
          ? { refreshToken: tokens.refreshToken }
          : {}),
      ...(refreshed.scope ? { scope: refreshed.scope } : tokens.scope ? { scope: tokens.scope } : {}),
      ...(refreshed.tokenType
        ? { tokenType: refreshed.tokenType }
        : tokens.tokenType
          ? { tokenType: tokens.tokenType }
          : {}),
      ...(typeof refreshed.expiryDate === "number"
        ? { expiryDate: refreshed.expiryDate }
        : typeof tokens.expiryDate === "number"
          ? { expiryDate: tokens.expiryDate }
          : {}),
    };

    await sessionService.updateSessionTokens(session.id, mergedTokens);
    return mergedTokens.accessToken;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AppError("无法刷新 Google 访问令牌，请重新登录", {
      statusCode: 401,
      code: "GOOGLE_TOKEN_REFRESH_FAILED",
      details: reason,
    });
  }
}
