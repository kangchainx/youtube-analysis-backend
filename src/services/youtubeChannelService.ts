import { AppError } from "../utils/appError";

export interface ChannelSummary {
  channelId: string;
  channelName: string | null;
  type: "mine" | "managed";
  customUrl: string | null;
  publishedAt: string | null;
  description: string | null;
  viewCount: number | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean | null;
  videoCount: number | null;
}

interface ChannelItem {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    description?: string;
    publishedAt?: string;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
}

interface ChannelListResponse {
  items?: ChannelItem[];
  nextPageToken?: string;
}

export class YouTubeChannelService {
  async fetchOwnedAndManagedChannels(accessToken: string): Promise<ChannelSummary[]> {
    const owned = await this.fetchChannels(accessToken, "mine");
    const managed = await this.fetchChannels(accessToken, "managed");
    return mergeChannels(owned, managed);
  }

  private async fetchChannels(
    accessToken: string,
    mode: "mine" | "managed",
  ): Promise<ChannelSummary[]> {
    const summaries: ChannelSummary[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/channels");
      url.searchParams.set("part", "id,snippet,statistics");
      url.searchParams.set(mode === "mine" ? "mine" : "managedByMe", "true");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = await safeReadBody(response);

      // 如果权限不足（403），忽略并返回空列表，不影响后续流程
      if (response.status === 403) {
        return [];
      }

      if (!response.ok) {
        throw new AppError("获取频道列表失败", {
          statusCode: response.status,
          code: "YOUTUBE_CHANNEL_LIST_FAILED",
          details: {
            statusText: response.statusText,
            body,
          },
        });
      }

      const data = body as ChannelListResponse;
      for (const item of data.items ?? []) {
        if (!item.id) {
          continue;
        }
        const statistics = item.statistics;
        summaries.push({
          channelId: item.id,
          channelName: item.snippet?.title ?? null,
          type: mode,
          customUrl: item.snippet?.customUrl ?? null,
          description: item.snippet?.description ?? null,
          viewCount: parseNumber(statistics?.viewCount),
          subscriberCount: parseNumber(statistics?.subscriberCount),
          hiddenSubscriberCount: statistics?.hiddenSubscriberCount ?? null,
          videoCount: parseNumber(statistics?.videoCount),
          publishedAt: item.snippet?.publishedAt ?? null,
        });
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return summaries;
  }
}

function mergeChannels(
  owned: ChannelSummary[],
  managed: ChannelSummary[],
): ChannelSummary[] {
  const map = new Map<string, ChannelSummary>();
  for (const entry of owned) {
    map.set(entry.channelId, entry);
  }
  for (const entry of managed) {
    if (!map.has(entry.channelId)) {
      map.set(entry.channelId, entry);
    }
  }
  return Array.from(map.values());
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

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
