/**
 * Cloudflare Worker: Zero-Cost, High-Performance Video Streaming CORS Proxy
 * 
 * Purpose:
 * Proxies HLS video streams (.m3u8 playlists and .ts/.m4s media chunks) with open CORS headers.
 * Cloudflare Workers free plan includes 100,000 requests/day and UNLIMITED bandwidth (zero egress fees),
 * offloading 100% of video bandwidth from Vercel so you never hit Vercel's 10 GB limit.
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing "url" query parameter', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain',
        },
      });
    }

    try {
      const parsedTarget = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
        return new Response('Invalid protocol. Only HTTP and HTTPS supported.', {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Build upstream request headers
      const upstreamHeaders = new Headers();
      upstreamHeaders.set(
        'User-Agent',
        request.headers.get('User-Agent') ||
          'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
      );
      upstreamHeaders.set('Accept', '*/*');
      upstreamHeaders.set('Accept-Encoding', 'gzip, deflate, br');

      const customReferer = url.searchParams.get('referer');
      upstreamHeaders.set(
        'Referer',
        customReferer || `${parsedTarget.protocol}//${parsedTarget.host}/`
      );

      const range = request.headers.get('Range');
      if (range) {
        upstreamHeaders.set('Range', range);
      }

      // Fetch upstream video or playlist
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: upstreamHeaders,
        redirect: 'follow',
      });

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const isM3u8 =
        contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/x-mpegurl') ||
        targetUrl.includes('.m3u8');

      // Downstream response headers with open CORS
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      // Rewrite M3U8 playlists to route child segments through this Cloudflare Worker
      if (isM3u8) {
        const text = await upstreamResponse.text();
        if (text.trim().startsWith('#EXTM3U')) {
          const workerOrigin = url.origin;
          const refererParam = customReferer ? `&referer=${encodeURIComponent(customReferer)}` : '';
          const lines = text.split(/\r?\n/);
          const rewrittenLines = [];

          for (let line of lines) {
            const trimmed = line.trim();

            if (!trimmed) {
              rewrittenLines.push(line);
              continue;
            }

            // Rewrite keys and init maps
            if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MAP')) {
              const uriMatch = line.match(/URI=["']([^"']+)["']/i);
              if (uriMatch && uriMatch[1]) {
                try {
                  const resolved = new URL(uriMatch[1], targetUrl).toString();
                  const proxied = `${workerOrigin}/?url=${encodeURIComponent(resolved)}${refererParam}`;
                  line = line.replace(uriMatch[0], `URI="${proxied}"`);
                } catch {}
              }
              rewrittenLines.push(line);
              continue;
            }

            if (trimmed.startsWith('#')) {
              rewrittenLines.push(line);
              continue;
            }

            // Rewrite segment or sub-playlist URL
            try {
              const resolved = new URL(trimmed, targetUrl).toString();
              const proxied = `${workerOrigin}/?url=${encodeURIComponent(resolved)}${refererParam}`;
              rewrittenLines.push(proxied);
            } catch {
              rewrittenLines.push(line);
            }
          }

          responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          responseHeaders.delete('content-length');
          return new Response(rewrittenLines.join('\n'), {
            status: upstreamResponse.status,
            headers: responseHeaders,
          });
        }
      }

      // Stream binary chunks (.ts, .m4s, etc.) directly with CORS
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(`Cloudflare Worker Proxy Error: ${err.message}`, {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
