import ExcelJS from "exceljs";
import { Router } from "express";
import { requireAuth } from "../middleware/authentication";
import { AppError } from "../utils/appError";

interface ExportRequestBody {
  channelName?: string;
  videos?: unknown;
  includeHotComments?: boolean;
}

type ExportFormat = "csv" | "excel";

const COVER_TEXT_COLUMN = "封面文字";

const preferredColumnOrder = [
  "id",
  "videoId",
  "title",
  "channelName",
  "channelId",
  "publishedAt",
  "url",
  "duration",
  "viewCount",
  "likeCount",
  "commentCount",
];

export const exportRouter = Router();

exportRouter.use(requireAuth);

exportRouter.post("/videos", async (req, res, next) => {
  try {
    const formatParam =
      typeof req.query.format === "string" ? req.query.format.toLowerCase() : "csv";
    const format: ExportFormat = formatParam === "excel" ? "excel" : "csv";

    const body = req.body as ExportRequestBody;
    const channelName =
      typeof body.channelName === "string" && body.channelName.length > 0
        ? body.channelName
        : undefined;

    const rawVideos = Array.isArray(body.videos) ? body.videos : undefined;
    if (!rawVideos || rawVideos.length === 0) {
      throw new AppError("videos must be a non-empty array", {
        statusCode: 400,
        code: "INVALID_VIDEOS_PAYLOAD",
      });
    }

    const videos = rawVideos.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new AppError(`videos[${index}] must be an object`, {
          statusCode: 400,
          code: "INVALID_VIDEO_ITEM",
        });
      }

      return item as Record<string, unknown>;
    });

    const includeHotComments = Boolean(body.includeHotComments);

    const columns = collectColumns(videos, includeHotComments);

    const rows = videos.map((video) => buildRow(video, columns, includeHotComments));

    const filename = buildFilename(channelName, format);

    if (format === "csv") {
      const csv = buildCsv(columns, rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
      return;
    }

    const buffer = await buildExcel(columns, rows);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

function collectColumns(
  videos: Array<Record<string, unknown>>,
  includeHotComments: boolean,
): string[] {
  const dynamicKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const video of videos) {
    for (const key of Object.keys(video)) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        dynamicKeys.push(key);
      }
    }
  }

  const orderedPreferred = preferredColumnOrder.filter((key) => seenKeys.has(key));
  const remaining = dynamicKeys.filter((key) => !preferredColumnOrder.includes(key));

  const columns = [...orderedPreferred, ...remaining];

  if (includeHotComments && !columns.includes("hotComments")) {
    columns.push("hotComments");
  }

  if (!columns.includes(COVER_TEXT_COLUMN)) {
    columns.push(COVER_TEXT_COLUMN);
  }

  return columns;
}

function buildRow(
  video: Record<string, unknown>,
  columns: string[],
  includeHotComments: boolean,
): Record<string, string> {
  const row: Record<string, string> = {};

  for (const column of columns) {
    if (column === COVER_TEXT_COLUMN) {
      row[column] = "";
      continue;
    }

    if (column === "hotComments" && includeHotComments) {
      row[column] = formatHotComments(video[column]);
      continue;
    }

    row[column] = formatCell(video[column]);
  }

  return row;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatCell(entry)).join("\n");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatHotComments(value: unknown): string {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") {
          return formatCell(item);
        }

        const record = item as Record<string, unknown>;
        const author = formatCell(record.authorDisplayName ?? record.author ?? "");
        const text = formatCell(record.text ?? record.comment ?? "");

        if (author && text) {
          return `${author}: ${text}`;
        }

        return formatCell(item);
      })
      .join("\n");
  }

  return formatCell(value);
}

function buildCsv(columns: string[], rows: Array<Record<string, string>>): string {
  const header = columns.map(csvEscape).join(",");
  const body = rows
    .map((row) => columns.map((column) => csvEscape(row[column] ?? "")).join(","))
    .join("\n");

  return `${header}\n${body}`;
}

function csvEscape(value: string): string {
  if (value === undefined || value === null) {
    return "";
  }

  const needsQuoting = /[",\n\r]/.test(value);
  if (!needsQuoting) {
    return value;
  }

  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function buildExcel(columns: string[], rows: Array<Record<string, string>>) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Videos");

  worksheet.columns = columns.map((column) => ({ header: column, key: column }));

  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  columns.forEach((column, index) => {
    const columnRef = worksheet.getColumn(index + 1);
    columnRef.width = Math.min(
      60,
      Math.max(12, Math.floor(getMaxColumnLength(rows, column) * 1.1)),
    );
  });

  return workbook.xlsx.writeBuffer();
}

function getMaxColumnLength(rows: Array<Record<string, string>>, column: string) {
  return rows.reduce((max, row) => {
    const length = (row[column] ?? "").length;
    return length > max ? length : max;
  }, 0);
}

function buildFilename(channelName: string | undefined, format: ExportFormat): string {
  const normalizedChannel = channelName ? sanitizeFilename(channelName) : "videos";
  const timestamp = new Date().toISOString().replace(/[:]/g, "-");
  const extension = format === "csv" ? "csv" : "xlsx";

  return `${normalizedChannel || "videos"}-${timestamp}.${extension}`;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}
