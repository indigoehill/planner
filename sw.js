/* Service worker — makes the planner work with no internet.

   Strategy: NETWORK FIRST.
   Try the network, and if it answers, use that AND save a copy.
   If the network fails (no signal, on a bus, in an exam building), serve the saved copy.

   Why network first and not cache first? Because cache first is the classic trap:
   you edit index.html, push it, reload on your phone, and still see yesterday's
   version — with no obvious reason why. Network first costs a few hundred
   milliseconds and saves you an evening of confusion.

   You do NOT need to bump CACHE below when you edit index.html. It only matters
   if you want to force-clear everything for some reason.                        */

const CACHE = 'planner-v1';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// On install: grab the core files so the very first offline load works.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())      // activate immediately, don't wait for a tab close
  );
});

// On activate: delete any caches from older versions.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// On every request: network first, cache as the safety net.
self.addEventListener('fetch', e => {
  const req = e.request;

  // Only handle normal page/file loads from this site.
  if (req.method !== 'GET') return;

  e.respondWith(
    fetch(req)
      .then(res => {
        // Save a fresh copy for next time (only for our own files).
        if (res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        // Network failed — fall back to whatever we saved.
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});
