import type { RequestHandler } from "express";
import { sessionService } from "../services";
import { AppError } from "../utils/appError";
import { extractSessionToken } from "../utils/sessionToken";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    // 统一从 cookie/Authorization 读取 session token，缺失直接拦截
    const token = extractSessionToken(req);
    if (!token) {
      throw new AppError("Authentication required", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    // 解析并验证会话，写入请求上下文供后续路由使用
    const session = await sessionService.verifyToken(token);
    req.authSession = session;
    req.currentUser = session.user;

    next();
  } catch (error) {
    next(error);
  }
};
