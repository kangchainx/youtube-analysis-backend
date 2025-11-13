import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import type { YouTubeResourceType } from "../models/youtube";
import {
  YouTubeDataApi,
  type YouTubeVideoDetails,
} from "./youtubeDataApi";
import { YouTubeMetadataService } from "./youtubeMetadataService";
import { SubscribedChannelService } from "./subscribedChannelService";

export interface ChannelSyncResult {
  channelId: string;
  playlistsProcessed: number;
  videosProcessed: number;
}

export interface SubscribeChannelResult extends ChannelSyncResult {
  subscribed: boolean;
}

export class YouTubeSubscriptionService {
  constructor(
    private readonly youtubeDataApi: YouTubeDataApi,
    private readonly metadataService: YouTubeMetadataService,
    private readonly subscribedChannelService: SubscribedChannelService,
  ) {}

  async subscribeChannel(channelId: string, userId: string): Promise<SubscribeChannelResult> {
    const trimmed = channelId.trim();
    logger.info("Starting YouTube channel subscription", { channelId: trimmed });

    const existingChannel = await this.metadataService.getChannelById(trimmed);
    let syncResult: (ChannelSyncResult & { customUrl: string | null }) | null = null;
    if (!existingChannel) {
      syncResult = await this.syncChannelData(trimmed);
    }

    const targetChannelId = syncResult?.channelId ?? trimmed;
    const customUrl =
      syncResult?.customUrl ?? existingChannel?.customUrl ?? targetChannelId;

    const subscribed = await this.subscribedChannelService.subscribeUserToChannel(
      userId,
      targetChannelId,
      customUrl ?? targetChannelId,
    );
    logger.info("Recorded user subscription after channel sync", {
      userId,
      channelId: targetChannelId,
      subscribed,
    });

    return {
      channelId: targetChannelId,
      playlistsProcessed: syncResult?.playlistsProcessed ?? 0,
      videosProcessed: syncResult?.videosProcessed ?? 0,
      subscribed,
    };
  }

  async refreshChannel(channelId: string): Promise<ChannelSyncResult> {
    const trimmed = channelId.trim();
    const result = await this.syncChannelData(trimmed);
    return {
      channelId: result.channelId,
      playlistsProcessed: result.playlistsProcessed,
      videosProcessed: result.videosProcessed,
    };
  }

  private async syncChannelData(
    channelId: string,
  ): Promise<ChannelSyncResult & { customUrl: string | null }> {
    logger.info("Syncing YouTube channel metadata", { channelId });
    const channel = await this.youtubeDataApi.fetchChannelById(channelId);
    if (!channel) {
      logger.warn("Channel not found during sync", { channelId });
      throw new AppError("未找到对应的频道", {
        statusCode: 404,
        code: "CHANNEL_NOT_FOUND",
      });
    }

    logger.info("Fetched channel metadata from YouTube API", {
      channelId: channel.id,
      title: channel.title,
    });

    const now = new Date();
    const channelChanged = await this.hasResourceChanged("channel", channel.id, channel.etag);
    if (channelChanged) {
      await this.metadataService.upsertChannel({
        id: channel.id,
        title: channel.title,
        description: channel.description,
        customUrl: channel.customUrl,
        country: channel.country,
        publishedAt: parseDate(channel.publishedAt),
        thumbnailUrl: channel.thumbnailUrl,
        uploadsPlaylistId: channel.uploadsPlaylistId,
        lastSync: now,
      });

      await this.metadataService.upsertChannelStatistics({
        channelId: channel.id,
        subscriberCount: channel.subscriberCount,
        videoCount: channel.videoCount ?? null,
        viewCount: channel.viewCount,
        hiddenSubscriberCount: channel.hiddenSubscriberCount,
        lastUpdate: now,
      });

      await this.saveEtag("channel", channel.id, channel.etag, now);
    } else {
      logger.info("Channel etag unchanged, skipping metadata persistence", { channelId: channel.id });
    }

    const playlists = await this.youtubeDataApi.fetchPlaylistsByChannel(channel.id);
    logger.info("Fetched playlists for channel", {
      channelId: channel.id,
      playlistCount: playlists.length,
    });

    const videoPlaylistMap = new Map<string, string>();
    let playlistsProcessed = 0;

    for (const playlist of playlists) {
      const playlistChanged = await this.hasResourceChanged("playlist", playlist.id, playlist.etag);
      if (!playlistChanged) {
        logger.debug("Playlist etag unchanged, skipping sync", {
          channelId: channel.id,
          playlistId: playlist.id,
        });
        continue;
      }

      await this.metadataService.upsertPlaylist({
        id: playlist.id,
        channelId: playlist.channelId,
        title: playlist.title,
        description: playlist.description,
        itemCount: playlist.itemCount ?? null,
        publishedAt: parseDate(playlist.publishedAt),
        thumbnailUrl: playlist.thumbnailUrl,
        lastSync: now,
      });
      await this.saveEtag("playlist", playlist.id, playlist.etag, now);

      const playlistVideoIds = await this.youtubeDataApi.fetchPlaylistVideoIds(playlist.id);
      for (const videoId of playlistVideoIds) {
        if (!videoPlaylistMap.has(videoId)) {
          videoPlaylistMap.set(videoId, playlist.id);
        }
      }

      playlistsProcessed += 1;
    }

    let videosProcessed = 0;
    const videoIds = [...videoPlaylistMap.keys()];
    if (videoIds.length > 0) {
      const videos = await this.youtubeDataApi.fetchVideosByIds(videoIds);
      logger.info("Fetched videos for channel", {
        channelId: channel.id,
        videoCount: videos.length,
      });
      videosProcessed = await this.persistVideos(videos, videoPlaylistMap, now);
    } else {
      logger.info("No playlist changes detected, skipping video sync", {
        channelId: channel.id,
      });
    }

    logger.info("Finished channel sync", {
      channelId: channel.id,
      playlistCount: playlistsProcessed,
      videoCount: videosProcessed,
    });

    return {
      channelId: channel.id,
      playlistsProcessed,
      videosProcessed,
      customUrl: channel.customUrl ?? null,
    };
  }

  private async persistVideos(
    videos: YouTubeVideoDetails[],
    playlistMap: Map<string, string>,
    timestamp: Date,
  ): Promise<number> {
    let processed = 0;
    for (const video of videos) {
      const videoChanged = await this.hasResourceChanged("video", video.id, video.etag);
      if (!videoChanged) {
        logger.debug("Video etag unchanged, skipping sync", { videoId: video.id });
        continue;
      }

      await this.metadataService.upsertVideo({
        id: video.id,
        channelId: video.channelId,
        playlistId: playlistMap.get(video.id) ?? null,
        title: video.title,
        description: video.description,
        publishedAt: parseDate(video.publishedAt),
        duration: video.duration,
        dimension: video.dimension,
        definition: video.definition,
        caption: video.caption,
        licensedContent: video.licensedContent,
        thumbnailUrl: video.thumbnailUrl,
        tags: video.tags.length > 0 ? video.tags : null,
        defaultLanguage: video.defaultLanguage,
        defaultAudioLanguage: video.defaultAudioLanguage,
        privacyStatus: video.privacyStatus,
        lastSync: timestamp,
      });

      await this.metadataService.upsertVideoStatistics({
        videoId: video.id,
        viewCount: video.statistics.viewCount,
        likeCount: video.statistics.likeCount,
        favoriteCount: video.statistics.favoriteCount,
        commentCount: video.statistics.commentCount,
        lastUpdate: timestamp,
      });

      await this.saveEtag("video", video.id, video.etag, timestamp);
      processed += 1;
    }

    return processed;
  }

  private async hasResourceChanged(
    resourceType: YouTubeResourceType,
    resourceId: string,
    latestEtag: string | null,
  ): Promise<boolean> {
    if (!latestEtag) {
      return true;
    }

    const existing = await this.metadataService.getEtag(resourceType, resourceId);
    return existing?.etag !== latestEtag;
  }

  private async saveEtag(
    resourceType: YouTubeResourceType,
    resourceId: string,
    etag: string | null,
    timestamp: Date,
  ): Promise<void> {
    await this.metadataService.upsertEtag({
      resourceType,
      resourceId,
      etag: etag ?? null,
      lastChecked: timestamp,
    });
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
