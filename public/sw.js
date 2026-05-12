/* eslint-disable no-restricted-globals */
// Service worker for the delivery driver PWA.
//
// Responsibilities:
//  1. Display Android system-tray notifications via `registration.showNotification`.
//     This is what makes the notification appear as a real Android system
//     notification (in the status bar / notification shade / lock screen)
//     instead of an in-page toast.
//  2. Handle real Web Push events (for future backend integration). When the
//     backend later starts sending VAPID-signed pushes via FCM, this listener
//     will show them even if the PWA is fully closed.
//  3. Re-focus or open the PWA when the driver taps a notification.
//
// We deliberately do NOT precache any of the Vite build output — that's
// brittle with hashed asset names. The browser's HTTP cache is enough.

const CACHE_NAME = 'delivery-driver-v1';

self.addEventListener('install', (event) => {
  // Activate immediately on next page load so the new SW takes over fast.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of any already-open clients (tabs) right away.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Message API: the page can ask the SW to show a notification by posting
// { type: 'show-offer-notification', payload: { title, body, tag, data } }.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'show-offer-notification') return;
  const { title, body, tag, url } = data.payload || {};
  event.waitUntil(
    self.registration.showNotification(title || 'طلب جديد', {
      body: body || 'لديك عرض توصيل جديد',
      tag: tag || 'driver-offer',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
      // Re-alerts every time even if a notification with the same tag exists.
      // Combined with the page-side repeat timer this lets us "ring" the
      // driver's phone every ~12s until they tap it.
      renotify: true,
      // Longer, more aggressive vibration so a driver with the phone in
      // their pocket can actually feel it.
      vibrate: [400, 150, 400, 150, 400, 150, 600],
      requireInteraction: true,
      data: { url: url || '/driver/home' },
    })
  );
});

// Push event from the backend (future: Web Push via VAPID/FCM). The payload
// is expected to be JSON: { title, body, url }. Falls back to a default
// "new offer" notification if the payload is empty or malformed.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'طلب جديد', body: event.data ? event.data.text() : 'لديك عرض توصيل جديد' };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'طلب جديد', {
      body: payload.body || 'لديك عرض توصيل جديد',
      tag: payload.tag || 'driver-offer',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
      renotify: true,
      vibrate: [400, 150, 400, 150, 400, 150, 600],
      requireInteraction: true,
      data: { url: payload.url || '/driver/home' },
    })
  );
});

// When the driver taps the notification, open or focus the driver home tab.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/driver/home';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // Re-focus an existing tab if we already have one open.
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.pathname.startsWith('/driver')) {
            await client.focus();
            client.postMessage({ type: 'notification-clicked', url: targetUrl });
            return;
          }
        } catch {
          // ignore bad URLs
        }
      }
      // Otherwise open a fresh tab/PWA window.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
