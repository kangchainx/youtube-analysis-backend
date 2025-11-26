import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import { videoTranslateService } from "../services";
import { AppError } from "../utils/appError";

export const videoTranslateRouter = Router();
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

videoTranslateRouter.use(requireAuth);

// POST /video-translate/tasks：创建新的转写任务
videoTranslateRouter.post("/tasks", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const payload = parseCreateTaskPayload(req.body);
    const task = await videoTranslateService.createTask({
      ...payload,
      userId: currentUser.id,
    });

    res.status(202).json({ data: task });
  } catch (error) {
    next(error);
  }
});

// GET /video-translate/status：查看转写服务健康状态
videoTranslateRouter.get("/status", async (_req, res, next) => {
  try {
    const currentUser = _req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const health = await videoTranslateService.getServiceHealth();
    res.json({ data: health });
  } catch (error) {
    next(error);
  }
});

// GET /video-translate/tasks：分页查询当前用户的任务列表，可按状态过滤
videoTranslateRouter.get("/tasks", async (req, res, next) => {
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

    const rawStatus =
      req.query.status ?? req.query.task_status ?? req.query.taskStatus;
    const status = parseOptionalString(rawStatus);

    const listOptions = status
      ? { page, pageSize, status }
      : { page, pageSize };

    const result = await videoTranslateService.listTaskRecords(
      currentUser.id,
      listOptions,
    );

    res.json({
      data: result.tasks,
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

// GET /video-translate/tasks/details：分页返回任务列表并附带文件详情
videoTranslateRouter.get("/tasks/details", async (req, res, next) => {
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

    const rawStatus =
      req.query.status ?? req.query.task_status ?? req.query.taskStatus;
    const status = parseOptionalString(rawStatus);

    const listOptions = status
      ? { page, pageSize, status }
      : { page, pageSize };

    const result = await videoTranslateService.listTaskRecordsWithDetails(
      currentUser.id,
      listOptions,
    );

    res.json({
      data: result.tasks,
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

// GET /video-translate/tasks/:taskId：查询指定任务状态与结果
videoTranslateRouter.get("/tasks/:taskId", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const taskId = extractTaskId(req.params.taskId);
    const task = await videoTranslateService.getTask(taskId, currentUser.id);

    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

// GET /video-translate/tasks/:taskId/download-url：返回任务生成文件的下载地址
videoTranslateRouter.get("/tasks/:taskId/download-url", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const taskId = extractTaskId(req.params.taskId);
    const signedUrl = await videoTranslateService.getSignedDownloadUrl(
      taskId,
      currentUser.id,
    );

    res.json({
      data: {
        taskId,
        url: signedUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /video-translate/tasks/:taskId/stream：SSE 推送任务进度及最终结果
videoTranslateRouter.get("/tasks/:taskId/stream", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const taskId = extractTaskId(req.params.taskId);
    const snapshot = await videoTranslateService.getTask(taskId, currentUser.id);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write("retry: 5000\n\n");

    const writeEvent = (eventName: string, payload: unknown) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent("snapshot", snapshot);

    let closed = false;
    const abortController = new AbortController();
    const heartbeat = setInterval(() => {
      if (!closed) {
        res.write(`event: ping\ndata: "${new Date().toISOString()}"\n\n`);
      }
    }, 25000);

    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      abortController.abort();
      res.end();
    };

    req.on("close", cleanup);

    try {
      await videoTranslateService.streamTask(
        taskId,
        async (event) => {
          if (closed) {
            return;
          }
          writeEvent("update", event);

          if (event.status === "completed" || event.status === "failed") {
            cleanup();
          }
        },
        { signal: abortController.signal, userId: currentUser.id },
      );
    } catch (error) {
      if (!closed) {
        writeEvent("error", {
          message:
            error instanceof Error
              ? error.message
              : "任务进度流异常",
        });
        cleanup();
      }
    }

    if (!closed) {
      cleanup();
    }
  } catch (error) {
    next(error);
  }
});

interface CreateTaskPayload {
  videoUrl: string;
  videoSource?: string;
  language?: string;
  outputFormat?: "txt" | "markdown";
}

function parseCreateTaskPayload(body: unknown): CreateTaskPayload {
  if (!body || typeof body !== "object") {
    throw new AppError("请求体格式错误", {
      statusCode: 400,
      code: "INVALID_PAYLOAD",
    });
  }

  const source = body as Record<string, unknown>;
  const rawUrl =
    typeof source.videoUrl === "string"
      ? source.videoUrl
      : typeof source.video_url === "string"
        ? source.video_url
        : undefined;

  if (!rawUrl || rawUrl.trim().length === 0) {
    throw new AppError("videoUrl 不能为空", {
      statusCode: 400,
      code: "INVALID_VIDEO_URL",
    });
  }

  try {
    new URL(rawUrl);
  } catch {
    throw new AppError("提供的 videoUrl 非法", {
      statusCode: 400,
      code: "INVALID_VIDEO_URL",
    });
  }

  const videoSource = parseOptionalString(
    source.videoSource ?? source.video_source,
  );
  const language = parseOptionalString(source.language);

  const rawOutputFormat = parseOptionalString(
    source.output_format ?? source.outputFormat,
  );
  let outputFormat: "txt" | "markdown" | undefined;
  if (rawOutputFormat) {
    const normalized = rawOutputFormat.toLowerCase();
    if (normalized !== "txt" && normalized !== "markdown") {
      throw new AppError("output_format 仅支持 txt 或 markdown", {
        statusCode: 400,
        code: "INVALID_OUTPUT_FORMAT",
      });
    }
    outputFormat = normalized as "txt" | "markdown";
  }

  const payload: CreateTaskPayload = {
    videoUrl: rawUrl.trim(),
  };

  if (videoSource) {
    payload.videoSource = videoSource;
  }
  if (language) {
    payload.language = language;
  }
  if (outputFormat) {
    payload.outputFormat = outputFormat;
  }

  return payload;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  field: string,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  const source = Array.isArray(value) ? value[0] : value;
  if (typeof source === "number" && Number.isInteger(source) && source > 0) {
    return source;
  }

  if (typeof source === "string") {
    const parsed = Number.parseInt(source, 10);
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

function parseOptionalString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return parseOptionalString(value[0]);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function extractTaskId(value: string | undefined): string {
  if (!value) {
    throw new AppError("taskId 不能为空", {
      statusCode: 400,
      code: "INVALID_TASK_ID",
    });
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError("taskId 不能为空", {
      statusCode: 400,
      code: "INVALID_TASK_ID",
    });
  }

  return trimmed;
}
