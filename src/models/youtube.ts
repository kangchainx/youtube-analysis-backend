export type YouTubeResourceType = "channel" | "playlist" | "video";

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string | null;
  customUrl: string | null;
  country: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
  lastSync: string | null;
}

export interface YouTubeChannelStatistics {
  channelId: string;
  subscriberCount: string | null;
  videoCount: number | null;
  viewCount: string | null;
  hiddenSubscriberCount: boolean;
  lastUpdate: string | null;
}

export interface YouTubeChannelWithStats extends YouTubeChannel {
  statistics: YouTubeChannelStatistics | null;
}

export interface YouTubePlaylist {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  itemCount: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  lastSync: string | null;
}

export interface YouTubeVideo {
  id: string;
  channelId: string;
  playlistId: string | null;
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
  lastSync: string | null;
}

export interface YouTubeVideoStatistics {
  videoId: string;
  viewCount: string | null;
  likeCount: string | null;
  favoriteCount: string | null;
  commentCount: string | null;
  lastUpdate: string | null;
}

export interface YouTubeVideoWithStats extends YouTubeVideo {
  statistics: YouTubeVideoStatistics | null;
}

export interface YouTubeEtagCacheEntry {
  resourceType: YouTubeResourceType;
  resourceId: string;
  etag: string | null;
  lastChecked: string | null;
}
