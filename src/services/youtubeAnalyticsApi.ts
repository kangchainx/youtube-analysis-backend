import { URL } from "node:url";
import { AppError } from "../utils/appError";

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/";

type QueryParams = Record<string, unknown>;

export class YouTubeAnalyticsApi {
  async queryReports(params: QueryParams, accessToken: string): Promise<unknown> {
    const url = this.buildUrl("reports", params);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await safeReadBody(response);

    if (!response.ok) {
      throw new AppError("YouTube Analytics API 请求失败", {
        statusCode: response.status,
        code: "YOUTUBE_ANALYTICS_API_ERROR",
        details: {
          statusText: response.statusText,
          body: payload,
        },
      });
    }

    return payload;
  }

  private buildUrl(path: string, params: QueryParams): URL {
    const url = new URL(path, ANALYTICS_BASE);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            url.searchParams.append(key, String(item));
          }
        }
      } else {
        url.searchParams.append(key, String(value));
      }
    }
    return url;
  }
}

async function safeReadBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
