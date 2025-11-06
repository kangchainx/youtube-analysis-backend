export interface SpotlightChannel {
  id: string;
  handle: string;
  channelId: string | null;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  totalViews: number | null;
  totalSubscribers: number | null;
  order: number | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
