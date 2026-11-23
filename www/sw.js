// Offline copy of Crack the Code!
// Network first: a player who is online always gets the newest version, exactly as without this file.
// Offline, or when the network takes more than a few seconds, the last copy seen is served instead.
// The build stamps BUILD below, so every release replaces this worker and clears the old copy.
const BUILD = '76f6a8e9', CACHE = 'ctc-' + BUILD, WAIT_MS = 4000;
const CORE = ['./', 'index.html', '404.html', 'manifest.webmanifest', 'favicon.svg', 'favicon-dark.svg', 'favicon.ico', 'favicon-dark.ico',
  'apple-touch-icon.png', 'apple-touch-icon-dark.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ctc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const page = req.mode === 'navigate', key = page ? './' : url.pathname.replace(/^.*\//, '') || './';
  e.respondWith((async () => {
    const cache = await caches.open(CACHE), saved = await cache.match(key, { ignoreSearch: true });
    const net = fetch(req).then(res => {
      if (res.ok && !url.search && (page ? url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') : CORE.includes(key))) cache.put(key, res.clone());
      return res;
    });
    if (!saved) return net.catch(() => Response.error());
    const slow = new Promise(r => setTimeout(() => r(saved), WAIT_MS));
    return Promise.race([net.catch(() => saved), slow]);
  })());
});
