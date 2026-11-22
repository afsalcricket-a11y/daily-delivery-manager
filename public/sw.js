// Caches the app shell so the interface opens offline. Data (Supabase) is never cached.
const CACHE = 'ddm-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icons/icon-192.png'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return r })
        .catch(() => caches.match('./'))
    )
    return
  }
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) } return r }).catch(() => hit)
      return hit || net
    })
  )
})
