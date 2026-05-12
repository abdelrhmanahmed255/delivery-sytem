// Android system-tray notifications for the driver PWA.
//
// How this works:
//   1. registerServiceWorker() installs /sw.js. On Android Chrome, a registered
//      service worker is what lets the page show notifications that appear in
//      the actual Android status bar / notification shade — not just an
//      in-page toast.
//   2. ensureNotificationPermission() prompts the user for the
//      "notifications" permission the first time, and remembers the answer.
//   3. showOfferNotification() asks the service worker to display a
//      notification via `registration.showNotification`. Going through the
//      SW (instead of `new Notification(...)`) is required on Android Chrome
//      for the notification to render in the system tray.
//
// IMPORTANT — what this gets you today (no backend changes required):
//   • While the PWA tab is OPEN (foreground OR background, including the
//     Android recent-apps list), polling will pick up new offers and trigger
//     a system-tray notification.
//   • The notification appears in the system shade, plays sound, vibrates,
//     and shows on the lock screen — indistinguishable from a native app.
//
// What this does NOT get you yet:
//   • Notifications when the browser/PWA is completely killed by the user
//     or by Android's aggressive battery saver. For that, the backend must
//     send a Web Push (VAPID-signed) and the SW's `push` listener (already
//     wired) will fire even without the page running. That's a backend
//     change for later.

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'Notification' in window;

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export const registerServiceWorker = (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) return Promise.resolve(null);
  if (swRegistrationPromise) return swRegistrationPromise;

  swRegistrationPromise = navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => reg)
    .catch((err) => {
      console.warn('[notifications] service worker registration failed', err);
      return null;
    });
  return swRegistrationPromise;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
};

// Prompts only if permission is still 'default'. If the user previously
// granted or denied, this function is a no-op and returns the current state.
export const ensureNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

interface OfferNotificationPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

// Asks the active service worker to display a system-tray notification. If
// permission isn't granted or the SW isn't ready, this resolves silently.
export const showOfferNotification = async (
  payload: OfferNotificationPayload = {}
): Promise<void> => {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  const reg = await registerServiceWorker();
  if (!reg) return;

  // Prefer the SW's showNotification — required for Android system tray.
  // We cast to `any` because the TypeScript DOM lib's NotificationOptions
  // type is conservative and omits Android-only fields like `renotify`,
  // `vibrate`, and `requireInteraction` that the browser actually supports.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      body: payload.body || 'لديك عرض توصيل جديد — اضغط لعرض التفاصيل',
      tag: payload.tag || 'driver-offer',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
      // renotify=true makes Android re-play sound + vibration every time
      // we re-fire a notification with the same tag, which is what the
      // page-side repeat timer relies on.
      renotify: true,
      // Long, attention-grabbing vibration pattern (ms): 4 strong pulses
      // ending with one longer pulse. Tuned for a phone in a pocket.
      vibrate: [400, 150, 400, 150, 400, 150, 600],
      requireInteraction: true,
      data: { url: payload.url || '/driver/home' },
    };
    await reg.showNotification(payload.title || 'طلب جديد', options);
    return;
  } catch (err) {
    console.warn('[notifications] showNotification failed, falling back', err);
  }

  // Last-resort fallback for older browsers — only fires while tab is in
  // foreground and won't appear in system tray on most Androids.
  try {
    new Notification(payload.title || 'طلب جديد', {
      body: payload.body || 'لديك عرض توصيل جديد',
      tag: payload.tag || 'driver-offer',
      icon: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
    });
  } catch {
    // give up
  }
};
