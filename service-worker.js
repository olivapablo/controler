/* ═══════════════════════════════════════════════
   EDUTRACK – SERVICE WORKER
   Estrategia: Cache-first para assets, Network-first para datos
   ═══════════════════════════════════════════════ */

const CACHE_NAME = 'edutrack-v1.3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Jockey+One&family=Montserrat:wght@300;400;500;600;700&display=swap',
];

// ── INSTALL ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Strategy: Cache First → Network Fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Serve from cache, update in background
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type !== 'opaque') {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => {});
        return cached;
      }

      // Not in cache: fetch from network
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response;

          // Cache Google Fonts and local assets
          if (
            url.origin === location.origin ||
            url.hostname === 'fonts.googleapis.com' ||
            url.hostname === 'fonts.gstatic.com'
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }

          return response;
        })
        .catch(() => {
          // Offline fallback: serve index.html for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});

// ── PUSH NOTIFICATIONS (placeholder) ──
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'EduTrack';
  const options = {
    body: data.body || 'Tenés una nueva notificación.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
