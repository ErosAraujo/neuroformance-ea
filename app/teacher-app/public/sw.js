const CACHE = 'neuroformance-ea-teacher-v1';
const ASSETS = ['/index.html', '/manifest.webmanifest', '/icons/icon-v2-192.png', '/icons/icon-v2-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // API nunca entra no cache do PWA. Isso evita Network Error falso e dado antigo em metas/registros.
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin || req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
