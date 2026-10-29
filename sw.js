/* B&B Lager – Offline-Speicher
   App-Dateien: zuerst Netz (max. 3 s), sonst gespeicherte Version.
   Bibliotheken (PDF-Leser, Texterkennung, Schriften): einmal laden, dann aus dem Speicher.
   Dropbox wird nie zwischengespeichert. */
const APP_CACHE = 'bb-lager-app-v7';
const LIB_CACHE = 'bb-lager-lib-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const LIB_HOSTS = /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|tessdata\.projectnaptha\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP_CACHE && k !== LIB_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Bibliotheken vorab laden, damit Belege auch offline gelesen werden können */
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'warm') return;
  e.waitUntil(caches.open(LIB_CACHE).then(c => Promise.all(e.data.urls.map(u =>
    c.match(u).then(hit => hit || fetch(u, { mode: 'cors' }).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {}))
  ))));
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/dropbox(api)?\.com$/.test(url.hostname) || url.hostname.endsWith('dropbox.com')) return;

  // Eigene App-Dateien: Netz zuerst, damit Updates ankommen; bei Funkloch die gespeicherte Version
  if (url.origin === self.location.origin) {
    e.respondWith(
      withTimeout(fetch(req), 3000)
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
    return;
  }

  // Bibliotheken und Schriften: aus dem Speicher, sonst laden und merken
  if (LIB_HOSTS.test(url.hostname)) {
    e.respondWith(
      caches.open(LIB_CACHE).then(c => c.match(req.url).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req.url, res.clone());
        return res;
      })))
    );
  }
});
