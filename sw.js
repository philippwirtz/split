const CACHE = 'kasse-v1';
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// Nur eigene alte Caches löschen: Die Spanisch-App liegt auf derselben Adresse und teilt sich den Cache-Speicher.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('kasse-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Seite bittet um Neubefüllen, falls eine andere App den Cache geräumt hat
self.addEventListener('message', e => {
  if (e.data === 'recache') caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {});
});

// Seite, Stile und Skripte: erst Netz, dann Cache — Updates kommen sofort, offline läuft der Cache.
// Symbole & Manifest: erst Cache, dann Netz. Fremde Adressen (GitHub-API, Wechselkurse) nie anfassen.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if (isPage || /\.(js|css)$/.test(url.pathname)) {
    const key = isPage ? './index.html' : e.request;
    e.respondWith(
      fetch(isPage ? url.href : e.request, { cache: 'no-cache' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(key, copy));
        return res;
      }).catch(() => caches.match(key))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
