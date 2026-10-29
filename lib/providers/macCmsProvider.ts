import * as cheerio from 'cheerio';
import { BaseMediaProvider } from './baseProvider';
import { Episode, MediaCategory, MediaDetail, MediaItem, StreamResolution } from '../types';

export interface MacCmsConfig {
  key: string;
  name: string;
  baseUrl: string;
  fallbackUrls?: string[];
  searchPath?: string; // default: '/vodsearch/-------------.html?wd='
  customHeaders?: Record<string, string>;
  description?: string;
}

/**
 * Reusable HTML Scraping Provider for MacCMS-based video portals.
 * Standardizes scraping of MacCMS / myui / stui / module DOM layouts and player configs.
 */
export class MacCmsHtmlProvider implements BaseMediaProvider {
  public readonly key: string;
  public readonly name: string;
  protected baseUrl: string;
  protected searchPath: string;
  protected config: MacCmsConfig;

  constructor(config: MacCmsConfig) {
    this.config = config;
    this.key = config.key;
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.searchPath = config.searchPath || '/vodsearch/-------------.html?wd=';
  }

  /**
   * Safe fetch with standard user agent, candidate fallback mirror failover, and timeout
   */
  protected async fetchHtml(pathOrUrl: string): Promise<string> {
    const isFullUrl = pathOrUrl.startsWith('http');
    const path = isFullUrl ? null : pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    const candidateBases = [this.baseUrl, ...(this.config.fallbackUrls || [])];

    let lastError: Error | null = null;
    for (const base of candidateBases) {
      const cleanBase = base.replace(/\/$/, '');
      const targetUrl = isFullUrl ? pathOrUrl : `${cleanBase}${path}`;
      try {
        const headers = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          Referer: `${cleanBase}/`,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          ...this.config.customHeaders,
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
   * Helper to extract clean numeric or slug ID from MacCMS detail href:
   * Supports:
   * - /voddetail/1234.html -> "1234"
   * - /vod/detail/id/1234.html -> "1234"
   * - /detail/1234.html -> "1234"
   * - fallback -> encodeURIComponent(href)
   */
  protected extractDetailId(href: string): string {
    if (!href) return '';
    const match = href.match(/\/vod(?:detail|\/detail|\/detail\/id|\/show\/id|\/detail)\/([^/.]+?)(?:\.html)?(?:$|[?#])/i);
    if (match && match[1]) {
      return match[1];
    }
    const simpleMatch = href.match(/\/detail\/([^/.]+?)(?:\.html)?(?:$|[?#])/i);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1];
    }
    return encodeURIComponent(href);
  }

  /**
   * Helper to strip source key prefix if present (e.g. 'dbku:1234' -> '1234')
   */
  protected stripPrefix(id: string): string {
    if (id.startsWith(`${this.key}:`)) {
      return id.slice(this.key.length + 1);
    }
    return id;
  }

  /**
   * Helper to format an ID with source prefix (e.g. '1234' -> 'dbku:1234')
   */
  protected formatId(id: string): string {
    if (id.startsWith(`${this.key}:`)) {
      return id;
    }
    return `${this.key}:${id}`;
  }

  /**
   * Parse a standard MacCMS media card element
   */
  protected parseVodCard($: cheerio.CheerioAPI, el: any, categoryName?: string): MediaItem | null {
    const thumb = $(el).find('.myui-vodlist__thumb, .stui-vodlist__thumb, .module-item-cover, .module-item-pic a, a.pic, .pack-ykpack');
    const href = thumb.attr('href') || $(el).find('a').first().attr('href');
    const title =
      thumb.attr('title') ||
      $(el).find('.title a, .module-item-title, .fed-part-rows h4 a, h4 a, h5 a').first().text().trim() ||
      $(el).find('a').first().attr('title');

    const rawPoster =
      thumb.attr('data-original') ||
      thumb.attr('data-src') ||
      thumb.attr('src') ||
      thumb.find('img').attr('data-original') ||
      thumb.find('img').attr('data-src') ||
      thumb.find('img').attr('src') ||
      '';

    const status = $(el).find('.pic-text, .module-item-note, .fed-list-remarks, .pack-prb').first().text().trim();
    const scoreText = $(el).find('.pic-tag, .score, .module-item-douban, .branch').first().text().trim();
    const rating = parseFloat(scoreText);

    if (!href || !title) return null;

    const rawId = this.extractDetailId(href);
    const poster = this.normalizeUrl(rawPoster);

    return {
      id: this.formatId(rawId),
      title: title.trim(),
      poster,
      backdrop: poster,
      status: status || undefined,
      rating: !isNaN(rating) ? rating : undefined,
      category: categoryName,
      source: this.key,
      sourceName: this.name,
    };
  }

  /**
   * 1. Get Homepage Featured Categories
   */
  async getFeatured(): Promise<MediaCategory[]> {
    const html = await this.fetchHtml('/');
    const $ = cheerio.load(html);
    const categories: MediaCategory[] = [];

    $('.myui-panel, .stui-pannel, .module, .fed-part-case, .tab-pane').each((idx, panel) => {
      const categoryTitle = $(panel)
        .find('.myui-panel__head .title, .stui-pannel__head .title, .module-title, .fed-part-rows h3, .title')
        .first()
        .text()
        .trim();

      const items: MediaItem[] = [];

      $(panel)
        .find('.myui-vodlist__box, .stui-vodlist__box, .module-item, .fed-list-item, .pack-ykpack')
        .each((__, box) => {
          const item = this.parseVodCard($, box, categoryTitle);
          if (item) items.push(item);
        });

      if (categoryTitle && items.length > 0) {
        categories.push({
          id: `${this.key}-cat-${idx}-${encodeURIComponent(categoryTitle)}`,
          title: categoryTitle,
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

    const searchUrl = `${this.searchPath}${encodeURIComponent(q)}`;
    const html = await this.fetchHtml(searchUrl);
    const $ = cheerio.load(html);
    const results: MediaItem[] = [];

    // Search results on MacCMS typically use #searchList li, .myui-vodlist__media li, or .module-item
    $('#searchList li, .myui-vodlist__media li, .myui-vodlist__box, .stui-vodlist__box, .module-search-item, .module-item, .fed-part-layout li').each(
      (_, el) => {
        const thumb = $(el).find('.myui-vodlist__thumb, .stui-vodlist__thumb, .module-item-cover, .module-item-pic a, a.pic, img');
        const href = thumb.attr('href') || $(el).find('a').first().attr('href');
        const title =
          thumb.attr('title') ||
          $(el).find('.title a, .module-item-title, .fed-part-rows h4 a, h4 a, .title').first().text().trim() ||
          $(el).find('a').first().attr('title');

        const rawPoster =
          thumb.attr('data-original') ||
          thumb.attr('data-src') ||
          thumb.attr('src') ||
          thumb.find('img').attr('data-original') ||
          thumb.find('img').attr('data-src') ||
          thumb.find('img').attr('src') ||
          '';

        const status = $(el).find('.pic-text, .module-item-note, .fed-list-remarks, .pack-prb').first().text().trim();
        const desc = $(el).find('.detail .desc, .detail p, .module-item-desc, .fed-part-rows p').last().text().trim();

        if (href && title) {
          const rawId = this.extractDetailId(href);
          const poster = this.normalizeUrl(rawPoster);
          results.push({
            id: this.formatId(rawId),
            title: title.trim(),
            poster,
            backdrop: poster,
            status: status || undefined,
            description: desc || undefined,
            source: this.key,
            sourceName: this.name,
          });
        }
      }
    );

    return results;
  }

  /**
   * 3. Get Media Details & Episode List
   */
  async getDetails(id: string): Promise<MediaDetail> {
    const rawId = this.stripPrefix(id);
    const decodedId = decodeURIComponent(rawId);
    let detailPath = decodedId;
    if (!detailPath.startsWith('/') && !detailPath.startsWith('http')) {
      detailPath = `/voddetail/${detailPath}.html`;
    }

    let html: string;
    try {
      html = await this.fetchHtml(detailPath);
    } catch (err) {
      if (detailPath.startsWith('/voddetail/')) {
        detailPath = `/detail/${decodedId}.html`;
        html = await this.fetchHtml(detailPath);
      } else {
        throw err;
      }
    }
    const $ = cheerio.load(html);

    const title =
      $('.myui-content__detail .title, .stui-content__detail .title, .module-info-heading h1, .fed-part-rows h1')
        .first()
        .text()
        .trim();

    const thumbImg = $(
      '.myui-content__thumb .myui-vodlist__thumb img, .myui-content__thumb .myui-vodlist__thumb, .stui-content__thumb img, .module-info-poster img'
    );
    const rawPoster = thumbImg.attr('data-original') || thumbImg.attr('data-src') || thumbImg.attr('src') || '';
    const poster = this.normalizeUrl(rawPoster);

    const status = $('.myui-content__thumb .pic-text, .module-info-tag, .pic-text').first().text().trim() || undefined;
    const scoreText = $('.myui-content__detail .score, .myui-content__detail .branch, .module-info-douban-num').first().text().trim();
    const rating = parseFloat(scoreText);

    const description =
      $('.myui-panel_bd .col-pd.text-collapse .data').text().trim() ||
      $('.module-info-introduction-content p').text().trim() ||
      $('.desc .data, #desc .data, .stui-content__desc').text().trim() ||
      '';

    // Parse metadata lines (分类 / 年份 / 主演 / 导演)
    let category: string | undefined;
    let year: string | undefined;
    let director: string | undefined;
    const actors: string[] = [];
    const tags: string[] = [];

    $('.myui-content__detail p.data, .stui-content__detail p.data, .module-info-item').each((_, p) => {
      const text = $(p).text();
      if (text.includes('分类：') || text.includes('类型：')) {
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

    // Extract episodes from the playlist container, specifically avoiding sidebar ranking lists
    const episodes: Episode[] = [];
    let playlistList = $(
      '#playlist1 .myui-content__list, .tab-content .myui-content__list, ul.myui-content__list.sort-list, #playlist .myui-content__list, .stui-content__playlist, .module-play-list-content, .sort-list'
    ).first();

    // Fallback: search for any playlist container that contains actual play links (/vodplay/ or /vod/play/)
    if (playlistList.length === 0 || playlistList.find('li a').length === 0) {
      $('.myui-content__list, .stui-content__playlist, .module-play-list-content').each((_, list) => {
        const links = $(list).find('li a');
        const hasPlayLinks = links.toArray().some((a) => {
          const h = $(a).attr('href') || '';
          return h.includes('vodplay') || h.includes('/vod/play/') || h.includes('/play/');
        });
        if (hasPlayLinks && playlistList.length === 0) {
          playlistList = $(list);
        }
      });
    }

    playlistList.find('li a').each((index, a) => {
      const epTitle = $(a).text().trim();
      const epHref = $(a).attr('href') || '';
      if (!epHref) return;

      // Filter out non-play links
      if (!epHref.includes('vodplay') && !epHref.includes('/vod/play/') && !epHref.includes('/play/')) {
        return;
      }

      const epMatch = epHref.match(/\/vodplay\/([^/.]+)\.html/i) || epHref.match(/\/play\/([^/.]+)\.html/i);
      let epId: string;
      if (epMatch && epMatch[1]) {
        epId = epMatch[1];
      } else {
        const cleanHref = epHref.replace(/\.html$/, '').replace(/^\//, '');
        epId = encodeURIComponent(cleanHref);
      }

      episodes.push({
        id: this.formatId(epId),
        title: epTitle || `第 ${index + 1} 集`,
        number: index + 1,
      });
    });

    return {
      id: this.formatId(rawId),
      title: title || '未知影视',
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
   * 4. Extract Playable Stream URL from MacCMS Player Page
   */
  async resolveStreamUrl(episodeId: string): Promise<StreamResolution> {
    const rawEpId = this.stripPrefix(episodeId);
    const decodedEpId = decodeURIComponent(rawEpId);
    let playPath = decodedEpId;
    if (!playPath.startsWith('/') && !playPath.startsWith('http')) {
      playPath = `/vodplay/${playPath}.html`;
    }

    console.log(`[${this.name}] Fetching play page: ${playPath}`);
    let html: string;
    try {
      html = await this.fetchHtml(playPath);
    } catch (err) {
      if (playPath.startsWith('/vodplay/')) {
        playPath = `/play/${decodedEpId}.html`;
        html = await this.fetchHtml(playPath);
      } else {
        throw err;
      }
    }

    // MacCMS embeds stream configuration in `var player_data = {...}` or `var player_aaaa = {...}`
    let playerConfig: any = null;
    const match =
      html.match(/var\s+(?:player_data|player_aaaa|player_[a-zA-Z0-9_]+)\s*=\s*(\{[\s\S]*?\})(?:;|\s*<|\s*\n)/i) ||
      html.match(/var\s+(?:player_data|player_aaaa|player_[a-zA-Z0-9_]+)\s*=\s*(\{[\s\S]*?\})/i);

    if (match && match[1]) {
      try {
        playerConfig = JSON.parse(match[1]);
        console.log(`[${this.name}] Successfully parsed player config for ${playPath}`);
      } catch (e) {
        console.warn(`[${this.name}] Failed to parse player JSON directly:`, e);
      }
    }

    let rawStreamUrl: string = playerConfig?.url || '';

    // Handle URL-encoded (encrypt === 1) or Base64-encoded (encrypt === 2) stream URLs
    if (playerConfig) {
      const enc = Number(playerConfig.encrypt);
      if (enc === 1) {
        rawStreamUrl = decodeURIComponent(rawStreamUrl);
      } else if (enc === 2) {
        try {
          const b64 = Buffer.from(rawStreamUrl, 'base64').toString('utf-8');
          rawStreamUrl = decodeURIComponent(b64);
        } catch (e: any) {
          console.warn(`[${this.name}] Base64 decode failed:`, e.message);
        }
      }
    }

    // Fallback: If not starting with http, try base64 decode anyway
    if (rawStreamUrl && !rawStreamUrl.startsWith('http')) {
      try {
        const b64 = Buffer.from(rawStreamUrl, 'base64').toString('utf-8');
        const decoded = decodeURIComponent(b64);
        if (decoded.startsWith('http')) {
          rawStreamUrl = decoded;
        }
      } catch {}
    }

    // Ensure percent-encoded characters like %3A and %2F are decoded
    if (rawStreamUrl && (rawStreamUrl.includes('%3A') || rawStreamUrl.includes('%2F'))) {
      try {
        rawStreamUrl = decodeURIComponent(rawStreamUrl);
      } catch {}
    }

    // Fallback: look for direct .m3u8 regex match in script tags
    if (!rawStreamUrl) {
      const m3u8Match = html.match(/["']url["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (m3u8Match && m3u8Match[1]) {
        rawStreamUrl = m3u8Match[1].replace(/\\/g, '');
      }
    }

    // Fallback: look for base64 encoded URL (aHR0c...)
    if (!rawStreamUrl) {
      const b64Match = html.match(/["']url["']\s*:\s*["'](aHR0c[A-Za-z0-9+/=]+)["']/i);
      if (b64Match && b64Match[1]) {
        try {
          const decoded = decodeURIComponent(Buffer.from(b64Match[1], 'base64').toString('utf-8'));
          if (decoded.startsWith('http')) {
            rawStreamUrl = decoded;
          }
        } catch {}
      }
    }

    if (rawStreamUrl.startsWith('//')) {
      rawStreamUrl = `https:${rawStreamUrl}`;
    }

    if (!rawStreamUrl) {
      throw new Error(`[${this.name}] Could not locate stream URL in player page: ${playPath}`);
    }

    console.log(`[${this.name}] Resolved raw stream URL for ${playPath}:`, rawStreamUrl);

    const isMp4 = rawStreamUrl.toLowerCase().includes('.mp4');
    const defaultProxy = 'https://duboku-proxy.liukun-tju.workers.dev';
    let externalProxy =
      process.env.STREAM_PROXY_URL ||
      process.env.NEXT_PUBLIC_STREAM_PROXY_URL ||
      defaultProxy;

    // Ignore placeholder / dummy URLs like 'yourname' or 'example'
    if (
      externalProxy &&
      (externalProxy.includes('yourname') ||
        externalProxy.includes('example') ||
        !externalProxy.startsWith('http'))
    ) {
      externalProxy = defaultProxy;
    }

    const localProxyUrl = `/api/proxy?url=${encodeURIComponent(rawStreamUrl)}&referer=${encodeURIComponent(this.baseUrl + '/')}`;
    const effectiveProxyUrl = externalProxy
      ? `${externalProxy.replace(/\/$/, '')}${externalProxy.includes('?') ? '&' : '/?'}url=${encodeURIComponent(rawStreamUrl)}&referer=${encodeURIComponent(this.baseUrl + '/')}`
      : localProxyUrl;

    return {
      streamUrl: effectiveProxyUrl,
      fallbackProxyUrl: effectiveProxyUrl,
      headers: {
        Referer: `${this.baseUrl}/`,
      },
      format: isMp4 ? 'mp4' : 'hls',
    };
  }
}
