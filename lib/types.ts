export interface MediaItem {
  id: string;
  title: string;
  poster: string;
  backdrop?: string;
  status?: string;
  rating?: number;
  year?: string;
  category?: string;
  description?: string;
  source?: string;
  sourceName?: string;
}

export interface MediaSourceInfo {
  key: string;
  name: string;
  baseUrl?: string;
  description?: string;
}

export interface Episode {
  id: string;
  title: string;
  number: number;
  duration?: string;
  thumbnail?: string;
}

export interface MediaDetail extends MediaItem {
  episodes: Episode[];
  tags?: string[];
  actors?: string[];
  director?: string;
  releaseDate?: string;
}

export interface MediaCategory {
  id: string;
  title: string;
  items: MediaItem[];
}

export interface StreamResolution {
  streamUrl: string;
  fallbackProxyUrl?: string;
  headers?: Record<string, string>;
  format?: 'hls' | 'mp4';
}

export interface WatchHistoryItem {
  mediaId: string;
  mediaTitle: string;
  poster: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}
