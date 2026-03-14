// Fraimage Inventory Scanner — Service Worker
// Version: bump this string to force cache refresh on update
const CACHE_VERSION = 'fraimage-v1';
const CACHE_NAME    = CACHE_VERSION;

// Files to cache for offline use
const PRECACHE_URLS = [
  '/Barcode/',
  '/Barcode/index.html',
  '/Barcode/manifest.json',
  // External CDN libraries — cached on first load
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@400;600;700;900&display=swap'
];

// ── Install: cache all critical files ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache app shell first (guaranteed)
      return cache.addAll(['/Barcode/', '/Barcode/index.html', '/Barcode/manifest.json'])
        .then(() => {
          // Cache CDN resources — ignore failures (CDN might block SW caching)
          const cdnUrls = [
            'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js'
          ];
          return Promise.allSettled(
            cdnUrls.map(url =>
              fetch(url, { mode: 'cors' })
                .then(resp => resp.ok ? cache.put(url, resp) : null)
                .catch(() => null)
            )
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and Google APIs (OAuth, Drive, userinfo — always need network)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('accounts.google.com')) return;
  if (url.hostname.includes('fonts.gstatic.com')) return; // font files, let browser cache

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cached version, but also refresh in background (stale-while-revalidate)
        const networkFetch = fetch(event.request)
          .then(resp => {
            if (resp && resp.status === 200 && resp.type !== 'opaque') {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, resp.clone()));
            }
            return resp;
          })
          .catch(() => null);
        return cached; // serve immediately from cache
      }
      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(resp => {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const toCache = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return resp;
      }).catch(() => {
        // Offline fallback — return cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/Barcode/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── Message: force update from app ─────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
