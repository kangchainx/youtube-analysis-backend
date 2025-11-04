import type { RequestHandler } from "express";
import { sessionService } from "../services";
import { AppError } from "../utils/appError";
import { extractSessionToken } from "../utils/sessionToken";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      throw new AppError("Authentication required", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const session = await sessionService.verifyToken(token);
    req.authSession = session;
    req.currentUser = session.user;

    next();
  } catch (error) {
    next(error);
  }
};
