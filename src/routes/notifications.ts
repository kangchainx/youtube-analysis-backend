import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import { notificationService } from "../services";
import type { NotificationRecord } from "../services/notificationService";
import { AppError } from "../utils/appError";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const page = parsePositiveInteger(req.query.page, 1, "page");
    const rawPageSize =
      req.query.page_size ?? req.query.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(
      parsePositiveInteger(rawPageSize, DEFAULT_PAGE_SIZE, "page_size"),
      MAX_PAGE_SIZE,
    );

    const rawMsgStatus =
      typeof req.query.msgStatus === "string"
        ? req.query.msgStatus
        : typeof req.query["msg_status"] === "string"
          ? req.query["msg_status"]
          : undefined;
    const msgStatus =
      rawMsgStatus && rawMsgStatus.length > 0 ? rawMsgStatus : undefined;

    const listOptions = msgStatus
      ? { page, pageSize, msgStatus }
      : { page, pageSize };

    const result = await notificationService.listNotifications(
      currentUser.id,
      listOptions,
    );

    res.json({
      data: result.notifications,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/:id/mark-read", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const notificationId = req.params.id;
    if (!notificationId) {
      throw new AppError("缺少消息ID", {
        statusCode: 400,
        code: "INVALID_NOTIFICATION_ID",
      });
    }

    const notification = await notificationService.markNotificationRead(
      currentUser.id,
      notificationId,
    );

    if (!notification) {
      throw new AppError("消息不存在", {
        statusCode: 404,
        code: "NOTIFICATION_NOT_FOUND",
      });
    }

    res.json({ data: notification });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/mark-all-read", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const updatedCount =
      await notificationService.markAllNotificationsRead(currentUser.id);

    res.json({ data: { updatedCount } });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/stream", (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write("event: connected\ndata: {}\n\n");

    const sendNotification = (notification: NotificationRecord) => {
      if (res.writableEnded) {
        return;
      }
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    };

    const unsubscribe = notificationService.onNotification(
      currentUser.id,
      sendNotification,
    );

    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        return;
      }
      res.write(":heartbeat\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (error) {
    next(error);
  }
});

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  field: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw new AppError(`${field} 必须为正整数`, {
    statusCode: 400,
    code: "INVALID_QUERY_PARAM",
    details: { field },
  });
}
