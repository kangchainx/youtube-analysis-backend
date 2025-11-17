import { URL } from "node:url";
import { AppError } from "../utils/appError";

interface ChannelListResponse {
  items?: ChannelItem[];
  nextPageToken?: string;
}

interface PlaylistListResponse {
  items?: PlaylistItem[];
  nextPageToken?: string;
}

interface PlaylistItemListResponse {
  items?: PlaylistVideoItem[];
  nextPageToken?: string;
}

interface VideosListResponse {
  items?: VideoItem[];
}

interface CommentThreadListResponse {
  items?: CommentThreadItem[];
  nextPageToken?: string;
}

interface ChannelItem {
  etag?: string;
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    country?: string;
    publishedAt?: string;
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
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

interface PlaylistItem {
  etag?: string;
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: {
    itemCount?: number;
  };
}

interface PlaylistVideoItem {
  contentDetails?: {
    videoId?: string;
  };
}

interface VideoItem {
  etag?: string;
  id?: string;
  snippet?: {
    channelId?: string;
    title?: string;
    description?: string;
    publishedAt?: string;
    tags?: string[];
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: {
    duration?: string;
    dimension?: string;
    definition?: string;
    caption?: string;
    licensedContent?: boolean;
  };
  status?: {
    privacyStatus?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    favoriteCount?: string;
    commentCount?: string;
  };
}

interface CommentThreadItem {
  snippet?: {
    videoId?: string;
    canReply?: boolean;
    isPublic?: boolean;
    totalReplyCount?: number;
    topLevelComment?: {
      snippet?: {
        textOriginal?: string;
        authorDisplayName?: string;
        authorProfileImageUrl?: string;
        authorChannelUrl?: string;
        authorChannelId?: {
          value?: string;
        };
        likeCount?: number;
        publishedAt?: string;
        updatedAt?: string;
      };
    };
  };
}

export interface YouTubeChannelDetails {
  id: string;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  viewCount: string | null;
  subscriberCount: string | null;
  etag: string | null;
}

export interface YouTubeChannelFullDetails {
  id: string;
  title: string;
  description: string | null;
  customUrl: string | null;
  country: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
  viewCount: string | null;
  subscriberCount: string | null;
  videoCount: number | null;
  hiddenSubscriberCount: boolean;
  etag: string | null;
}

export interface YouTubePlaylistDetails {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  itemCount: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  etag: string | null;
}

export interface YouTubeVideoDetails {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  duration: string | null;
  dimension: string | null;
  definition: string | null;
  caption: boolean | null;
  licensedContent: boolean | null;
  thumbnailUrl: string | null;
  tags: string[];
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  privacyStatus: string | null;
  statistics: {
    viewCount: string | null;
    likeCount: string | null;
    favoriteCount: string | null;
    commentCount: string | null;
  };
  etag: string | null;
}

export interface YouTubeTopCommentDetails {
  videoId: string;
  commentContent: string | null;
  canReply: boolean | null;
  isPublic: boolean | null;
  likeCount: number | null;
  totalReplyCount: number | null;
  authorDisplayName: string | null;
  authorProfileImageUrl: string | null;
  authorChannelUrl: string | null;
  authorChannelId: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}

const API_BASE = "https://www.googleapis.com/youtube/v3/";
const MAX_BATCH_IDS = 50;
const MAX_PAGE_SIZE = 50;

export class YouTubeDataApi {
  constructor(private readonly apiKey: string) {}

  async fetchChannelByHandle(handle: string): Promise<YouTubeChannelDetails | null> {
    const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;
    const url = this.buildUrl("channels", {
      part: "snippet,statistics",
      forHandle: normalizedHandle,
    });

    const body = await this.request<ChannelListResponse>(url);
    const item = body.items?.[0];
    if (!item?.id || !item.snippet) {
      return null;
    }

    const thumbnailUrl = selectThumbnailUrl(item.snippet.thumbnails);
    return {
      id: item.id,
      title: item.snippet.title ?? normalizedHandle,
      description: item.snippet.description ?? null,
      avatarUrl: thumbnailUrl,
      viewCount: item.statistics?.viewCount ?? null,
      subscriberCount: item.statistics?.subscriberCount ?? null,
      etag: item.etag ?? null,
    };
  }

  async fetchChannelById(channelId: string): Promise<YouTubeChannelFullDetails | null> {
    const url = this.buildUrl("channels", {
      part: "snippet,contentDetails,statistics",
      id: channelId,
    });

    const body = await this.request<ChannelListResponse>(url);
    const item = body.items?.[0];
    if (!item?.id || !item.snippet) {
      return null;
    }

    return mapChannelItemToDetails(item);
  }

  async fetchPlaylistsByChannel(channelId: string): Promise<YouTubePlaylistDetails[]> {
    const playlists: YouTubePlaylistDetails[] = [];
    let pageToken: string | undefined;

    do {
      const url = this.buildUrl("playlists", {
        part: "snippet,contentDetails",
        channelId,
        maxResults: String(MAX_PAGE_SIZE),
        pageToken,
      });

      const body = await this.request<PlaylistListResponse>(url);
      for (const item of body.items ?? []) {
        if (!item.id || !item.snippet?.title || !item.snippet.channelId) {
          continue;
        }

        playlists.push({
          id: item.id,
          channelId: item.snippet.channelId,
          title: item.snippet.title,
          description: item.snippet.description ?? null,
          itemCount: item.contentDetails?.itemCount ?? null,
          publishedAt: item.snippet.publishedAt ?? null,
          thumbnailUrl: selectThumbnailUrl(item.snippet.thumbnails),
          etag: item.etag ?? null,
        });
      }

      pageToken = body.nextPageToken;
    } while (pageToken);

    return playlists;
  }

  async fetchPlaylistVideoIds(playlistId: string): Promise<string[]> {
    const videoIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const url = this.buildUrl("playlistItems", {
        part: "contentDetails",
        playlistId,
        maxResults: String(MAX_PAGE_SIZE),
        pageToken,
      });

      const body = await this.request<PlaylistItemListResponse>(url);
      for (const item of body.items ?? []) {
        const videoId = item.contentDetails?.videoId;
        if (videoId) {
          videoIds.push(videoId);
        }
      }
      pageToken = body.nextPageToken;
    } while (pageToken);

    return videoIds;
  }

  async fetchVideosByIds(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
    const batches = chunkArray(videoIds, MAX_BATCH_IDS);
    const videos: YouTubeVideoDetails[] = [];

    for (const batch of batches) {
      if (batch.length === 0) {
        continue;
      }

      const url = this.buildUrl("videos", {
        part: "snippet,contentDetails,status,statistics",
        id: batch.join(","),
        maxResults: String(MAX_PAGE_SIZE),
      });

      const body = await this.request<VideosListResponse>(url);
      for (const item of body.items ?? []) {
        const mapped = mapVideoItemToDetails(item);
        if (mapped) {
          videos.push(mapped);
        }
      }
    }

    return videos;
  }

  async fetchTopCommentByVideo(
    videoId: string,
    options?: { excludeChannelId?: string },
  ): Promise<YouTubeTopCommentDetails | null> {
    const excluded = options?.excludeChannelId ?? null;
    let pageToken: string | undefined;

    do {
      const url = this.buildUrl("commentThreads", {
        part: "snippet",
        videoId,
        maxResults: "10",
        order: "relevance",
        pageToken,
      });

      const body = await this.request<CommentThreadListResponse>(url);
      for (const item of body.items ?? []) {
        const details = mapCommentThreadItemToDetails(item);
        if (!details) {
          continue;
        }

        if (excluded && details.authorChannelId && details.authorChannelId === excluded) {
          continue;
        }

        return details;
      }

      pageToken = body.nextPageToken;
    } while (pageToken);

    return null;
  }

  private buildUrl(path: string, params: Record<string, string | undefined>): URL {
    const url = new URL(path, API_BASE);
    url.searchParams.set("key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
    return url;
  }

  private async request<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (error) {
      throw new AppError("无法连接到 YouTube Data API，请稍后再试", {
        statusCode: 502,
        code: "YOUTUBE_API_UNREACHABLE",
        details: {
          url: url.pathname,
          reason: error instanceof Error ? error.message : String(error),
        },
      });
    }

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new AppError("YouTube Data API 请求失败", {
        statusCode: response.status,
        code: "YOUTUBE_API_ERROR",
        details: {
          url: url.pathname,
          statusText: response.statusText,
          body,
        },
      });
    }

    return (await response.json()) as T;
  }
}

async function safeReadText(response: Response): Promise<string | null> {
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function selectThumbnailUrl(
  thumbnails?: Record<string, { url?: string }> | null,
): string | null {
  if (!thumbnails) {
    return null;
  }

  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    null
  );
}

function mapChannelItemToDetails(item: ChannelItem): YouTubeChannelFullDetails | null {
  if (!item.id || !item.snippet) {
    return null;
  }

  return {
    id: item.id,
    title: item.snippet.title ?? item.id,
    description: item.snippet.description ?? null,
    customUrl: item.snippet.customUrl ?? null,
    country: item.snippet.country ?? null,
    publishedAt: item.snippet.publishedAt ?? null,
    thumbnailUrl: selectThumbnailUrl(item.snippet.thumbnails),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    viewCount: item.statistics?.viewCount ?? null,
    subscriberCount: item.statistics?.subscriberCount ?? null,
    videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : null,
    hiddenSubscriberCount: item.statistics?.hiddenSubscriberCount ?? false,
    etag: item.etag ?? null,
  };
}

function mapVideoItemToDetails(item: VideoItem): YouTubeVideoDetails | null {
  if (!item.id || !item.snippet?.channelId) {
    return null;
  }

  const captionValue = item.contentDetails?.caption;
  let caption: boolean | null = null;
  if (captionValue === "true") {
    caption = true;
  } else if (captionValue === "false") {
    caption = false;
  }

  return {
    id: item.id,
    channelId: item.snippet.channelId,
    title: item.snippet.title ?? item.id,
    description: item.snippet.description ?? null,
    publishedAt: item.snippet.publishedAt ?? null,
    duration: item.contentDetails?.duration ?? null,
    dimension: item.contentDetails?.dimension ?? null,
    definition: item.contentDetails?.definition ?? null,
    caption,
    licensedContent: item.contentDetails?.licensedContent ?? null,
    thumbnailUrl: selectThumbnailUrl(item.snippet.thumbnails),
    tags: item.snippet.tags ?? [],
    defaultLanguage: item.snippet.defaultLanguage ?? null,
    defaultAudioLanguage: item.snippet.defaultAudioLanguage ?? null,
    privacyStatus: item.status?.privacyStatus ?? null,
    statistics: {
      viewCount: item.statistics?.viewCount ?? null,
      likeCount: item.statistics?.likeCount ?? null,
      favoriteCount: item.statistics?.favoriteCount ?? null,
      commentCount: item.statistics?.commentCount ?? null,
    },
    etag: item.etag ?? null,
  };
}

function mapCommentThreadItemToDetails(item: CommentThreadItem): YouTubeTopCommentDetails | null {
  const snippet = item.snippet;
  const topLevel = snippet?.topLevelComment?.snippet;
  if (!snippet?.videoId || !topLevel) {
    return null;
  }

  return {
    videoId: snippet.videoId,
    commentContent: topLevel.textOriginal ?? null,
    canReply: snippet.canReply ?? null,
    isPublic: snippet.isPublic ?? null,
    likeCount: topLevel.likeCount ?? null,
    totalReplyCount: snippet.totalReplyCount ?? null,
    authorDisplayName: topLevel.authorDisplayName ?? null,
    authorProfileImageUrl: topLevel.authorProfileImageUrl ?? null,
    authorChannelUrl: topLevel.authorChannelUrl ?? null,
    authorChannelId: topLevel.authorChannelId?.value ?? null,
    publishedAt: topLevel.publishedAt ?? null,
    updatedAt: topLevel.updatedAt ?? null,
  };
}

function chunkArray<T>(source: T[], chunkSize: number): T[][] {
  if (source.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < source.length; index += chunkSize) {
    chunks.push(source.slice(index, index + chunkSize));
  }
  return chunks;
}
