// My Book Lab service worker: teacher alerts only (spec §12.4).
// Deliberately minimal — push + notificationclick. No fetch handler and no
// caching, so it can never serve a stale app or intercept a request.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'My Book Lab'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/favicon-192.png',
      data: { url: typeof data.url === 'string' ? data.url : '/teacher' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Only ever a path on this site — never an absolute URL from a payload.
  const raw = event.notification.data && event.notification.data.url
  const url = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/teacher'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w && 'navigate' in w) {
          return w.navigate(url).then((c) => (c || w).focus())
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
