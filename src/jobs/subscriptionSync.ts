import { subscribedChannelService, youtubeSubscriptionService } from "../services";
import { logger } from "../utils/logger";

function msUntilNextMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return Math.max(next.getTime() - now.getTime(), 1_000);
}

let scheduledTimer: NodeJS.Timeout | null = null;
let scheduling = false;

export async function runSubscribedChannelsSyncOnce(): Promise<void> {
  const channelIds = await subscribedChannelService.listDistinctChannelIds();
  logger.info("[subscription-sync] Starting run", { channelCount: channelIds.length });

  if (channelIds.length === 0) {
    logger.info("[subscription-sync] No subscribed channels found, skipping run");
    return;
  }

  let processed = 0;
  let playlistsUpdated = 0;
  let videosUpdated = 0;

  for (const channelId of channelIds) {
    try {
      const result = await youtubeSubscriptionService.refreshChannel(channelId);
      processed += 1;
      playlistsUpdated += result.playlistsProcessed;
      videosUpdated += result.videosProcessed;
      logger.info("[subscription-sync] Channel refreshed", {
        channelId: result.channelId,
        playlistsProcessed: result.playlistsProcessed,
        videosProcessed: result.videosProcessed,
      });
    } catch (error) {
      logger.error("[subscription-sync] Failed to refresh channel", {
        channelId,
        err: error,
      });
    }
  }

  logger.info("[subscription-sync] Run finished", {
    processedChannels: processed,
    totalPlaylistsProcessed: playlistsUpdated,
    totalVideosProcessed: videosUpdated,
  });
}

function scheduleNextRun(): void {
  const delay = msUntilNextMidnight();
  logger.info("[subscription-sync] Next run scheduled", { delayMs: delay });
  scheduledTimer = setTimeout(async () => {
    scheduledTimer = null;
    try {
      await runSubscribedChannelsSyncOnce();
    } catch (error) {
      logger.error("[subscription-sync] Scheduled run failed", { err: error });
    } finally {
      scheduleNextRun();
    }
  }, delay);
}

export function scheduleSubscribedChannelSyncJob(): void {
  if (scheduling) {
    return;
  }

  scheduling = true;
  scheduleNextRun();
}
