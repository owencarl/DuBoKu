import { BaseMediaProvider } from './baseProvider';
import { Episode, MediaCategory, MediaDetail, MediaItem, StreamResolution } from '../types';

export interface MacCmsApiConfig {
  key: string;
  name: string;
  apiUrl: string;
  fallbackApiUrl?: string;
  description?: string;
  categoryMap?: Array<{ id: string; title: string; typeId?: string }>;
}

interface DetailCacheEntry {
  item: MediaDetail;
  streamUrls: string[];
  expiresAt: number;
}

/**
 * Universal MacCMS V10 Standard JSON API Provider.
 * Connects directly to MacCMS V10 collection APIs (?ac=detail, ?ac=list, ?ac=detail&wd=...).
 * High speed, structured data, direct HLS streams with CORS support, and zero serverless proxy overhead.
 */
export class MacCmsApiProvider implements BaseMediaProvider {
  public readonly key: string;
  public readonly name: string;
  protected apiUrl: string;
  protected fallbackApiUrl?: string;
  protected config: MacCmsApiConfig;
  private cache = new Map<string, DetailCacheEntry>();

  constructor(config: MacCmsApiConfig) {
    this.config = config;
    this.key = config.key;
    this.name = config.name;
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.fallbackApiUrl = config.fallbackApiUrl?.replace(/\/$/, '');
  }

  /**
   * Safe fetch with standard browser headers and timeout
   */
  protected async fetchApi(params: string, timeoutMs: number = 8000): Promise<any> {
    const urls = [
      `${this.apiUrl}?${params}`,
      ...(this.fallbackApiUrl ? [`${this.fallbackApiUrl}?${params}`] : []),
    ];

    let lastError: Error | null = null;
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
          },
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`[${this.name}] HTTP ${res.status} from ${url}`);
        }

        const data = await res.json();
        return data;
      } catch (err: any) {
        lastError = err;
        console.warn(`[${this.name}] Fetch failed for ${url}:`, err.message);
      }
    }

    throw lastError || new Error(`[${this.name}] Failed to fetch from API endpoints`);
  }

  /**
   * Search media by keyword across MacCMS V10 API
   */
  public async search(query: string): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q) return [];

    try {
      const data = await this.fetchApi(`ac=detail&wd=${encodeURIComponent(q)}`);
      if (!data.list || !Array.isArray(data.list)) return [];

      return data.list.map((it: any) => this.mapMediaItem(it));
    } catch (err: any) {
      console.warn(`[${this.name}] Search error for "${q}":`, err.message);
      return [];
    }
  }

  /**
   * Get dashboard featured categories
   */
  public async getFeatured(): Promise<MediaCategory[]> {
    const defaultCategories = this.config.categoryMap || [
      { id: 'hot', title: '🔥 今日热播', typeId: '' },
      { id: 'c-drama', title: '🎋 华语剧集', typeId: '20' },
      { id: 'k-drama', title: '🌸 日韩剧集', typeId: '5' },
      { id: 'movies', title: '🎬 院线电影', typeId: '9' },
      { id: 'anime', title: '⚡ 人气动漫', typeId: '24' },
      { id: 'variety', title: '🎉 热门综艺', typeId: '30' },
    ];

    const results = await Promise.allSettled(
      defaultCategories.map(async (c) => {
        const query = c.typeId ? `ac=detail&t=${c.typeId}` : `ac=detail`;
        const data = await this.fetchApi(query, 7000);
        const items = (data.list || []).map((it: any) => this.mapMediaItem(it));
        return {
          id: `${this.key}-cat-${c.id}`,
          title: c.title,
          items,
        };
      })
    );

    const categories: MediaCategory[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.items.length > 0) {
        categories.push(res.value);
      }
    }

    return categories;
  }

  /**
   * Get full details and episode listing for a media item
   */
  public async getDetails(id: string): Promise<MediaDetail> {
    const cleanId = id.replace(new RegExp(`^${this.key}:`), '');

    // Check memory cache
    const cached = this.cache.get(cleanId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.item;
    }

    const data = await this.fetchApi(`ac=detail&ids=${encodeURIComponent(cleanId)}`);
    const raw = data.list?.[0];
    if (!raw) {
      throw new Error(`[${this.name}] Media not found for ID: ${id}`);
    }

    // Select the best stream group (prefer group containing .m3u8)
    const urlGroups = (raw.vod_play_url || '').split('$$$');
    const selectedGroup = urlGroups.find((g: string) => g.includes('.m3u8')) || urlGroups[0] || '';

    const streamUrls: string[] = [];
    const episodes: Episode[] = [];

    if (selectedGroup) {
      const epStrings = selectedGroup.split('#').filter(Boolean);
      epStrings.forEach((epStr: string, idx: number) => {
        const parts = epStr.split('$');
        const title = parts[0]?.trim() || `第${idx + 1}集`;
        const url = parts[1]?.trim() || '';
        streamUrls.push(url);
        episodes.push({
          id: `${this.key}:${cleanId}-${idx}`,
          title,
          number: idx + 1,
        });
      });
    }

    const item: MediaDetail = {
      ...this.mapMediaItem(raw),
      episodes,
      actors: raw.vod_actor
        ? raw.vod_actor
            .split(/[,，/]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
      director: raw.vod_director?.trim() || undefined,
      releaseDate: raw.vod_year?.trim() || undefined,
      tags: [raw.type_name, raw.vod_area, raw.vod_year].filter(Boolean),
    };

    // Cache for 5 minutes
    this.cache.set(cleanId, {
      item,
      streamUrls,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return item;
  }

  /**
   * Resolve episode ID to playable HLS stream
   */
  public async resolveStreamUrl(episodeId: string): Promise<StreamResolution> {
    const cleanId = episodeId.replace(new RegExp(`^${this.key}:`), '');
    const [vodId, indexStr] = cleanId.split('-');
    const epIndex = parseInt(indexStr || '0', 10);

    let streamUrl = '';
    const cached = this.cache.get(vodId);
    if (cached && cached.streamUrls && cached.streamUrls[epIndex]) {
      streamUrl = cached.streamUrls[epIndex];
    } else {
      await this.getDetails(vodId);
      const reCached = this.cache.get(vodId);
      if (reCached && reCached.streamUrls && reCached.streamUrls[epIndex]) {
        streamUrl = reCached.streamUrls[epIndex];
      }
    }

    if (!streamUrl) {
      throw new Error(`[${this.name}] Could not resolve stream URL for episode: ${episodeId}`);
    }

    const defaultProxy = 'https://duboku-proxy.liukun-tju.workers.dev';
    let externalProxy =
      process.env.STREAM_PROXY_URL ||
      process.env.NEXT_PUBLIC_STREAM_PROXY_URL ||
      defaultProxy;

    if (
      externalProxy &&
      (externalProxy.includes('yourname') || externalProxy.includes('example') || !externalProxy.startsWith('http'))
    ) {
      externalProxy = defaultProxy;
    }

    // Direct HLS stream with zero-bandwidth Cloudflare Worker fallback
    const fallbackProxyUrl = externalProxy
      ? `${externalProxy.replace(/\/$/, '')}${externalProxy.includes('?') ? '&' : '/?'}url=${encodeURIComponent(streamUrl)}`
      : `/api/proxy?url=${encodeURIComponent(streamUrl)}`;

    return {
      streamUrl,
      fallbackProxyUrl,
      headers: {},
      format: 'hls',
    };
  }

  /**
   * Map MacCMS API item to StreamPulse MediaItem format
   */
  protected mapMediaItem(it: any): MediaItem {
    let desc = it.vod_blurb || '';
    if (!desc && it.vod_content) {
      desc = it.vod_content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    return {
      id: `${this.key}:${it.vod_id}`,
      title: it.vod_name?.trim() || 'Untitled',
      poster: this.normalizeUrl(it.vod_pic),
      backdrop: this.normalizeUrl(it.vod_pic),
      status: it.vod_remarks || '',
      year: it.vod_year ? String(it.vod_year) : '',
      category: it.type_name || '',
      description: desc,
      source: this.key,
      sourceName: this.name,
    };
  }

  /**
   * Normalize image URLs
   */
  protected normalizeUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    return url;
  }
}
