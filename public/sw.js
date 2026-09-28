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

// Only ever a path on this site: anything that resolves to another origin
// (absolute URL, protocol-relative, javascript:, …) becomes /teacher.
function safePath(raw) {
  try {
    const u = new URL(typeof raw === 'string' ? raw : '/teacher', self.location.origin)
    if (u.origin !== self.location.origin) return '/teacher'
    return u.pathname + u.search + u.hash
  } catch {
    return '/teacher'
  }
}

function isTeacherPage(client) {
  try {
    const u = new URL(client.url)
    return u.origin === self.location.origin && (u.pathname === '/teacher' || u.pathname.startsWith('/teacher/'))
  } catch {
    return false
  }
}

async function openAlert(url) {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = wins.find(isTeacherPage)
  if (existing) {
    try {
      const navigated = await existing.navigate(url)
      await (navigated || existing).focus()
      return
    } catch {
      // Not controlled by this worker (or navigation refused): new window.
    }
  }
  await self.clients.openWindow(url)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(openAlert(safePath(event.notification.data && event.notification.data.url)))
})
