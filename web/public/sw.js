/*
 * web/public/sw.js: the background script (service worker) for Call
 * attention alerts.
 *
 * Why: the browser keeps this script ready even when the app is closed.
 * When a push arrives, it shows the notification. Tapping the notification
 * opens the app. (Call attention step 2, Anthony 2026-10-29.)
 *
 * If the app is open and on screen, the floating card and the bell already
 * show the call, so no second notification is shown.
 *
 * Never: cache patient data here. This script only shows notifications.
 */

// ===== 1. Take over straight away after an update =====
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// ===== 2. A push arrived: show it, unless the app is on screen =====
self.addEventListener('push', (event) => {
  let message = { title: 'Call attention', body: 'Someone is calling your room', call_id: 0 }
  try {
    message = Object.assign(message, event.data ? event.data.json() : {})
  } catch {
    // Unreadable message: show the plain words above.
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const onScreen = windows.some((w) => w.visibilityState === 'visible' && w.focused)
      if (onScreen) return undefined
      return self.registration.showNotification(message.title, {
        body: message.body,
        tag: `attention-${message.call_id}`,
        renotify: true,
        requireInteraction: true,
        // A strong pattern, so it is felt in a pocket (Android only).
        vibrate: [400, 150, 400, 150, 800],
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        data: { url: '/' },
      })
    }),
  )
})

// ===== 3. The notification was tapped: open the app =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w)
      if (open) return open.focus()
      return self.clients.openWindow('/')
    }),
  )
})
