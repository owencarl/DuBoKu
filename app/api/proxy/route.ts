import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Rewrites URLs inside an M3U8 playlist:
 * - Child playlists (.m3u8) and media segments (.ts, .m4s) route back through /api/proxy
 *   to guarantee 100% CORS compliance with Access-Control-Allow-Origin: *
 */
function rewriteM3u8Playlist(
  content: string,
  baseUrl: string,
  proxyOrigin: string,
  customReferer?: string | null
): string {
  const lines = content.split(/\r?\n/);
  const rewrittenLines: string[] = [];
  const refererParam = customReferer ? `&referer=${encodeURIComponent(customReferer)}` : '';

  for (let line of lines) {
    const trimmed = line.trim();

    // Empty lines
    if (!trimmed) {
      rewrittenLines.push(line);
      continue;
    }

    // Handle URI attributes in tags like #EXT-X-KEY or #EXT-X-MAP
    if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MAP')) {
      const uriMatch = line.match(/URI=["']([^"']+)["']/i);
      if (uriMatch && uriMatch[1]) {
        try {
          const resolvedUri = new URL(uriMatch[1], baseUrl).toString();
          const proxiedUri = `${proxyOrigin}/api/proxy?url=${encodeURIComponent(resolvedUri)}${refererParam}`;
          line = line.replace(uriMatch[0], `URI="${proxiedUri}"`);
        } catch {
          // If URL parsing fails, retain original
        }
      }
      rewrittenLines.push(line);
      continue;
    }

    // Other comment or tag lines
    if (trimmed.startsWith('#')) {
      rewrittenLines.push(line);
      continue;
    }

    // Media segment URL or child playlist URL -> route through proxy for CORS headers
    try {
      const resolvedUrl = new URL(trimmed, baseUrl).toString();
      const proxiedUrl = `${proxyOrigin}/api/proxy?url=${encodeURIComponent(resolvedUrl)}${refererParam}`;
      rewrittenLines.push(proxiedUrl);
    } catch {
      rewrittenLines.push(line);
    }
  }

  return rewrittenLines.join('\n');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing "url" query parameter', {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
      return new NextResponse('Invalid protocol. Only HTTP and HTTPS supported.', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Forward relevant incoming headers (like Range)
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        request.headers.get('user-agent') ||
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
    };

    // Forward custom referer if requested or default to target host
    const customReferer = searchParams.get('referer');
    if (customReferer) {
      upstreamHeaders['Referer'] = customReferer;
    } else {
      upstreamHeaders['Referer'] = `${parsedTarget.protocol}//${parsedTarget.host}/`;
    }

    // Range header support for video chunk seeking
    const range = request.headers.get('range');
    if (range) {
      upstreamHeaders['Range'] = range;
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isM3u8 =
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      targetUrl.includes('.m3u8');

    // Build downstream response headers with wide-open CORS
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    // Forward essential media headers
    const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
    headersToForward.forEach((h) => {
      const val = upstreamResponse.headers.get(h);
      if (val) responseHeaders.set(h, val);
    });

    // If it's an M3U8 manifest, rewrite segment URLs to route through the proxy
    if (isM3u8) {
      const text = await upstreamResponse.text();
      // Only rewrite if it's indeed an HLS manifest starting with #EXTM3U
      if (text.trim().startsWith('#EXTM3U')) {
        const proxyOrigin = new URL(request.url).origin;
        const rewritten = rewriteM3u8Playlist(text, targetUrl, proxyOrigin, customReferer);
        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        responseHeaders.delete('content-length'); // length changed due to rewriting
        return new NextResponse(rewritten, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      }

      // If text doesn't start with #EXTM3U, return as is
      return new NextResponse(text, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // For media chunks (.ts, .m4s, .mp4, keys, etc.), stream response body directly
    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new NextResponse(`Proxy error: ${error.message}`, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
