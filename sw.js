const CACHE = 'network-knackers-v0.2.1';
const SHELL = ['./index.html?v=0.2.1', './styles.css?v=0.2.1', './app.js?v=0.2.1', './capabilities.js?v=0.2.1', './tools.js?v=0.2.1', './manifest.webmanifest?v=0.2.1', './icons/icon.svg?v=0.2.1', './icons/icon-192.png?v=0.2.1', './icons/icon-512.png?v=0.2.1'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
// New versions wait for existing tabs to close: never mix old UI with new adapters.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('network-knackers-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const shellURLs = SHELL.map(path => new URL(path, self.registration.scope).href);
  if (event.request.mode !== 'navigate' && !shellURLs.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request.mode === 'navigate' ? './index.html?v=0.2.1' : event.request);
    return cached || fetch(event.request);
  }));
});
