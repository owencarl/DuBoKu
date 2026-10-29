import { BaseMediaProvider } from './baseProvider';
import { DbkuProvider } from './dbkuProvider';
import { MacCmsHtmlProvider } from './macCmsProvider';
import { MacCmsApiProvider } from './macCmsApiProvider';
import { LibvioProvider } from './libvioProvider';
import { MockMediaProvider } from './mockProvider';
import { MediaItem, MediaSourceInfo } from '../types';

interface ProviderEntry {
  key: string;
  name: string;
  provider: BaseMediaProvider;
  baseUrl?: string;
  description?: string;
  isDefault?: boolean;
}

class ProviderRegistry {
  private providers = new Map<string, ProviderEntry>();
  private defaultKey: string = 'dbku';

  constructor() {
    this.initDefaultProviders();
  }

  private initDefaultProviders() {
    // 1. Primary Source: 独播库 (DuBoKu)
    const dbku = new DbkuProvider();
    this.register({
      key: 'dbku',
      name: '独播库',
      provider: dbku,
      baseUrl: 'https://www.dbku.tv',
      description: '热门陆剧、日韩剧、华语电影、综艺动漫',
      isDefault: true,
    });

    // 2. Secondary Source: 剧迷 (Gimy) - High-Speed MacCMS V10 API Engine
    const gimy = new MacCmsApiProvider({
      key: 'gimy',
      name: '剧迷 (极速源)',
      apiUrl: process.env.GIMY_API_URL || 'https://hhzyapi.com/api.php/provide/vod/',
      fallbackApiUrl: 'https://lzizy1.com/api.php/provide/vod/',
      description: '免解析秒播直连，海量电视剧、院线电影与动漫',
    });
    this.register({
      key: 'gimy',
      name: '剧迷 (极速源)',
      provider: gimy,
      baseUrl: 'https://hhzyapi.com',
      description: '免解析秒播直连，海量电视剧、院线电影与动漫',
    });

    // 3. Tertiary Source: LIBVIO (利博影视)
    const libvio = new LibvioProvider({
      key: 'libvio',
      name: 'LIBVIO (利博影视)',
      baseUrl: process.env.LIBVIO_BASE_URL || 'https://www.libvio.lat',
      fallbackUrls: [
        'https://www.libvio.lat',
        'https://libvio.host',
        'https://libvio.app',
        'https://libvio.pw',
      ],
      description: '热门华语影视、高清欧美日韩剧集与动漫',
    });
    this.register({
      key: 'libvio',
      name: 'LIBVIO (利博影视)',
      provider: libvio,
      baseUrl: 'https://www.libvio.lat',
      description: '热门华语影视、高清欧美日韩剧集与动漫',
    });
  }

  private mockProvider = new MockMediaProvider();

  public register(entry: ProviderEntry) {
    this.providers.set(entry.key, entry);
    if (entry.isDefault) {
      this.defaultKey = entry.key;
    }
  }

  public getProvider(key?: string): BaseMediaProvider {
    if (!key) {
      return this.providers.get(this.defaultKey)!.provider;
    }
    if (key === 'mock') {
      return this.mockProvider;
    }
    const entry = this.providers.get(key);
    if (entry) {
      return entry.provider;
    }
    // Fallback to default provider if unrecognized key
    return this.providers.get(this.defaultKey)!.provider;
  }

  public getProviderInfo(key?: string): MediaSourceInfo | null {
    const targetKey = key || this.defaultKey;
    const entry = this.providers.get(targetKey);
    if (!entry) return null;
    return {
      key: entry.key,
      name: entry.name,
      baseUrl: entry.baseUrl,
      description: entry.description,
    };
  }

  public getProviderList(): MediaSourceInfo[] {
    return Array.from(this.providers.values()).map((p) => ({
      key: p.key,
      name: p.name,
      baseUrl: p.baseUrl,
      description: p.description,
    }));
  }

  /**
   * Helper to parse namespaced ID (e.g. 'dbku:1234' -> { sourceKey: 'dbku', rawId: '1234' })
   */
  public parseSourceAndId(idOrEpisodeId: string, fallbackSource?: string): { sourceKey: string; rawId: string } {
    if (idOrEpisodeId.includes(':')) {
      const parts = idOrEpisodeId.split(':');
      const prefix = parts[0];
      if (this.providers.has(prefix)) {
        return {
          sourceKey: prefix,
          rawId: parts.slice(1).join(':'),
        };
      }
    }
    return {
      sourceKey: fallbackSource || this.defaultKey,
      rawId: idOrEpisodeId,
    };
  }

  /**
   * Run parallel aggregated search across all registered providers
   */
  public async searchAll(query: string, timeoutMs: number = 8000): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q) return [];

    const providerList = Array.from(this.providers.values());

    const searchPromises = providerList.map(async (entry) => {
      try {
        const timeoutPromise = new Promise<MediaItem[]>((_, reject) =>
          setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
        );
        const searchPromise = entry.provider.search(q);
        const items = await Promise.race([searchPromise, timeoutPromise]);
        return items.map((item) => ({
          ...item,
          source: entry.key,
          sourceName: entry.name,
        }));
      } catch (err: any) {
        console.warn(`[Registry] Search failed on provider "${entry.name}":`, err.message);
        return [] as MediaItem[];
      }
    });

    const settledResults = await Promise.allSettled(searchPromises);
    const aggregated: MediaItem[] = [];

    for (const res of settledResults) {
      if (res.status === 'fulfilled') {
        aggregated.push(...res.value);
      }
    }

    return aggregated;
  }
}

export const providerRegistry = new ProviderRegistry();
