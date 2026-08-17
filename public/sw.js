// Minimal service worker: exists only to receive Web Push events while the
// app isn't open, and to focus/open the app when a notification is tapped.
// No offline caching — this app is useless without a live connection anyway.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Donegal Golf', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Donegal Golf', {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) return clients[0].focus()
      return self.clients.openWindow('/')
    })
  )
})
