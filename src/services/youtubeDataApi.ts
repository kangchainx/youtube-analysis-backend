import { URL } from "node:url";

interface YouTubeChannelResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: Record<
        string,
        {
          url?: string;
        }
      >;
    };
    statistics?: {
      viewCount?: string;
      subscriberCount?: string;
    };
  }>;
}

export interface YouTubeChannelDetails {
  id: string;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  viewCount: string | null;
  subscriberCount: string | null;
}

export class YouTubeDataApi {
  constructor(private readonly apiKey: string) {}

  async fetchChannelByHandle(handle: string): Promise<YouTubeChannelDetails | null> {
    const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("forHandle", normalizedHandle);
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        `YouTube API request failed with status ${response.status}: ${await response.text()}`,
      );
    }

    const body = (await response.json()) as YouTubeChannelResponse;
    const item = body.items?.[0];
    if (!item?.id || !item.snippet) {
      return null;
    }

    const thumbnails = item.snippet.thumbnails ?? {};
    const thumbnail =
      thumbnails.maxres ??
      thumbnails.standard ??
      thumbnails.high ??
      thumbnails.medium ??
      thumbnails.default;

    return {
      id: item.id,
      title: item.snippet.title ?? normalizedHandle,
      description: item.snippet.description ?? null,
      avatarUrl: thumbnail?.url ?? null,
      viewCount: item.statistics?.viewCount ?? null,
      subscriberCount: item.statistics?.subscriberCount ?? null,
    };
  }
}
