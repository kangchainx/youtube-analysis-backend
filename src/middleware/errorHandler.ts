import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, isAppError } from "../utils/appError";
import { logger } from "../utils/logger";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Resource not found",
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (!isAppError(err)) {
    logger.error("Unexpected error", { err });
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
    return;
  }

  const level = err.statusCode >= 500 ? "error" : "warn";
  logger.log(level, err.message, {
    code: err.code,
    statusCode: err.statusCode,
    details: err.details,
  });

  res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
};
