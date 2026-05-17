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

/** Audio context for playing alert sounds with high volume */
let audioCtxRef: AudioContext | null = null;

/** Get or create the audio context */
const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioCtxRef) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AC) return null;
      audioCtxRef = new AC();
    }
    // Resume if suspended (needed on mobile)
    if (audioCtxRef.state === 'suspended') {
      audioCtxRef.resume().catch(() => {});
    }
    return audioCtxRef;
  } catch {
    return null;
  }
};

/**
 * Pre-create the AudioContext on a user gesture so that later calls to
 * playAlertSound / playMessageSound succeed even from background timers.
 * Mobile browsers require an AudioContext to be created (or resumed) during
 * a user-initiated event — once that's done, it stays active.
 */
export const warmUpAudio = (): void => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
};

let audioWarmupInstalled = false;

/**
 * Installs a one-time listener for the first user interaction (touch/click)
 * to warm up the AudioContext. Call this once at app startup.
 */
export const setupAudioWarmup = (): (() => void) => {
  if (audioWarmupInstalled) return () => {};
  audioWarmupInstalled = true;

  const handler = () => {
    warmUpAudio();
    // One-shot: remove after first interaction
    document.removeEventListener('touchstart', handler, true);
    document.removeEventListener('click', handler, true);
  };

  document.addEventListener('touchstart', handler, { capture: true, passive: true });
  document.addEventListener('click', handler, { capture: true });

  return () => {
    document.removeEventListener('touchstart', handler, true);
    document.removeEventListener('click', handler, true);
    audioWarmupInstalled = false;
  };
};

/** Play a high-volume alert sound (multiple beeps) */
export const playAlertSound = (): void => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Play a series of alarm tones (high frequency, rapid pulses)
    const makeTone = (freq: number, start: number, duration: number, volume: number = 0.5) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      // Rapid attack and release for attention-grabbing beeps
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(volume, now + start + 0.05);
      gain.gain.setValueAtTime(volume, now + start + duration - 0.05);
      gain.gain.linearRampToValueAtTime(0, now + start + duration);
      
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };

    // Three rapid high-frequency beeps (very attention-grabbing)
    makeTone(1200, 0, 0.15, 0.6);
    makeTone(1200, 0.2, 0.15, 0.6);
    makeTone(1200, 0.4, 0.15, 0.6);
  } catch {
    // Audio is best-effort
  }
};

/** Play a message notification sound (different tone from order alert) */
export const playMessageSound = (): void => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const makeTone = (freq: number, start: number, duration: number, volume: number = 0.5) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(volume, now + start + 0.05);
      gain.gain.setValueAtTime(volume, now + start + duration - 0.05);
      gain.gain.linearRampToValueAtTime(0, now + start + duration);
      
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };

    // Two-tone message sound (like a notification)
    makeTone(800, 0, 0.1, 0.5);
    makeTone(1000, 0.15, 0.15, 0.5);
  } catch {
    // Audio is best-effort
  }
};

/** Strong vibration pattern for manual orders */
const MANUAL_ORDER_VIBRATION = [300, 100, 300, 100, 300, 200, 500];

/** Vibration pattern for messages */
const MESSAGE_VIBRATION = [200, 100, 200];

/** Trigger strong vibration for manual orders */
export const vibrateManualOrder = (): void => {
  try {
    navigator.vibrate?.(MANUAL_ORDER_VIBRATION);
  } catch {
    // Vibration is best-effort
  }
};

/** Trigger vibration for messages */
export const vibrateMessage = (): void => {
  try {
    navigator.vibrate?.(MESSAGE_VIBRATION);
  } catch {
    // Vibration is best-effort
  }
};

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

/** Show a notification for a manual order with high-priority alerts */
export const showManualOrderNotification = async (payload: OfferNotificationPayload = {}): Promise<void> => {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  const reg = await registerServiceWorker();
  if (!reg) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      body: payload.body || 'تم إرسال طلب توصيل يدوي — اضغط لعرض التفاصيل',
      tag: payload.tag || 'manual-order',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
      renotify: true,
      // Very aggressive vibration pattern for manual orders
      vibrate: [400, 150, 400, 150, 400, 150, 600, 150, 400],
      requireInteraction: true,
      data: { url: payload.url || '/driver/active' },
    };
    await reg.showNotification(payload.title || '🔴 طلب يدوي جديد!', options);
    
    // Also play sound and vibrate
    playAlertSound();
    vibrateManualOrder();
    return;
  } catch (err) {
    console.warn('[notifications] showManualOrderNotification failed', err);
  }

  try {
    new Notification(payload.title || '🔴 طلب يدوي جديد!', {
      body: payload.body || 'تم إرسال طلب توصيل يدوي',
      tag: payload.tag || 'manual-order',
      icon: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
    });
    playAlertSound();
    vibrateManualOrder();
  } catch {
    // give up
  }
};

/** Show a notification for a new message */
export const showMessageNotification = async (payload: OfferNotificationPayload = {}): Promise<void> => {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  const reg = await registerServiceWorker();
  if (!reg) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      body: payload.body || 'لديك رسالة جديدة من المشرف',
      tag: payload.tag || 'new-message',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
      renotify: true,
      vibrate: MESSAGE_VIBRATION,
      requireInteraction: false,
      data: { url: payload.url || '/driver/chat' },
    };
    await reg.showNotification(payload.title || '💬 رسالة جديدة', options);
    
    playMessageSound();
    vibrateMessage();
    return;
  } catch (err) {
    console.warn('[notifications] showMessageNotification failed', err);
  }

  try {
    new Notification(payload.title || '💬 رسالة جديدة', {
      body: payload.body || 'لديك رسالة جديدة',
      tag: payload.tag || 'new-message',
      icon: '/icon-192.svg',
      lang: 'ar',
      dir: 'rtl',
    });
    playMessageSound();
    vibrateMessage();
  } catch {
    // give up
  }
};
