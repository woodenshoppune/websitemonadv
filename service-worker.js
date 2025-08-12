// Basic service worker caching app shell
const CACHE = 'site-monitor-v3';
const OFFLINE_URLS = [
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));
    return;
  }
  event.respondWith(
    fetch(event.request).then(resp => { caches.open(CACHE).then(c => c.put(event.request, resp.clone())); return resp; }).catch(()=>caches.match(event.request))
  );
});
