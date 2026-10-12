const CACHE = 'daily-driver-v7';
const ASSETS = ['./', 'index.html', 'css/styles.css', 'js/main.js', 'js/native.js', 'js/schedule.js', 'js/widgets.js', 'js/ics.js', 'js/calendar.js', 'js/reminders.js', 'js/reminders-run.js', 'js/core.js', 'js/ui.js', 'js/util.js', 'js/logic.js', 'js/data.js', 'js/store.js', 'js/views/home.js', 'js/views/learn.js', 'js/views/plan.js', 'js/views/track.js', 'js/sections/focus.js', 'js/sections/money.js', 'js/sections/career.js', 'js/sections/settings.js', 'data/brief.json', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'fonts/plus-jakarta-sans.woff2'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
// Network first so a fresh brief.json always wins; cache is the offline fallback.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
