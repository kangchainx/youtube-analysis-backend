import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import { videoTranscriptionService } from "../services";
import { AppError } from "../utils/appError";

export const videoTranscriptionRouter = Router();

videoTranscriptionRouter.use(requireAuth);

videoTranscriptionRouter.post("/", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const payload = parseRequestPayload(req.body);

    const result = await videoTranscriptionService.startTranscriptionTask({
      userId: currentUser.id,
      url: payload.url,
      summaryLanguage: payload.summaryLanguage,
      exportFormat: payload.exportFormat,
      includeTimestamps: payload.exportIncludeTimestamps,
      includeHeader: payload.exportIncludeHeader,
    });

    res.status(202).json({
      data: {
        id: result.taskRecordId,
        taskId: result.taskId,
        status: result.status,
        message: result.message ?? "任务已创建",
      },
    });
  } catch (error) {
    next(error);
  }
});

videoTranscriptionRouter.get("/tasks", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const page = extractPositiveInteger(req.query.page, 1, "page");
    const pageSizeInput =
      req.query.page_size ?? req.query.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(
      extractPositiveInteger(pageSizeInput, DEFAULT_PAGE_SIZE, "page_size"),
      MAX_PAGE_SIZE,
    );

    const result = await videoTranscriptionService.listTasks(currentUser.id, {
      page,
      pageSize,
    });

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

videoTranscriptionRouter.get("/tasks/details", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const page = extractPositiveInteger(req.query.page, 1, "page");
    const pageSizeInput =
      req.query.page_size ?? req.query.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(
      extractPositiveInteger(pageSizeInput, DEFAULT_PAGE_SIZE, "page_size"),
      MAX_PAGE_SIZE,
    );

    const result =
      await videoTranscriptionService.listTasksWithDetails(currentUser.id, {
        page,
        pageSize,
      });

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

videoTranscriptionRouter.get("/task", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const taskId = extractQueryString(
      req.query.task_id ?? req.query.taskId,
      "task_id",
    );

    const task = await videoTranscriptionService.getTaskByTaskId(
      taskId,
      currentUser.id,
    );

    if (!task) {
      throw new AppError("未找到对应任务", {
        statusCode: 404,
        code: "TASK_NOT_FOUND",
      });
    }

    res.json({ data: task });
  } catch (error) {
    next(error);
  }
});

videoTranscriptionRouter.get("/task/stream", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const taskId = extractQueryString(
      req.query.task_id ?? req.query.taskId,
      "task_id",
    );

    const task = await videoTranscriptionService.getTaskByTaskId(
      taskId,
      currentUser.id,
    );

    if (!task) {
      throw new AppError("未找到对应任务", {
        statusCode: 404,
        code: "TASK_NOT_FOUND",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const writeEvent = (eventName: string, payload: unknown) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    res.write("retry: 5000\n\n");
    writeEvent("snapshot", task);

    let closed = false;
    let unsubscribe: (() => void) | undefined;
    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: "${new Date().toISOString()}"\n\n`);
    }, 25000);

    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      if (unsubscribe) {
        unsubscribe();
      }
      res.end();
    };

    unsubscribe = videoTranscriptionService.onTaskUpdate((update) => {
      if (
        update.userId !== currentUser.id ||
        update.taskId !== taskId
      ) {
        return;
      }

      writeEvent("update", update);
      if (update.status !== "processing") {
        cleanup();
      }
    });

    req.on("close", cleanup);
  } catch (error) {
    next(error);
  }
});

videoTranscriptionRouter.get("/details", async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      throw new AppError("用户未登录", {
        statusCode: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const vttId = extractQueryString(
      req.query.vtt_id ?? req.query.vttId,
      "vtt_id",
    );

    const details = await videoTranscriptionService.listDetailsByTaskId(
      vttId,
      currentUser.id,
    );

    res.json({ data: details });
  } catch (error) {
    next(error);
  }
});

type SupportedFormat = "markdown" | "txt" | "docx" | "pdf";

interface RequestPayload {
  url: string;
  summaryLanguage: string;
  exportFormat: SupportedFormat;
  exportIncludeTimestamps: boolean;
  exportIncludeHeader: boolean;
}

function parseRequestPayload(body: unknown): RequestPayload {
  if (body === null || typeof body !== "object") {
    throw new AppError("请求体格式错误", {
      statusCode: 400,
      code: "INVALID_PAYLOAD",
    });
  }

  const source = body as Record<string, unknown>;
  const url = source.url;
  if (typeof url !== "string" || url.trim().length === 0) {
    throw new AppError("url 不能为空", {
      statusCode: 400,
      code: "INVALID_URL",
    });
  }

  try {
    // 验证 URL 格式
    new URL(url);
  } catch {
    throw new AppError("提供的 url 非法", {
      statusCode: 400,
      code: "INVALID_URL",
    });
  }

  const summaryLanguage =
    typeof source.summary_language === "string"
      ? source.summary_language.trim()
      : typeof source.summaryLanguage === "string"
      ? source.summaryLanguage.trim()
      : "zh";

  const allowedFormats: SupportedFormat[] = ["markdown", "txt", "docx", "pdf"];
  const rawFormat =
    typeof source.export_format === "string"
      ? source.export_format.toLowerCase()
      : typeof source.exportFormat === "string"
      ? source.exportFormat.toLowerCase()
      : "markdown";

  if (!allowedFormats.includes(rawFormat as SupportedFormat)) {
    throw new AppError("export_format 不受支持", {
      statusCode: 400,
      code: "INVALID_EXPORT_FORMAT",
      details: { allowedFormats },
    });
  }

  const exportIncludeTimestamps = parseBoolean(
    source.export_include_timestamps ?? source.exportIncludeTimestamps,
    true,
  );
  const exportIncludeHeader = parseBoolean(
    source.export_include_header ?? source.exportIncludeHeader,
    true,
  );

  return {
    url,
    summaryLanguage: summaryLanguage || "zh",
    exportFormat: rawFormat as SupportedFormat,
    exportIncludeTimestamps,
    exportIncludeHeader,
  };
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function extractQueryString(value: unknown, field: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (Array.isArray(value)) {
    return extractQueryString(value[0], field);
  }

  throw new AppError(`${field} 不能为空`, {
    statusCode: 400,
    code: "INVALID_QUERY_PARAM",
    details: { field },
  });
}

function extractPositiveInteger(
  value: unknown,
  fallback: number,
  field: string,
): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  const source = Array.isArray(value) ? value[0] : value;
  const numeric =
    typeof source === "number"
      ? source
      : typeof source === "string"
      ? Number.parseInt(source, 10)
      : NaN;

  if (!Number.isFinite(numeric) || numeric < 1) {
    throw new AppError(`${field} 必须是正整数`, {
      statusCode: 400,
      code: "INVALID_QUERY_PARAM",
      details: { field },
    });
  }

  return Math.floor(numeric);
}
