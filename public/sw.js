const CACHE_NAME = 'streampulse-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete all previous caches
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const isLocalhost =
    self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1';

  // Never cache or intercept in development, or for Next.js internal static assets / API routes
  if (
    isLocalhost ||
    event.request.url.includes('/_next/') ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('.m3u8') ||
    event.request.url.includes('.ts')
  ) {
    return;
  }

  // Network-first for navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
