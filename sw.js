// TRIT Service Worker v3
const CACHE = 'trit-v3';
const CORE  = ['/', '/index.html', '/app.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('script.google.com'))   return;
  if (url.includes('razorpay'))            return;
  if (url.includes('youtube'))             return;
  if (url.includes('googlesyndication'))   return;
  if (url.includes('allorigins'))          return;
  if (url.includes('finance.yahoo'))       return;
  if (url.includes('fonts.googleapis'))    return;
  if (url.includes('fonts.gstatic'))       return;
  if (url.includes('manifest.json'))       return;
  if (url.includes('unpkg.com'))           return;
  if (url.includes('cdn.jsdelivr'))        return;
  if (url.includes('rss2json'))            return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request)
          .then(r => r || caches.match('/app.html') || caches.match('/'))
      )
  );
});
