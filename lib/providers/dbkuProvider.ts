import * as cheerio from 'cheerio';
import { BaseMediaProvider } from './baseProvider';
import { Episode, MediaCategory, MediaDetail, MediaItem, StreamResolution } from '../types';

const BASE_URL = 'https://www.dbku.tv';
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  'Referer': `${BASE_URL}/`,
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

export class DbkuProvider implements BaseMediaProvider {
  private async fetchHtml(pathOrUrl: string): Promise<string> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      cache: 'no-store', // Disable caching during debugging so dynamic HTML is fresh
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }
    return res.text();
  }

  private normalizeUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  /**
   * Helper to extract clean ID from MacCMS detail href:
   * Supports:
   * - /voddetail/1234.html -> "1234"
   * - /vod/detail/id/1234.html -> "1234"
   * - fallback -> encodeURIComponent(href)
   */
  private extractDetailId(href: string): string {
    if (!href) return '';
    const match = href.match(/\/vod(?:detail|\/detail|\/detail\/id)\/([^/.]+?)(?:\.html)?(?:$|[?#])/i);
    if (match && match[1]) {
      return match[1];
    }
    return encodeURIComponent(href);
  }

  /**
   * Helper to parse standard MacCMS video cards (.myui-vodlist__box)
   */
  private parseVodCard($: cheerio.CheerioAPI, el: any, categoryName?: string): MediaItem | null {
    const thumb = $(el).find('.myui-vodlist__thumb');
    const href = thumb.attr('href');
    const title = thumb.attr('title') || $(el).find('.title a').text().trim();
    const rawPoster = thumb.attr('data-original') || thumb.attr('src') || '';
    const status = thumb.find('.pic-text').text().trim();
    const scoreText = thumb.find('.pic-tag').text().trim();
    const rating = parseFloat(scoreText);

    if (!href || !title) return null;

    const id = this.extractDetailId(href);
    const poster = this.normalizeUrl(rawPoster);

    return {
      id,
      title,
      poster,
      backdrop: poster,
      status: status || undefined,
      rating: !isNaN(rating) ? rating : undefined,
      category: categoryName,
    };
  }

  /**
   * 1. Get Homepage Featured Categories
   */
  async getFeatured(): Promise<MediaCategory[]> {
    const html = await this.fetchHtml('/');
    const $ = cheerio.load(html);
    const categories: MediaCategory[] = [];

    $('.myui-panel').each((idx, panel) => {
      const categoryTitle = $(panel).find('.myui-panel__head .title').first().text().trim();
      const items: MediaItem[] = [];

      $(panel)
        .find('.myui-vodlist__box')
        .each((__, box) => {
          const item = this.parseVodCard($, box, categoryTitle);
          if (item) items.push(item);
        });

      if (categoryTitle && items.length > 0) {
        categories.push({
          id: `cat-${idx}-${encodeURIComponent(categoryTitle)}`,
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

    const searchUrl = `/vodsearch/-------------.html?wd=${encodeURIComponent(q)}`;
    const html = await this.fetchHtml(searchUrl);
    const $ = cheerio.load(html);
    const results: MediaItem[] = [];

    // Search results on MacCMS typically use #searchList li or .myui-vodlist__media li
    $('#searchList li, .myui-vodlist__media li, .myui-vodlist__box').each((_, el) => {
      const thumb = $(el).find('.myui-vodlist__thumb');
      const href = thumb.attr('href');
      const title = thumb.attr('title') || $(el).find('.title a').first().text().trim();
      const rawPoster = thumb.attr('data-original') || thumb.attr('src') || '';
      const status = thumb.find('.pic-text').text().trim();
      const desc = $(el).find('.detail .desc, .detail p').last().text().trim();

      if (href && title) {
        const id = this.extractDetailId(href);
        const poster = this.normalizeUrl(rawPoster);
        results.push({
          id,
          title,
          poster,
          backdrop: poster,
          status: status || undefined,
          description: desc || undefined,
        });
      }
    });

    return results;
  }

  /**
   * 3. Get Drama Details & Episode List
   */
  async getDetails(id: string): Promise<MediaDetail> {
    const decodedId = decodeURIComponent(id);
    let detailPath = decodedId;
    if (!detailPath.startsWith('/') && !detailPath.startsWith('http')) {
      detailPath = `/voddetail/${detailPath}.html`;
    }
    const html = await this.fetchHtml(detailPath);
    const $ = cheerio.load(html);

    const title = $('.myui-content__detail .title').first().text().trim();
    const thumbImg = $('.myui-content__thumb .myui-vodlist__thumb img, .myui-content__thumb .myui-vodlist__thumb');
    const rawPoster = thumbImg.attr('data-original') || thumbImg.attr('src') || '';
    const poster = this.normalizeUrl(rawPoster);

    const status = $('.myui-content__thumb .pic-text').text().trim() || undefined;
    const scoreText = $('.myui-content__detail .score, .myui-content__detail .branch').first().text().trim();
    const rating = parseFloat(scoreText);

    const description =
      $('.myui-panel_bd .col-pd.text-collapse .data').text().trim() ||
      $('.desc .data').text().trim() ||
      $('#desc .data').text().trim() ||
      '';

    // Parse metadata lines (分类 / 年份 / 主演 / 导演)
    let category: string | undefined;
    let year: string | undefined;
    let director: string | undefined;
    const actors: string[] = [];
    const tags: string[] = [];

    $('.myui-content__detail p.data').each((_, p) => {
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
      '#playlist1 .myui-content__list, .tab-content .myui-content__list, ul.myui-content__list.sort-list, #playlist .myui-content__list, .myui-content__list.scrollbar'
    ).first();

    // Fallback: search for any .myui-content__list that contains actual play links (/vodplay/ or /vod/play/)
    if (playlistList.length === 0 || playlistList.find('li a').length === 0) {
      $('.myui-content__list').each((_, list) => {
        const links = $(list).find('li a');
        const hasPlayLinks = links.toArray().some((a) => {
          const h = $(a).attr('href') || '';
          return h.includes('vodplay') || h.includes('/vod/play/');
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

      // Filter out non-play links (e.g. sidebar ranking links to other shows)
      if (!epHref.includes('vodplay') && !epHref.includes('/vod/play/')) {
        return;
      }

      // Support:
      // 1. /vodplay/1234-1-1.html -> "1234-1-1"
      // 2. /vod/play/id/1234/sid/1/nid/1.html -> clean ID or encoded path
      const epMatch = epHref.match(/\/vodplay\/([^/.]+)\.html/i);
      let epId: string;
      if (epMatch && epMatch[1]) {
        epId = epMatch[1];
      } else {
        epId = encodeURIComponent(epHref);
      }

      episodes.push({
        id: epId,
        title: epTitle || `第${index + 1}集`,
        number: index + 1,
      });
    });

    return {
      id,
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
    };
  }

  /**
   * 4. Extract Raw .m3u8 Stream URL from Player Page
   */
  async resolveStreamUrl(episodeId: string): Promise<StreamResolution> {
    const decodedEpId = decodeURIComponent(episodeId);
    let playPath = decodedEpId;
    if (!playPath.startsWith('/') && !playPath.startsWith('http')) {
      playPath = `/vodplay/${playPath}.html`;
    }
    console.log(`[DbkuProvider] Fetching play page: ${playPath}`);
    const html = await this.fetchHtml(playPath);

    // MacCMS / dbku embeds stream configuration in `var player_data = {...}` or `var player_aaaa = {...}`
    let playerConfig: any = null;
    const match =
      html.match(/var\s+(?:player_data|player_aaaa|player_[a-zA-Z0-9_]+)\s*=\s*(\{[\s\S]*?\})(?:;|\s*<|\s*\n)/i) ||
      html.match(/var\s+(?:player_data|player_aaaa|player_[a-zA-Z0-9_]+)\s*=\s*(\{[\s\S]*?\})/i);

    if (match && match[1]) {
      try {
        playerConfig = JSON.parse(match[1]);
        console.log(`[DbkuProvider] Successfully parsed player config for ${playPath}`);
      } catch (e) {
        console.warn('[DbkuProvider] Failed to parse player JSON directly:', e);
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
          console.warn('[DbkuProvider] Base64 decode failed:', e.message);
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
      throw new Error(`Could not locate stream URL in player page: ${playPath}`);
    }

    console.log(`[DbkuProvider] Resolved raw stream URL for ${playPath}:`, rawStreamUrl);

    const isMp4 = rawStreamUrl.toLowerCase().includes('.mp4');
    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(rawStreamUrl)}&referer=${encodeURIComponent(BASE_URL + '/')}`;

    return {
      streamUrl: proxiedUrl,
      fallbackProxyUrl: proxiedUrl,
      headers: {
        Referer: `${BASE_URL}/`,
      },
      format: isMp4 ? 'mp4' : 'hls',
    };
  }
}
