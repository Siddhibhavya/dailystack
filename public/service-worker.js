/* Build replaces these two constants with a content hash and exact asset paths. */
const CACHE_NAME = 'my-life-app-foundation-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png'];
function isPrivateRequest(request) {
  const url = new URL(request.url);
  return request.headers.has('Authorization') || request.method !== 'GET' || url.origin !== self.location.origin ||
    /(?:^|\/)(?:api|oauth|token|auth)(?:\/|$)/i.test(url.pathname) ||
    ['access_token', 'id_token', 'code', 'token', 'authorization'].some(key => url.searchParams.has(key));
}
self.addEventListener('install', event => {
  // A failed precache never replaces the previous working worker.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    (key.startsWith('my-life-app-') || key === 'dailystack-v1') && key !== CACHE_NAME
  ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  // Network only. Never read from or write to CacheStorage for private/API requests.
  if (isPrivateRequest(request)) return;
  const url = new URL(request.url);
  const asset = ASSETS.includes(url.pathname) && !url.search;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match('/index.html') ?? new Response('My Life needs one online visit before it can open offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }));
  } else if (asset) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => await cache.match(url.pathname) ?? fetch(request)));
  }
});
