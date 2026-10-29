const CACHE = 'network-knackers-v0.2.0';
const SHELL = ['./', './index.html', './styles.css', './app.js', './capabilities.js', './tools.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
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
    const cached = await cache.match(event.request.mode === 'navigate' ? './index.html' : event.request);
    return cached || fetch(event.request);
  }));
});
