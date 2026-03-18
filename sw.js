// Fraimage Inventory Scanner — Service Worker v3
// v3: Never cache CDN libraries — fixes jsQR loading on older phones
const CACHE_VERSION = 'fraimage-v3';
const CACHE_NAME    = CACHE_VERSION;

// ONLY cache the app shell
const APP_SHELL = [
  '/Barcode/',
  '/Barcode/index.html',
  '/Barcode/manifest.json'
];

// These domains ALWAYS go to network — never cache
const NEVER_CACHE_DOMAINS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'accounts.google.com',
  'googleapis.com'
];

self.addEventListener('install', event => {
  console.log('[SW v3] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

// Activate: delete ALL old caches including v1 and v2
self.addEventListener('activate', event => {
  console.log('[SW v3] Activating — clearing ALL old caches');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // NEVER intercept CDN/API — always go to network
  const skip = NEVER_CACHE_DOMAINS.some(d => url.hostname.includes(d));
  if (skip) return;

  // App shell: cache first, update in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => null);
      return cached || networkFetch || caches.match('/Barcode/index.html');
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
