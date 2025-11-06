import { config } from "../config/env";
import { pool } from "../database/pool";
import { spotlightChannelService, youtubeDataApi } from "../services";
import { configureProxyFromEnv, disableProxy } from "../utils/proxy";

interface FallbackChannel {
  channelId: string;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  totalViews: string | null;
  totalSubscribers: string | null;
}

const FALLBACK_CHANNELS: Record<string, FallbackChannel> = {
  ndwtb: {
    channelId: "NDWTB",
    title: "NDWTB",
    description: "Spotlight placeholder for NDWTB – update via sync worker when network is available.",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("NDWTB")}&background=3F51B5&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  xiao_lin_shuo: {
    channelId: "xiao_lin_shuo",
    title: "小林说",
    description: "小林说的精选频道占位数据，等待定时任务更新。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("小林说")}&background=009688&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  mrbeast: {
    channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA",
    title: "MrBeast",
    description: "MrBeast 的官方频道。后续同步会替换此占位信息。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("MrBeast")}&background=E91E63&color=fff`,
    totalViews: "29000000000",
    totalSubscribers: "250000000",
  },
  hellobailu: {
    channelId: "hellobailu",
    title: "Hello Bailu",
    description: "Hello Bailu Spotlight 占位数据。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("Hello+Bailu")}&background=FF9800&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  leisadventure: {
    channelId: "leisadventure",
    title: "Lei's Adventure",
    description: "Lei's Adventure 频道占位数据，等待同步 YouTube API。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("Lei")}&background=8BC34A&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  cleoabram: {
    channelId: "cleoabram",
    title: "Cleo Abram",
    description: "Cleo Abram Spotlight 占位数据。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("Cleo+A")}&background=00BCD4&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  anzhengming: {
    channelId: "anzhengming",
    title: "安正明",
    description: "安正明频道占位数据。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("安正明")}&background=9C27B0&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  maxbookclub: {
    channelId: "maxbookclub",
    title: "Max Book Club",
    description: "Max Book Club Spotlight 占位数据。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("Max+Book")}&background=607D8B&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  laogao: {
    channelId: "laogao",
    title: "老高",
    description: "老高频道 Spotlight 占位数据。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("老高")}&background=673AB7&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
  "达叔的财智日记": {
    channelId: "达叔的财智日记",
    title: "达叔的财智日记",
    description: "达叔的财智日记 Spotlight 占位数据。",
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent("达叔")}&background=795548&color=fff`,
    totalViews: "0",
    totalSubscribers: "0",
  },
};

async function syncSpotlightChannels(): Promise<void> {
  const handles = config.spotlight.handles;
  if (handles.length === 0) {
    console.warn(
      "No spotlight handles configured. Set SPOTLIGHT_CHANNEL_HANDLES to enable syncing.",
    );
    return;
  }

  for (const [index, handle] of handles.entries()) {
    const normalizedHandle = handle.toLowerCase();
    try {
      console.log(`Syncing spotlight channel for handle: ${handle}`);
      const details = await youtubeDataApi.fetchChannelByHandle(handle);

      if (!details) {
        console.warn(`No channel found for handle ${handle}`);
        const fallback = FALLBACK_CHANNELS[normalizedHandle];
        if (fallback) {
          await persistFallback(handle, fallback, index + 1);
        }
        continue;
      }

      await spotlightChannelService.upsertChannel({
        handle,
        channelId: details.id,
        title: details.title,
        description: details.description,
        avatarUrl: details.avatarUrl,
        totalViews: details.viewCount,
        totalSubscribers: details.subscriberCount,
        lastSyncedAt: new Date(),
        orderIndex: index + 1,
      });

      console.log(`Synced channel ${details.title} (${details.id})`);
    } catch (error) {
      console.error(`Failed to sync handle ${handle}:`, error);
      const fallback = FALLBACK_CHANNELS[normalizedHandle];
      if (fallback) {
        await persistFallback(handle, fallback, index + 1);
      }
    }
  }

  await spotlightChannelService.deactivateMissingHandles(handles);
}

async function persistFallback(
  handle: string,
  fallback: FallbackChannel,
  orderIndex: number,
): Promise<void> {
  console.warn(`Using fallback data for handle ${handle}`);
  await spotlightChannelService.upsertChannel({
    handle,
    channelId: fallback.channelId,
    title: fallback.title,
    description: fallback.description,
    avatarUrl: fallback.avatarUrl,
    totalViews: fallback.totalViews,
    totalSubscribers: fallback.totalSubscribers,
    lastSyncedAt: new Date(0),
    orderIndex,
  });
}

async function main(): Promise<void> {
  const proxyEnabled = configureProxyFromEnv();
  try {
    if (proxyEnabled) {
      console.log("[proxy] Enabled fetch proxy for spotlight sync worker");
    }

    await syncSpotlightChannels();
  } finally {
    await pool.end();
    disableProxy();
  }
}

main().catch((error) => {
  console.error("Sync job failed", error);
  process.exitCode = 1;
});
