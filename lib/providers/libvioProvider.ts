import * as cheerio from 'cheerio';
import * as vm from 'vm';
import { BaseMediaProvider } from './baseProvider';
import { Episode, MediaCategory, MediaDetail, MediaItem, StreamResolution } from '../types';

export interface LibvioConfig {
  key?: string;
  name?: string;
  baseUrl?: string;
  fallbackUrls?: string[];
  description?: string;
}

/**
 * High-Performance Provider for LIBVIO (利博影视) https://www.libvio.lat
 * Built on MacCMS with STUI template and Artplayer smartplay client-side encryption.
 */
export class LibvioProvider implements BaseMediaProvider {
  public readonly key: string;
  public readonly name: string;
  protected baseUrl: string;
  protected fallbackUrls: string[];
  private cryptoJsCache: string | null = null;

  constructor(config?: LibvioConfig) {
    this.key = config?.key || 'libvio';
    this.name = config?.name || 'LIBVIO (利博影视)';
    this.baseUrl = (config?.baseUrl || 'https://www.libvio.lat').replace(/\/$/, '');
    this.fallbackUrls = config?.fallbackUrls || [
      'https://www.libvio.lat',
      'https://libvio.host',
      'https://libvio.app',
      'https://www.libvio.pw',
    ];
  }

  /**
   * Helper to strip source key prefix (e.g. 'libvio:5813826' -> '5813826')
   */
  protected stripPrefix(id: string): string {
    if (id.startsWith(`${this.key}:`)) {
      return id.slice(this.key.length + 1);
    }
    return id;
  }

  /**
   * Helper to format an ID with source prefix (e.g. '5813826' -> 'libvio:5813826')
   */
  protected formatId(id: string): string {
    if (id.startsWith(`${this.key}:`)) {
      return id;
    }
    return `${this.key}:${id}`;
  }

  /**
   * Fetch HTML with automatic base URL failover and browser headers
   */
  protected async fetchHtml(pathOrUrl: string, customReferer?: string): Promise<string> {
    const isFullUrl = pathOrUrl.startsWith('http');
    const path = isFullUrl ? null : pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    const candidateBases = Array.from(new Set([this.baseUrl, ...this.fallbackUrls]));

    let lastError: Error | null = null;
    for (const base of candidateBases) {
      const cleanBase = base.replace(/\/$/, '');
      const targetUrl = isFullUrl ? pathOrUrl : `${cleanBase}${path}`;
      try {
        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          Referer: customReferer || `${cleanBase}/`,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(targetUrl, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`[${this.name}] HTTP ${res.status} from ${targetUrl}`);
        }
        return await res.text();
      } catch (err: any) {
        lastError = err;
        console.warn(`[${this.name}] Fetch failed on ${targetUrl}:`, err.message);
        if (isFullUrl) break;
      }
    }

    throw lastError || new Error(`[${this.name}] Failed to fetch ${pathOrUrl}`);
  }

  /**
   * Helper to normalize relative or protocol-relative image/page URLs
   */
  protected normalizeUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    return `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  /**
   * Helper to extract clean numeric or slug ID from detail href
   * /detail/5813826.html -> "5813826"
   */
  protected extractDetailId(href: string): string {
    if (!href) return '';
    const match = href.match(/\/detail\/([^/.]+?)(?:\.html)?(?:$|[?#])/i);
    if (match && match[1]) {
      return match[1];
    }
    return encodeURIComponent(href.replace(/^\//, '').replace(/\.html$/, ''));
  }

  /**
   * Retrieve and cache crypto-js for Artplayer smartplay decryption
   */
  private async getCryptoJs(): Promise<string> {
    if (this.cryptoJsCache) return this.cryptoJsCache;
    try {
      const res = await fetch(`${this.baseUrl}/static/player/artplayer/crypto-js.min.js`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Referer: `${this.baseUrl}/`,
        },
      });
      if (res.ok) {
        this.cryptoJsCache = await res.text();
        return this.cryptoJsCache;
      }
    } catch (e: any) {
      console.warn(`[${this.name}] Failed to fetch crypto-js from ${this.baseUrl}:`, e.message);
    }
    return '';
  }

  /**
   * 1. Get Homepage Featured Categories
   */
  async getFeatured(): Promise<MediaCategory[]> {
    const html = await this.fetchHtml('/');
    const $ = cheerio.load(html);
    const categories: MediaCategory[] = [];

    // Parse each category container on the LIBVIO homepage
    $('ul.stui-vodlist').each((idx, ul) => {
      let title = $(ul).prev('.stui-vodlist__head').find('h3').text().trim();
      if (!title && idx === 0) {
        title = '今日热播';
      }
      title = title.replace(/\s+/g, ' ').trim();
      if (!title || title.includes('专题')) return;

      const items: MediaItem[] = [];
      $(ul)
        .find('li')
        .each((_, li) => {
          const thumb = $(li).find('.stui-vodlist__thumb, a').first();
          const href = thumb.attr('href');
          const itemTitle = thumb.attr('title') || $(li).find('.title a, h4 a').text().trim();
          const posterRaw = thumb.attr('data-original') || thumb.attr('src') || $(li).find('img').attr('src');
          const status = $(li).find('.pic-text').text().trim();

          if (href && itemTitle) {
            const rawId = this.extractDetailId(href);
            const poster = this.normalizeUrl(posterRaw);
            items.push({
              id: this.formatId(rawId),
              title: itemTitle,
              poster,
              backdrop: poster,
              status: status || undefined,
              category: title,
              source: this.key,
              sourceName: this.name,
            });
          }
        });

      if (items.length > 0) {
        categories.push({
          id: `libvio-cat-${idx}-${encodeURIComponent(title)}`,
          title,
          items,
        });
      }
    });

    return categories;
  }

  /**
   * 2. Search Catalog
   */
  async search(query: string): Promise<MediaItem[]> {
    const q = query.trim();
    if (!q) return [];

    const searchUrl = `/search/${encodeURIComponent(q)}-------------.html`;
    const results: MediaItem[] = [];

    try {
      const html = await this.fetchHtml(searchUrl);
      const $ = cheerio.load(html);

      $('ul.stui-vodlist li').each((_, li) => {
        const thumb = $(li).find('.stui-vodlist__thumb, a').first();
        const href = thumb.attr('href') || $(li).find('a').first().attr('href');
        const title =
          thumb.attr('title') ||
          $(li).find('.title a, h4 a, .title').first().text().trim() ||
          $(li).find('a').first().attr('title');
        const rawPoster = thumb.attr('data-original') || thumb.attr('src') || $(li).find('img').attr('src') || '';
        const status = $(li).find('.pic-text').text().trim();

        if (href && title && href.includes('/detail/')) {
          const rawId = this.extractDetailId(href);
          const poster = this.normalizeUrl(rawPoster);
          results.push({
            id: this.formatId(rawId),
            title: title.trim(),
            poster,
            backdrop: poster,
            status: status || undefined,
            source: this.key,
            sourceName: this.name,
          });
        }
      });
    } catch (err: any) {
      console.warn(`[${this.name}] HTML search failed for "${q}":`, err.message);
    }

    // Fallback: If no results found, try the fast ajax suggest endpoint
    if (results.length === 0) {
      try {
        const suggestUrl = `/index.php/ajax/suggest?mid=1&wd=${encodeURIComponent(q)}`;
        const jsonText = await this.fetchHtml(suggestUrl);
        const data = JSON.parse(jsonText);
        if (data.list && Array.isArray(data.list)) {
          for (const item of data.list) {
            const rawId = String(item.id);
            const poster = this.normalizeUrl(item.pic);
            results.push({
              id: this.formatId(rawId),
              title: item.name,
              poster,
              backdrop: poster,
              source: this.key,
              sourceName: this.name,
            });
          }
        }
      } catch (e: any) {
        console.warn(`[${this.name}] Suggest search failed:`, e.message);
      }
    }

    return results;
  }

  /**
   * 3. Get Media Details & Episode List
   */
  async getDetails(id: string): Promise<MediaDetail> {
    const rawId = this.stripPrefix(id);
    const decodedId = decodeURIComponent(rawId);
    const detailPath = decodedId.startsWith('/') ? decodedId : `/detail/${decodedId}.html`;

    const html = await this.fetchHtml(detailPath);
    const $ = cheerio.load(html);

    const title =
      $('.stui-content__detail .title, h1, .title')
        .first()
        .text()
        .trim() || '未知影视';

    const thumbImg = $('.stui-content__thumb img, .picture img, img.lazyload').first();
    const rawPoster = thumbImg.attr('data-original') || thumbImg.attr('data-src') || thumbImg.attr('src') || '';
    const poster = this.normalizeUrl(rawPoster);

    const status = $('.stui-content__thumb .pic-text, .pic-text').first().text().trim() || undefined;
    const scoreText = $('.stui-content__detail .score, .score').first().text().trim();
    const rating = parseFloat(scoreText);

    const description =
      $('.stui-content__desc, .desc .data, .detail .desc').first().text().trim() ||
      '';

    let category: string | undefined;
    let year: string | undefined;
    let director: string | undefined;
    const actors: string[] = [];
    const tags: string[] = [];

    $('.stui-content__detail p.data, p.data').each((_, p) => {
      const text = $(p).text();
      if (text.includes('类型：') || text.includes('分类：')) {
        $(p)
          .find('a')
          .each((__, a) => {
            const val = $(a).text().trim();
            if (val) tags.push(val);
          });
        if (tags.length > 0 && !category) category = tags[0];
      }
      if (text.includes('地区：')) {
        const area = text.split('地区：')[1]?.split(' ')[0]?.trim();
        if (area && !tags.includes(area)) tags.push(area);
      }
      if (text.includes('年份：')) {
        const yearMatch = text.match(/年份：\s*(\d{4})/);
        if (yearMatch) year = yearMatch[1];
      }
      if (text.includes('主演：')) {
        $(p)
          .find('a')
          .each((__, a) => {
            const actor = $(a).text().trim();
            if (actor && actor !== '未知') actors.push(actor);
          });
      }
      if (text.includes('导演：')) {
        const dirs: string[] = [];
        $(p)
          .find('a')
          .each((__, a) => {
            const d = $(a).text().trim();
            if (d && d !== '未知') dirs.push(d);
          });
        if (dirs.length > 0) director = dirs.join(', ');
      }
    });

    // Extract playlists and prioritize online streaming lines over netdisk download lines
    const tabNames: string[] = [];
    $('.stui-pannel__head h3, .stui-vodlist__head h3, .nav-tabs li').each((_, el) => {
      const t = $(el).text().trim();
      if (t) tabNames.push(t);
    });

    interface CandidatePlaylist {
      tabName: string;
      isNetdisk: boolean;
      links: { title: string; href: string }[];
    }

    const playlists: CandidatePlaylist[] = [];
    $('.stui-content__playlist').each((idx, pl) => {
      const links: { title: string; href: string }[] = [];
      $(pl)
        .find('li a')
        .each((_, a) => {
          const epTitle = $(a).text().trim();
          const epHref = $(a).attr('href') || '';
          if (epHref.includes('/play/')) {
            links.push({ title: epTitle, href: epHref });
          }
        });

      const tabName = tabNames[idx] || `线路 ${idx + 1}`;
      const isNetdisk = /网盘|夸克|百度|UC|阿里|下载/i.test(tabName);
      if (links.length > 0) {
        playlists.push({ tabName, isNetdisk, links });
      }
    });

    // Pick best playlist: first online (non-netdisk) playlist with most episodes
    let chosenPlaylist = playlists.find((p) => !p.isNetdisk);
    if (!chosenPlaylist && playlists.length > 0) {
      chosenPlaylist = playlists[0];
    }

    const episodes: Episode[] = [];
    if (chosenPlaylist) {
      chosenPlaylist.links.forEach((link, idx) => {
        const epMatch = link.href.match(/\/play\/([^/.]+)\.html/i);
        const epRawId = epMatch && epMatch[1] ? epMatch[1] : link.href.replace(/^\//, '').replace(/\.html$/, '');
        episodes.push({
          id: this.formatId(epRawId),
          title: link.title || `第 ${idx + 1} 集`,
          number: idx + 1,
        });
      });
    }

    return {
      id: this.formatId(rawId),
      title,
      poster,
      backdrop: poster,
      status,
      rating: !isNaN(rating) ? rating : undefined,
      year,
      category,
      description,
      episodes,
      tags: tags.length > 0 ? tags : undefined,
      actors: actors.length > 0 ? actors : undefined,
      director,
      releaseDate: year,
      source: this.key,
      sourceName: this.name,
    };
  }

  /**
   * 4. Extract Playable Stream URL from LIBVIO Player Page
   */
  async resolveStreamUrl(episodeId: string): Promise<StreamResolution> {
    const rawEpId = this.stripPrefix(episodeId);
    const decodedEpId = decodeURIComponent(rawEpId);
    const playPath = decodedEpId.startsWith('/') ? decodedEpId : `/play/${decodedEpId}.html`;

    console.log(`[${this.name}] Fetching play page: ${playPath}`);
    const playPageUrl = `${this.baseUrl}${playPath.startsWith('/') ? '' : '/'}${playPath}`;
    const html = await this.fetchHtml(playPath);

    // Extract player_aaaa JSON
    const match =
      html.match(/var\s+(?:player_aaaa|player_data|player_[a-zA-Z0-9_]+)\s*=\s*(\{[\s\S]*?\})(?:;|\s*<|\s*\n)/i) ||
      html.match(/var\s+(?:player_aaaa|player_data|player_[a-zA-Z0-9_]+)\s*=\s*(\{[\s\S]*?\})/i);

    if (!match || !match[1]) {
      throw new Error(`[${this.name}] Could not locate player configuration in ${playPath}`);
    }

    let playerData: any = null;
    try {
      playerData = JSON.parse(match[1]);
    } catch (e: any) {
      throw new Error(`[${this.name}] Failed to parse player JSON: ${e.message}`);
    }

    // Check if this line is a netdisk link
    if (playerData.from === 'quark' || playerData.from === 'baidu' || playerData.from === 'ucpan') {
      throw new Error(`该线路为网盘资源 (${playerData.from})，请切换至在线播放线路 (HD/1080P)`);
    }

    let resolvedUrl: string | null = null;

    // 1. Direct stream check
    if (
      playerData.url &&
      (playerData.url.startsWith('http://') || playerData.url.startsWith('https://')) &&
      (playerData.url.includes('.m3u8') || playerData.url.includes('.mp4'))
    ) {
      resolvedUrl = playerData.url;
    }

    // 2. Artplayer client-side decryption using lightweight VM sandbox
    if (!resolvedUrl && playerData.url) {
      const artplayerUrl = `${this.baseUrl}/static/player/artplayer/?url=${playerData.url}`;
      resolvedUrl = await this.resolveArtplayerStream(artplayerUrl, playPageUrl);
    }

    if (!resolvedUrl) {
      throw new Error(`[${this.name}] Unable to resolve playable stream URL for ${playPath}`);
    }

    // Normalize relative stream URLs (e.g. /video_m3u8/secure.php?skey=...)
    if (resolvedUrl.startsWith('//')) {
      resolvedUrl = `https:${resolvedUrl}`;
    } else if (resolvedUrl.startsWith('/')) {
      resolvedUrl = `${this.baseUrl}${resolvedUrl}`;
    }

    console.log(`[${this.name}] Resolved final stream URL:`, resolvedUrl);

    const isMp4 = resolvedUrl.toLowerCase().includes('.mp4');
    let externalProxy = process.env.STREAM_PROXY_URL || process.env.NEXT_PUBLIC_STREAM_PROXY_URL;
    if (
      externalProxy &&
      (externalProxy.includes('yourname') || externalProxy.includes('example') || !externalProxy.startsWith('http'))
    ) {
      externalProxy = undefined;
    }

    const localProxyUrl = `/api/proxy?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(this.baseUrl + '/')}`;
    const effectiveProxyUrl = externalProxy
      ? `${externalProxy.replace(/\/$/, '')}${externalProxy.includes('?') ? '&' : '/?'}url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(this.baseUrl + '/')}`
      : localProxyUrl;

    return {
      streamUrl: effectiveProxyUrl,
      fallbackProxyUrl: localProxyUrl,
      headers: {
        Referer: `${this.baseUrl}/`,
      },
      format: isMp4 ? 'mp4' : 'hls',
    };
  }

  /**
   * Resolve stream from Artplayer smartplay client-side encryption via Node VM
   */
  private async resolveArtplayerStream(artplayerUrl: string, playPageUrl: string): Promise<string | null> {
    const cryptoJsCode = await this.getCryptoJs();
    const artRes = await fetch(artplayerUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        Referer: playPageUrl,
      },
    });

    if (!artRes.ok) {
      console.warn(`[${this.name}] Artplayer fetch returned HTTP ${artRes.status}`);
      return null;
    }

    const html = await artRes.text();
    const scriptMatch = html.match(/<script(?![^>]*src)[^>]*>([\s\S]+?)<\/script>/gi);
    if (!scriptMatch) return null;
    const targetScript = scriptMatch[scriptMatch.length - 1]
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '');

    let resolvedStreamUrl: string | null = null;

    const customFetch = async (fetchUrl: string, options: any = {}) => {
      const headers = {
        ...(options.headers || {}),
        Origin: this.baseUrl,
        Referer: `${this.baseUrl}/static/player/artplayer/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };
      const res = await fetch(fetchUrl, { ...options, headers });
      const text = await res.text();
      let json = {};
      try {
        json = JSON.parse(text);
      } catch {}
      return {
        ok: res.ok,
        status: res.status,
        headers: { get: (h: string) => res.headers.get(h) },
        json: async () => json,
        text: async () => text,
      };
    };

    const handler: ProxyHandler<any> = {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'classList') return { add: () => {}, remove: () => {}, contains: () => false };
        if (prop === 'style') return {};
        if (prop === 'children') return [];
        if (prop === 'childNodes') return [];
        if (typeof prop === 'string' && (prop.startsWith('on') || prop === 'addEventListener')) return () => {};
        return () => new Proxy({}, handler);
      },
    };

    const elem = new Proxy(
      {
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        appendChild: () => {},
        removeChild: () => {},
        setAttribute: () => {},
        getAttribute: () => '',
      },
      handler
    );

    const locObj = {
      href: artplayerUrl,
      protocol: 'https:',
      host: new URL(this.baseUrl).host,
      hostname: new URL(this.baseUrl).hostname,
      search: artplayerUrl.includes('?') ? artplayerUrl.slice(artplayerUrl.indexOf('?')) : '',
    };

    const locProxy = new Proxy(locObj, {
      set(target, prop, value) {
        (target as any)[prop] = value;
        if (typeof value === 'string') {
          const match = value.match(/[?&]url=([^&]+)/) || value.match(/=(https?[^&]+)/);
          if (match) resolvedStreamUrl = decodeURIComponent(match[1]);
          else if (value.startsWith('http')) resolvedStreamUrl = value;
        }
        return true;
      },
    });

    const sandbox = {
      console: { log: () => {}, error: () => {}, warn: () => {}, info: () => {} },
      window: {} as any,
      fetch: customFetch,
      document: {
        body: elem,
        head: elem,
        documentElement: elem,
        getElementById: () => elem,
        querySelector: () => elem,
        querySelectorAll: () => [elem],
        createElement: () => elem,
        addEventListener: () => {},
      },
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      location: locProxy,
      localStorage: { getItem: () => null, setItem: () => {} },
      setTimeout: (fn: any, ms: number) => setTimeout(fn, ms),
      setInterval: () => {},
      Artplayer: function (opts: any) {
        if (opts && opts.url) resolvedStreamUrl = opts.url;
        return {
          on: () => {},
          switchUrl: (u: string) => {
            resolvedStreamUrl = u;
          },
          destroy: () => {},
        };
      },
      parent: { MacPlayer: { Id: '1' } },
    };
    sandbox.window = sandbox;

    const context = vm.createContext(sandbox);
    if (cryptoJsCode) {
      vm.runInContext(cryptoJsCode, context);
    }
    try {
      vm.runInContext(targetScript, context);
    } catch (e: any) {
      // Benign anti-debug / UI DOM errors are expected in headless VM
    }

    const start = Date.now();
    while (!resolvedStreamUrl && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 100));
    }

    return resolvedStreamUrl;
  }
}
