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
  durationSeconds: number | null;
  isShort: boolean | null;
  shortRuleVersion: string | null;
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
  topComment?: YouTubeVideoTopComment | null;
}

export interface YouTubeVideoTopComment {
  videoId: string;
  channelId: string;
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
  lastUpdate: string | null;
}

export interface YouTubeEtagCacheEntry {
  resourceType: YouTubeResourceType;
  resourceId: string;
  etag: string | null;
  lastChecked: string | null;
}
