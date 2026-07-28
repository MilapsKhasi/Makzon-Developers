const CACHE_NAME = 'zenterprime-app-shell-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.tsx',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;500;600;700&family=Georama:ital,wght@0,300..700;1,300..700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching app shell assets...');
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const req = new Request(url, { cache: 'reload' });
            const res = await fetch(req);
            if (res && (res.status === 200 || res.type === 'opaque')) {
              await cache.put(req, res);
            }
          } catch (e) {
            try {
              // Fallback for cross-origin assets (e.g. CDN/Fonts) if CORS mode fails
              const req = new Request(url, { mode: 'no-cors' });
              const res = await fetch(req);
              if (res) {
                await cache.put(req, res);
              }
            } catch (err) {
              console.warn('[SW] Pre-cache failed for:', url, err);
            }
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // Skip Supabase database & auth endpoints so JS layer handles offline mode via IndexedDB
  if (
    url.hostname.includes('supabase') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/')
  ) {
    return;
  }

  // 1. Navigation / HTML Requests
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      (async () => {
        // Try cached response first so navigation loads immediately offline after cold restart
        const cachedHtml = await caches.match(request) || await caches.match('/index.html') || await caches.match('/');
        
        // Background revalidation if online
        const networkFetch = fetch(request)
          .then(async (response) => {
            if (response && (response.status === 200 || response.type === 'opaque')) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(request, response.clone());
              cache.put('/index.html', response.clone());
            }
            return response;
          })
          .catch(() => null);

        if (cachedHtml) {
          // Serve from cache immediately
          return cachedHtml;
        }

        // If not in cache, wait for network
        const networkResponse = await networkFetch;
        if (networkResponse) {
          return networkResponse;
        }

        // Emergency fallback response
        return new Response(
          '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })()
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images, Fonts, CDN scripts, Manifest)
  // Cache-First strategy: Do NOT fetch from network if already in cache.
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Return cached asset immediately
        return cachedResponse;
      }

      // Not in cache yet -> fetch from network and store in cache for offline cold start
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      } catch (err) {
        console.warn('[SW] Fetch failed for asset:', request.url, err);
        return new Response('', { status: 408, statusText: 'Offline Asset Unavailable' });
      }
    })()
  );
});
