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
