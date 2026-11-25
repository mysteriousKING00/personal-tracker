/* Offline support: cache the app shell. Data itself lives in localStorage, never here. */
const CACHE = 'tracker-v2';
const FILES = ['./', 'index.html', 'css/styles.css', 'icon.svg', 'manifest.webmanifest',
  'js/util.js', 'js/store.js', 'js/presets.js', 'js/calc.js', 'js/charts.js', 'js/views.js', 'js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Network first, so updates you push to GitHub arrive; cache as offline fallback.
// Only plain HTTP(S) GET requests are handled; extension URLs, POSTs etc. pass through untouched.
// Only successful responses are cached, so an error page never replaces a good cached file.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const { protocol } = new URL(req.url);
  if (protocol !== 'http:' && protocol !== 'https:') return;
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req)));
});
