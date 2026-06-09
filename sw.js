const CACHE = 'radioaudit-v3';
const LOCAL_ASSETS = [
  './db.js',
  './leaflet.min.css',
  './leaflet.min.js',
  './leaflet-image.js',
  './xlsx.min.js',
  './jszip.min.js',
  './exceljs.min.js',
  './pptxgen.bundle.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(LOCAL_ASSETS.map(a => c.add(a).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Ne JAMAIS intercepter les appels API Supabase (toujours réseau direct)
  if (url.hostname.endsWith('supabase.co')) return;

  // index.html + db.js -> réseau d'abord (fichiers qui changent souvent)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html') || url.pathname.endsWith('db.js')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match(e.request).then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Fichiers locaux (libs, db.js) -> cache first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => new Response('Not found', { status: 404 }));
      })
    );
    return;
  }
  // Tuiles OSM, fonts -> navigateur direct (pas de cache SW)
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
