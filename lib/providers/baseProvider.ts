import { MediaCategory, MediaDetail, MediaItem, StreamResolution } from '../types';

export interface BaseMediaProvider {
  /**
   * Search for media by query string
   */
  search(query: string): Promise<MediaItem[]>;

  /**
   * Get home/featured categories for the dashboard
   */
  getFeatured(): Promise<MediaCategory[]>;

  /**
   * Get full details and episode listing for a specific media item
   */
  getDetails(id: string): Promise<MediaDetail>;

  /**
   * Resolve an episode ID into a playable HLS (.m3u8) or MP4 stream URL
   */
  resolveStreamUrl(episodeId: string): Promise<StreamResolution>;
}

