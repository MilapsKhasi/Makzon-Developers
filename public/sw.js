const CACHE_NAME = 'zenterprime-app-shell-v3';

// Activate immediately and claim clients
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cacheName);
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

  // Skip Supabase database & auth endpoints
  if (
    url.hostname.includes('supabase') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/')
  ) {
    return;
  }

  // Bypass SW for Vite dev scripts & hot module modules so AI Studio preview is always live
  if (
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@fs') ||
    url.pathname.includes('/src/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.jsx')
  ) {
    return;
  }

  // Network-First strategy for all requests (HTML & JS) to ensure live changes show up immediately
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      } catch (err) {
        // Fallback to cache when offline
        const cachedResponse = await caches.match(request) || await caches.match('/index.html') || await caches.match('/');
        if (cachedResponse) return cachedResponse;
        return new Response('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
          headers: { 'Content-Type': 'text/html' },
        });
      }
    })()
  );
});
