/* ============================================================
   The Startup Times — Service Worker
   App shell: cache-first (instant offline launch).
   News data: network-first, fall back to cache (fresh when online).
   ============================================================ */

const VERSION = 'v1';
const SHELL_CACHE = `startup-times-shell-${VERSION}`;
const DATA_CACHE  = `startup-times-data-${VERSION}`;

// Paths are relative to the SW scope, so this works on GitHub Pages subpaths.
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== DATA_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isData = url.pathname.endsWith('/data/news.json') ||
                 url.pathname.endsWith('news.json');

  if (isData) {
    // Network-first for the daily issue.
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then(c => c.put('./data/news.json', copy));
          return res;
        })
        .catch(() =>
          caches.match('./data/news.json').then(r => r || caches.match(req))
        )
    );
    return;
  }

  // Cache-first for the app shell.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Last resort: for navigations, serve the cached shell.
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
