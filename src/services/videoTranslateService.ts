import { createHmac, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { fetch as undiciFetch } from "undici";
import type { VideoTranslateConfig } from "../config/env";
import { AppError } from "../utils/appError";
import type { NotificationService } from "./notificationService";

const httpFetch = undiciFetch as typeof globalThis.fetch;

type RemoteStatus = "pending" | "processing" | "completed" | "error" | "failed" | string;

interface RemoteTaskFile {
  filename?: string;
  download_url?: string;
  file_path?: string;
  size?: number | string | null;
  format?: string | null;
  language?: string | null;
}

interface RemoteTaskPayload {
  task_id?: string;
  taskId?: string;
  status?: RemoteStatus;
  progress?: number | string | null;
  message?: string;
  error?: string;
  details?: RemoteTaskFile[];
}

export type VideoTranslateStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface VideoTranslateFile {
  fileName: string;
  downloadUrl: string;
  fileSize: number | null;
  format?: string | null;
  language?: string | null;
}

export interface VideoTranslateTask {
  taskId: string;
  status: VideoTranslateStatus;
  progress: number | null;
  message?: string | null;
  files?: VideoTranslateFile[];
  rawStatus?: string;
}

export interface VideoTranslateHealth {
  status: string;
  api?: string;
  environment?: string;
  timestamp?: string;
  details?: unknown;
  [key: string]: unknown;
}

export interface VideoTranslateTaskRecord {
  id: string;
  taskId: string;
  userId: string;
  videoSource: string | null;
  videoSourceUrl: string | null;
  status: string;
  progress: number | null;
  progressMessage: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoTranslateFileRecord {
  id: string;
  taskId: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  fileFormat: string | null;
  detectedLanguage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoTranslateTaskWithDetails extends VideoTranslateTaskRecord {
  details: VideoTranslateFileRecord[];
}

export interface PaginatedVideoTranslateTasks {
  tasks: VideoTranslateTaskRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedVideoTranslateTasksWithDetails {
  tasks: VideoTranslateTaskWithDetails[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreateVideoTranslateTaskParams {
  videoUrl: string;
  videoSource?: string;
  language?: string;
  outputFormat?: "txt" | "markdown";
  userId: string;
}

interface StreamOptions {
  signal?: AbortSignal;
  userId?: string;
}

export class VideoTranslateService {
  constructor(
    private readonly config: VideoTranslateConfig,
    private readonly pool?: Pool,
    private readonly notificationService?: NotificationService,
  ) {}

  async createTask(
    params: CreateVideoTranslateTaskParams,
  ): Promise<VideoTranslateTask> {
    const endpoint = this.buildUrl("/api/tasks");
    const payload = {
      videoUrl: params.videoUrl,
      videoSource: params.videoSource,
      model: this.config.defaultModel,
      language: params.language,
      output_format: params.outputFormat ?? "txt",
      device: this.config.defaultDevice,
      compute_type: this.config.defaultComputeType,
      userId: params.userId,
    };

    let response: Response;
    try {
      response = await httpFetch(endpoint, {
        method: "POST",
        headers: this.buildHeaders(true, params.userId),
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new AppError("无法连接转写服务", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_SERVICE_UNAVAILABLE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw new AppError("创建转写任务失败", {
        statusCode:
          response.status >= 400 && response.status < 500
            ? response.status
            : 502,
        code: "VIDEO_TRANSLATE_TASK_CREATE_FAILED",
        details: bodyText,
      });
    }

    const parsed = this.parseJson(bodyText);
    const taskId = parsed.task_id ?? parsed.taskId;
    if (!taskId) {
      throw new AppError("转写服务未返回任务 ID", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_INVALID_RESPONSE",
      });
    }

    return this.normalizeTask(parsed, taskId);
  }

  async getTask(taskId: string, userId?: string): Promise<VideoTranslateTask> {
    const endpoint = this.buildUrl(`/api/tasks/${encodeURIComponent(taskId)}`);
    let response: Response;
    try {
      response = await httpFetch(endpoint, {
        headers: {
          Accept: "application/json",
          ...this.buildHeaders(false, userId),
        },
      });
    } catch (error) {
      throw new AppError("无法连接转写服务", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_SERVICE_UNAVAILABLE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const bodyText = await response.text();
    if (response.status === 404) {
      throw new AppError("未找到对应任务", {
        statusCode: 404,
        code: "VIDEO_TRANSLATE_TASK_NOT_FOUND",
      });
    }

    if (!response.ok) {
      throw new AppError("查询任务失败", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_TASK_FETCH_FAILED",
        details: bodyText,
      });
    }

    const parsed = this.parseJson(bodyText);
    return this.normalizeTask(parsed, taskId);
  }

  async getSignedDownloadUrl(taskId: string, userId?: string): Promise<string> {
    const endpoint = this.buildUrl(
      `/api/tasks/${encodeURIComponent(taskId)}/download`,
    );

    let response: Response;
    try {
      response = await httpFetch(endpoint, {
        headers: {
          Accept: "application/json",
          ...this.buildHeaders(false, userId),
        },
      });
    } catch (error) {
      throw new AppError("无法连接转写服务", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_SERVICE_UNAVAILABLE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw new AppError("获取下载地址失败", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_DOWNLOAD_FAILED",
        details: bodyText,
      });
    }

    // 响应可能是纯 URL 文本或 JSON
    const trimmed = bodyText.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch (error) {
      throw new AppError("下载地址响应格式错误", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_INVALID_RESPONSE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const url = this.extractDownloadUrl(parsed);
    if (!url) {
      throw new AppError("转写服务未返回下载地址", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_INVALID_RESPONSE",
        details: parsed,
      });
    }

    return url;
  }

  async getServiceHealth(): Promise<VideoTranslateHealth> {
    const endpoint = this.buildUrl("/health");
    let response: Response;

    try {
      response = await httpFetch(endpoint, {
        headers: { Accept: "application/json", ...this.buildHeaders(false, undefined) },
      });
    } catch (error) {
      throw new AppError("无法连接转写服务", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_SERVICE_UNAVAILABLE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw new AppError("转写服务健康检查失败", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_HEALTH_FAILED",
        details: bodyText,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText) as VideoTranslateHealth;
    } catch (error) {
      throw new AppError("转写服务健康检查返回无效 JSON", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_INVALID_RESPONSE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    return parsed as VideoTranslateHealth;
  }

  async listTaskRecords(
    userId: string,
    options: { page: number; pageSize: number; status?: string },
  ): Promise<PaginatedVideoTranslateTasks> {
    const pool = this.requirePool();
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const offset = (page - 1) * pageSize;
    const whereClauses = ["user_id = $1"];
    const params: Array<string | number> = [userId];

    if (options.status) {
      params.push(options.status);
      whereClauses.push(`status = $${params.length}`);
    }

    const listParams = [...params, pageSize, offset];

    const [listResult, countResult] = await Promise.all([
      pool.query<VideoTranslateTaskRow>(
        `
        SELECT id,
               video_source,
               video_source_url,
               user_id,
               status,
               progress,
               progress_message,
               error_message,
               created_at,
               updated_at
          FROM video_ts_task
         WHERE ${whereClauses.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}
        `,
        listParams,
      ),
      pool.query<{ count: string }>(
        `
        SELECT COUNT(*) AS count
          FROM video_ts_task
         WHERE ${whereClauses.join(" AND ")}
        `,
        params,
      ),
    ]);

    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10) || 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      tasks: listResult.rows.map((row) => this.mapTaskRow(row)),
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  async listTaskRecordsWithDetails(
    userId: string,
    options: { page: number; pageSize: number; status?: string },
  ): Promise<PaginatedVideoTranslateTasksWithDetails> {
    const pool = this.requirePool();
    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const offset = (page - 1) * pageSize;
    const whereClauses = ["user_id = $1"];
    const params: Array<string | number> = [userId];

    if (options.status) {
      params.push(options.status);
      whereClauses.push(`status = $${params.length}`);
    }

    const listParams = [...params, pageSize, offset];

    const [joinedResult, countResult] = await Promise.all([
      pool.query<JoinedTaskDetailRow>(
        `
        WITH paged_tasks AS (
          SELECT id,
                 video_source,
                 video_source_url,
                 user_id,
                 status,
                 progress,
                 progress_message,
                 error_message,
                 created_at,
                 updated_at
            FROM video_ts_task
           WHERE ${whereClauses.join(" AND ")}
           ORDER BY created_at DESC
           LIMIT $${params.length + 1}
           OFFSET $${params.length + 2}
        )
        SELECT
          t.id AS t_id,
          t.video_source AS t_video_source,
          t.video_source_url AS t_video_source_url,
          t.user_id AS t_user_id,
          t.status AS t_status,
          t.progress AS t_progress,
          t.progress_message AS t_progress_message,
          t.error_message AS t_error_message,
          t.created_at AS t_created_at,
          t.updated_at AS t_updated_at,
          d.id AS d_id,
          d.task_id AS d_task_id,
          d.user_id AS d_user_id,
          d.file_name AS d_file_name,
          d.file_path AS d_file_path,
          d.file_size AS d_file_size,
          d.file_format AS d_file_format,
          d.detected_language AS d_detected_language,
          d.created_at AS d_created_at,
          d.updated_at AS d_updated_at
        FROM paged_tasks t
        LEFT JOIN video_ts_detail d
          ON d.task_id = t.id
        ORDER BY t.created_at DESC, d.created_at ASC NULLS LAST, d.id ASC NULLS LAST
        `,
        listParams,
      ),
      pool.query<{ count: string }>(
        `
        SELECT COUNT(*) AS count
          FROM video_ts_task
         WHERE ${whereClauses.join(" AND ")}
        `,
        params,
      ),
    ]);

    const taskMap = new Map<string, VideoTranslateTaskWithDetails>();

    for (const row of joinedResult.rows) {
      let task = taskMap.get(row.t_id);
      if (!task) {
        task = {
          id: row.t_id,
          taskId: row.t_id,
          userId: row.t_user_id,
          videoSource: row.t_video_source,
          videoSourceUrl: row.t_video_source_url,
          status: row.t_status,
          progress: parseNumeric(row.t_progress),
          progressMessage: row.t_progress_message,
          errorMessage: row.t_error_message,
          createdAt: row.t_created_at.toISOString(),
          updatedAt: row.t_updated_at.toISOString(),
          details: [],
        };
        taskMap.set(row.t_id, task);
      }

      if (row.d_id) {
        task.details.push({
          id: row.d_id,
          taskId: row.d_task_id ?? row.t_id,
          userId: row.d_user_id ?? row.t_user_id,
          fileName: row.d_file_name ?? "",
          filePath: row.d_file_path ?? "",
          fileSize: parseNumeric(row.d_file_size),
          fileFormat: row.d_file_format ?? null,
          detectedLanguage: row.d_detected_language ?? null,
          createdAt: row.d_created_at
            ? row.d_created_at.toISOString()
            : row.t_created_at.toISOString(),
          updatedAt: row.d_updated_at
            ? row.d_updated_at.toISOString()
            : row.t_updated_at.toISOString(),
        });
      }
    }

    const total = Number.parseInt(countResult.rows[0]?.count ?? "0", 10) || 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      tasks: Array.from(taskMap.values()),
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  async streamTask(
    taskId: string,
    onEvent: (task: VideoTranslateTask) => void | Promise<void>,
    options?: StreamOptions,
  ): Promise<void> {
    const endpoint = this.buildUrl(
      `/api/tasks/${encodeURIComponent(taskId)}/stream`,
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.streamTimeoutMs,
    );

    const abortHandler = () => controller.abort();
    if (options?.signal) {
      options.signal.addEventListener("abort", abortHandler);
    }

    const cleanup = () => {
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener("abort", abortHandler);
    };

    let response: Response;
    try {
      response = await httpFetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...this.buildHeaders(false, options?.userId),
        },
        signal: controller.signal,
      });
    } catch (error) {
      cleanup();
      throw new AppError("无法连接转写服务", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_SERVICE_UNAVAILABLE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    if (!response.ok || !response.body) {
      cleanup();
      throw new AppError("任务进度流获取失败", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_STREAM_UNAVAILABLE",
        details: `${response.status} ${response.statusText}`,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");

        while (true) {
          const separatorIndex = buffer.indexOf("\n\n");
          if (separatorIndex === -1) {
            break;
          }

          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          const payload = this.extractSseData(rawEvent);
          if (!payload) {
            continue;
          }

          let parsed: RemoteTaskPayload;
          try {
            parsed = JSON.parse(payload) as RemoteTaskPayload;
          } catch {
            continue;
          }

          const event = this.normalizeTask(parsed, taskId);
          await onEvent(event);

          if (event.status === "completed" || event.status === "failed") {
            await this.notifyTaskOutcome(
              options?.userId,
              taskId,
              event.status,
              event.message,
            );
            controller.abort();
            return;
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted || options?.signal?.aborted) {
        return;
      }

      throw new AppError("任务进度流处理失败", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_STREAM_FAILED",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      cleanup();
      reader.releaseLock();
    }
  }

  private parseJson(text: string): RemoteTaskPayload {
    try {
      return JSON.parse(text) as RemoteTaskPayload;
    } catch (error) {
      throw new AppError("转写服务返回了无效的 JSON", {
        statusCode: 502,
        code: "VIDEO_TRANSLATE_INVALID_RESPONSE",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private normalizeTask(
    payload: RemoteTaskPayload,
    fallbackTaskId: string,
  ): VideoTranslateTask {
    const taskId = payload.task_id ?? payload.taskId ?? fallbackTaskId;
    const status = this.normalizeStatus(payload.status);
    const progress = this.normalizeProgress(payload.progress);
    const files = this.normalizeFiles(payload.details);

    const task: VideoTranslateTask = {
      taskId,
      status,
      progress,
      message: payload.message ?? payload.error ?? null,
    };

    if (typeof payload.status === "string") {
      task.rawStatus = payload.status;
    }

    if (files) {
      task.files = files;
    }

    return task;
  }

  private normalizeStatus(status?: RemoteStatus): VideoTranslateStatus {
    if (!status) {
      return "processing";
    }

    const normalized = String(status).toLowerCase();
    if (normalized === "completed" || normalized === "done" || normalized === "success") {
      return "completed";
    }
    if (normalized === "error" || normalized === "failed") {
      return "failed";
    }
    if (normalized === "pending" || normalized === "queued") {
      return "pending";
    }

    return "processing";
  }

  private normalizeProgress(
    value: number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(numeric)) {
      return null;
    }

    if (numeric < 0) {
      return 0;
    }
    if (numeric > 100) {
      return 100;
    }

    return Number(numeric.toFixed(2));
  }

  private normalizeFiles(
    files?: RemoteTaskFile[],
  ): VideoTranslateFile[] | undefined {
    if (!Array.isArray(files) || files.length === 0) {
      return undefined;
    }

    const normalized: VideoTranslateFile[] = [];

    files.forEach((file, index) => {
      const downloadUrl = file.download_url ?? file.file_path;
      if (!downloadUrl) {
        return;
      }

      const fileName =
        file.filename && file.filename.trim().length > 0
          ? file.filename
          : `transcript-${index + 1}.${file.format ?? "txt"}`;

      normalized.push({
        fileName,
        downloadUrl,
        fileSize: this.normalizeSize(file.size),
        format: file.format ?? null,
        language: file.language ?? null,
      });
    });

    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeSize(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numeric =
      typeof value === "number"
        ? value
        : Number.parseFloat(String(value));

    if (!Number.isFinite(numeric) || numeric < 0) {
      return null;
    }

    return Math.round(numeric);
  }

  private extractSseData(rawEvent: string): string | null {
    const lines = rawEvent.split(/\r?\n/);
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) {
      return null;
    }

    return dataLines.join("\n");
  }

  private buildUrl(pathname: string): string {
    return new URL(pathname, this.config.baseUrl).toString();
  }

  private async notifyTaskOutcome(
    userId: string | undefined,
    taskId: string,
    status: "completed" | "failed",
    message?: string | null,
  ): Promise<void> {
    if (!userId || !this.notificationService) {
      return;
    }

    const msgTitle = status === "completed" ? "视频转写完成" : "视频转写失败";
    const msgContentParts = [`任务ID: ${taskId}`];
    if (message) {
      msgContentParts.push(
        status === "completed" ? `备注: ${message}` : `原因: ${message}`,
      );
    }

    try {
      await this.notificationService.createNotification({
        userId,
        msgType: "video_translate",
        msgStatus: "unread",
        msgTitle,
        msgContent: msgContentParts.join("\n"),
      });
    } catch (error) {
      console.error(
        "[video-translate] Failed to create notification",
        error,
      );
    }
  }

  private buildHeaders(
    isJson: boolean,
    userId?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = this.buildAuthHeaders(userId);
    if (isJson) {
      headers["Content-Type"] = "application/json";
      headers.Accept = "application/json";
    }

    return headers;
  }

  private buildAuthHeaders(userId?: string): Record<string, string> {
    const uid = userId ?? "service";
    // Python 端按秒级时间戳校验，有效期窗口内才接受
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = randomUUID();
    const payload = `${uid}|${ts}|${nonce}`;
    const sign = createHmac("sha256", this.config.sharedSecret)
      .update(payload)
      .digest("hex");

    return {
      "X-Auth-UserId": uid,
      "X-Auth-Timestamp": ts,
      "X-Auth-Nonce": nonce,
      "X-Auth-Sign": sign,
    };
  }

  private extractDownloadUrl(payload: unknown): string | null {
    if (!payload) {
      return null;
    }

    if (typeof payload === "string") {
      const trimmed = payload.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof payload === "object") {
      const source = payload as Record<string, unknown>;
      const direct =
        source.url ??
        source.download_url ??
        (typeof source.data === "object" && source.data
          ? (source.data as Record<string, unknown>).url ??
            (source.data as Record<string, unknown>).download_url
          : undefined);

      if (typeof direct === "string" && direct.trim().length > 0) {
        return direct.trim();
      }
    }

    return null;
  }

  private mapTaskRow(row: VideoTranslateTaskRow): VideoTranslateTaskRecord {
    return {
      id: row.id,
      taskId: row.id,
      userId: row.user_id,
      videoSource: row.video_source,
      videoSourceUrl: row.video_source_url,
      status: row.status,
      progress: parseNumeric(row.progress),
      progressMessage: row.progress_message,
      errorMessage: row.error_message,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private requirePool(): Pool {
    if (!this.pool) {
      throw new AppError("数据库未配置", {
        statusCode: 500,
        code: "DATABASE_NOT_CONFIGURED",
      });
    }

    return this.pool;
  }
}

interface VideoTranslateTaskRow {
  id: string;
  video_source: string | null;
  video_source_url: string | null;
  user_id: string;
  status: string;
  progress: string | number | null;
  progress_message: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface JoinedTaskDetailRow {
  t_id: string;
  t_video_source: string | null;
  t_video_source_url: string | null;
  t_user_id: string;
  t_status: string;
  t_progress: string | number | null;
  t_progress_message: string | null;
  t_error_message: string | null;
  t_created_at: Date;
  t_updated_at: Date;
  d_id: string | null;
  d_task_id: string | null;
  d_user_id: string | null;
  d_file_name: string | null;
  d_file_path: string | null;
  d_file_size: string | number | null;
  d_file_format: string | null;
  d_detected_language: string | null;
  d_created_at: Date | null;
  d_updated_at: Date | null;
}

function parseNumeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}
