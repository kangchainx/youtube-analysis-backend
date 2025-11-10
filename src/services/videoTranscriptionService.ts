import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { FormData, fetch as undiciFetch } from "undici";
import type { VideoTranscriptionConfig } from "../config/env";
import { AppError } from "../utils/appError";

type RemoteTaskStatus = "pending" | "processing" | "completed" | "error" | string;

interface ProcessVideoResponseBody {
  task_id?: string;
  taskId?: string;
  message?: string;
}

interface RemoteFileDescriptor {
  filename: string;
  download_url: string;
  size?: number | string;
  format?: string;
  language?: string;
}

interface StreamEvent {
  status?: RemoteTaskStatus;
  progress?: number | string;
  message?: string;
  error?: string;
  files?: RemoteFileDescriptor[];
}

export interface StartVideoTranscriptionParams {
  userId: string;
  url: string;
  summaryLanguage: string;
  exportFormat: "markdown" | "txt" | "docx" | "pdf";
  includeTimestamps: boolean;
  includeHeader: boolean;
}

export interface StartVideoTranscriptionResult {
  taskRecordId: string;
  taskId: string;
  status: "processing";
  message?: string | undefined;
}

export interface VideoTranscriptionTaskRecord {
  id: string;
  taskId: string;
  videoSource: string | null;
  videoSourceUrl: string | null;
  userId: string;
  status: string;
  progress: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoTranscriptionFileRecord {
  id: string;
  vttId: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  fileFormat: string | null;
  detectedLanguage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VideoTranscriptionTaskRow {
  id: string;
  task_id: string;
  video_source: string | null;
  video_source_url: string | null;
  user_id: string;
  status: string;
  progress: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface VideoTranscriptionDetailRow {
  id: string;
  vtt_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: string | number | null;
  file_format: string | null;
  detected_language: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MonitorTaskParams {
  taskRecordId: string;
  taskId: string;
  userId: string;
}

const VIDEO_SOURCE_DIRECT_URL = "youtube";
const httpFetch = undiciFetch as typeof globalThis.fetch;

export class VideoTranscriptionService {
  constructor(
    private readonly pool: Pool,
    private readonly config: VideoTranscriptionConfig,
  ) {}

  async startTranscriptionTask(
    params: StartVideoTranscriptionParams,
  ): Promise<StartVideoTranscriptionResult> {
    const remote = await this.triggerRemoteTranscription(params);
    const taskRecordId = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO video_ts_task (
         id,
         task_id,
         video_source,
         video_source_url,
         user_id,
         status,
         progress,
         error_message,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'processing', 0, NULL, $6, $6)`,
      [
        taskRecordId,
        remote.taskId,
        VIDEO_SOURCE_DIRECT_URL,
        params.url,
        params.userId,
        now,
      ],
    );

    void this.monitorTask({
      taskId: remote.taskId,
      taskRecordId,
      userId: params.userId,
    });

    return {
      taskRecordId,
      taskId: remote.taskId,
      status: "processing",
      message: remote.message,
    };
  }

  async getTaskByTaskId(
    taskId: string,
    userId: string,
  ): Promise<VideoTranscriptionTaskRecord | null> {
    const { rows } = await this.pool.query<VideoTranscriptionTaskRow>(
      `SELECT id,
              task_id,
              video_source,
              video_source_url,
              user_id,
              status,
              progress,
              error_message,
              created_at,
              updated_at
         FROM video_ts_task
        WHERE task_id = $1
          AND user_id = $2`,
      [taskId, userId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      taskId: row.task_id,
      videoSource: row.video_source,
      videoSourceUrl: row.video_source_url,
      userId: row.user_id,
      status: row.status,
      progress: parseNumeric(row.progress),
      errorMessage: row.error_message,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async listDetailsByTaskId(
    taskRecordId: string,
    userId: string,
  ): Promise<VideoTranscriptionFileRecord[]> {
    const { rows } = await this.pool.query<VideoTranscriptionDetailRow>(
      `SELECT id,
              vtt_id,
              user_id,
              file_name,
              file_path,
              file_size,
              file_format,
              detected_language,
              created_at,
              updated_at
         FROM video_ts_detail
        WHERE vtt_id = $1
          AND user_id = $2
        ORDER BY created_at ASC, id ASC`,
      [taskRecordId, userId],
    );

    return rows.map((row) => ({
      id: row.id,
      vttId: row.vtt_id,
      userId: row.user_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: parseNumeric(row.file_size),
      fileFormat: row.file_format,
      detectedLanguage: row.detected_language,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  private async triggerRemoteTranscription(
    params: StartVideoTranscriptionParams,
  ): Promise<{ taskId: string; message?: string | undefined }> {
    const form = new FormData();
    form.set("url", params.url);
    form.set("summary_language", params.summaryLanguage);
    form.set("export_format", params.exportFormat);
    form.set("export_include_timestamps", String(params.includeTimestamps));
    form.set("export_include_header", String(params.includeHeader));

    const endpoint = this.buildUrl("/api/video/transcribe");
    console.info("[video-ts] 调用 Python /api/video/transcribe", {
      endpoint,
      url: params.url,
      // summaryLanguage: params.summaryLanguage,
      exportFormat: params.exportFormat,
      includeTimestamps: params.includeTimestamps,
      includeHeader: params.includeHeader,
    });

    let response: Response;
    try {
      response = await httpFetch(endpoint, {
        method: "POST",
        body: form,
      });
    } catch (error) {
      throw new AppError("无法连接转写服务", {
        statusCode: 502,
        code: "VIDEO_TS_SERVICE_UNAVAILABLE",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw new AppError("转写服务请求失败", {
        statusCode: 502,
        code: "VIDEO_TS_PROCESS_FAILED",
        details: bodyText,
      });
    }

    let parsed: ProcessVideoResponseBody;
    try {
      parsed = JSON.parse(bodyText) as ProcessVideoResponseBody;
    } catch (error) {
      throw new AppError("转写服务返回了无效的 JSON", {
        statusCode: 502,
        code: "VIDEO_TS_PROCESS_FAILED",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    const taskId = parsed.task_id ?? parsed.taskId;
    if (!taskId) {
      throw new AppError("转写服务未返回任务 ID", {
        statusCode: 502,
        code: "VIDEO_TS_PROCESS_FAILED",
      });
    }

    console.info("[video-ts] Python /api/process-video 调用成功", {
      endpoint,
      taskId,
    });

    return { taskId, message: parsed.message };
  }

  private async monitorTask(params: MonitorTaskParams): Promise<void> {
    try {
      await this.consumeTaskStream(params, async (event) => {
        await this.handleStreamEvent(params, event);
      });
    } catch (error) {
      console.error(
        `[video-ts] Failed to track task ${params.taskId}`,
        error,
      );

      const message =
        error instanceof Error ? error.message : "无法获取任务进度";
      await this.markTaskFailed(
        params.taskRecordId,
        `任务进度监听失败: ${message}`,
      );
    }
  }

  private async consumeTaskStream(
    params: MonitorTaskParams,
    onEvent: (event: StreamEvent) => Promise<void>,
  ): Promise<void> {
    const endpoint = this.buildUrl(
      `/api/video/transcribe/process/stream/${params.taskId}`,
    );
    console.info("[video-ts] 建立 SSE 监听", {
      endpoint,
      taskId: params.taskId,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.streamTimeoutMs);

    let response: Response;
    try {
      response = await httpFetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

    if (!response.ok || !response.body) {
      clearTimeout(timeoutId);
      throw new Error(
        `转写服务流式接口返回异常状态: ${response.status} ${response.statusText}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.info("[video-ts] SSE 数据流结束", {
            endpoint,
            taskId: params.taskId,
          });
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

          let event: StreamEvent;
          try {
            event = JSON.parse(payload) as StreamEvent;
          } catch (error) {
            console.warn("[video-ts] Failed to parse SSE payload", error);
            continue;
          }

          console.info("[video-ts] 收到 SSE 事件", {
            taskId: params.taskId,
            status: event.status,
            progress: event.progress,
            message: event.message,
          });

          await onEvent(event);

          if (event.status === "completed" || event.status === "error") {
            controller.abort();
            console.info("[video-ts] SSE 监听结束", {
              taskId: params.taskId,
              terminalStatus: event.status,
            });
            return;
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }
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

  private async handleStreamEvent(
    params: MonitorTaskParams,
    event: StreamEvent,
  ): Promise<void> {
    const normalizedStatus = this.mapRemoteStatus(event.status);
    const progressValue = this.normalizeProgress(event.progress);
    const isFailure = normalizedStatus === "failed";

    await this.pool.query(
      `UPDATE video_ts_task
       SET status = $2,
           progress = COALESCE($3, progress),
           error_message = $4,
           updated_at = $5
       WHERE id = $1`,
      [
        params.taskRecordId,
        normalizedStatus,
        progressValue,
        isFailure ? event.error ?? event.message ?? null : null,
        new Date(),
      ],
    );

    if (normalizedStatus === "completed") {
      const files =
        event.files && event.files.length > 0
          ? event.files
          : await this.fetchTaskFiles(params.taskId);
      if (files && files.length > 0) {
        try {
          await this.persistFiles(params.taskRecordId, params.userId, files);
        } catch (error) {
          console.error(
            `[video-ts] Failed to persist files for task ${params.taskId}`,
            error,
          );
        }
      }
    }

    if (isFailure) {
      console.warn(
        `[video-ts] Task ${params.taskId} failed: ${event.error ?? event.message}`,
      );
    }
  }

  private mapRemoteStatus(
    status?: RemoteTaskStatus,
  ): "processing" | "completed" | "failed" {
    const normalized = (status ?? "processing").toLowerCase();
    if (normalized === "completed") {
      return "completed";
    }
    if (normalized === "error" || normalized === "failed") {
      return "failed";
    }
    return "processing";
  }

  private normalizeProgress(value: number | string | undefined): number | null {
    if (value === undefined) {
      return null;
    }

    const numericValue =
      typeof value === "number" ? value : Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) {
      return null;
    }

    if (numericValue < 0) {
      return 0;
    }
    if (numericValue > 100) {
      return 100;
    }

    return Number(numericValue.toFixed(2));
  }

  private async fetchTaskFiles(taskId: string): Promise<RemoteFileDescriptor[]> {
    const endpoint = this.buildUrl("/api/video/transcribe/process", {
      task_id: taskId,
    });
    console.info("[video-ts] 查询任务文件", { endpoint, taskId });

    let response: Response;
    try {
      response = await httpFetch(endpoint, {
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.warn(
        `[video-ts] Failed to fetch task files for ${taskId}`,
        error,
      );
      return [];
    }

    if (!response.ok) {
      console.warn(
        `[video-ts] Task file fetch returned status ${response.status}`,
      );
      return [];
    }

    const body = (await response.json()) as StreamEvent;
    if (body.status !== "completed" || !Array.isArray(body.files)) {
      return [];
    }

    console.info("[video-ts] 成功获取任务文件", {
      taskId,
      fileCount: body.files.length,
    });

    return body.files;
  }

  private async persistFiles(
    taskRecordId: string,
    userId: string,
    files: RemoteFileDescriptor[],
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const now = new Date();
    const values: unknown[] = [];
    const rows: string[] = [];
    const columnCount = 10;

    files.forEach((file) => {
      if (!file.download_url) {
        console.warn(
          `[video-ts] Skip file without download_url for task ${taskRecordId}`,
        );
        return;
      }

      const rawSize =
        typeof file.size === "number"
          ? file.size
          : file.size !== undefined
          ? Number.parseInt(String(file.size), 10)
          : null;
      const normalizedSize =
        typeof rawSize === "number" && Number.isFinite(rawSize)
          ? rawSize
          : null;
      const fileName =
        file.filename ??
        `transcript-${rows.length + 1}.${file.format ?? "txt"}`;
      const recordId = randomUUID();
      const paramOffset = rows.length * columnCount;

      rows.push(
        `($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4}, $${paramOffset + 5}, $${paramOffset + 6}, $${paramOffset + 7}, $${paramOffset + 8}, $${paramOffset + 9}, $${paramOffset + 10})`,
      );

      values.push(
        recordId,
        taskRecordId,
        userId,
        fileName,
        file.download_url,
        normalizedSize,
        file.format ?? null,
        file.language ?? null,
        now,
        now,
      );
    });

    if (rows.length === 0) {
      return;
    }

    const deleteQuery = `DELETE FROM video_ts_detail WHERE vtt_id = $1`;
    await this.pool.query(deleteQuery, [taskRecordId]);

    const insertQuery = `
      INSERT INTO video_ts_detail (
        id,
        vtt_id,
        user_id,
        file_name,
        file_path,
        file_size,
        file_format,
        detected_language,
        created_at,
        updated_at
      ) VALUES ${rows.join(", ")}
    `;

    await this.pool.query(insertQuery, values);
  }

  private async markTaskFailed(taskRecordId: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE video_ts_task
       SET status = 'failed',
           error_message = $2,
           updated_at = $3
       WHERE id = $1`,
      [taskRecordId, message, new Date()],
    );
  }

  private buildUrl(
    pathname: string,
    searchParams?: Record<string, string>,
  ): string {
    const url = new URL(pathname, this.config.baseUrl);
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }
}

function parseNumeric(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}
