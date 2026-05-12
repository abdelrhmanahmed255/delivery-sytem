import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driversApi } from '../../api/drivers';
import { apiClient } from '../../api/client';
import {
  ensureNotificationPermission,
  getNotificationPermission,
  isPushSupported,
  showOfferNotification,
} from '../../utils/notifications';

/**
 * How often to RE-FIRE the system notification while an offer is still
 * pending and the driver hasn't opened it yet. The system tray is the only
 * thing that wakes a driver whose phone is in their pocket, so we keep
 * nagging until they tap it.
 */
const NOTIFY_REPEAT_INTERVAL_MS = 12_000;

/** How often to re-vibrate / re-beep while an offer is pending. */
const ALARM_REPEAT_INTERVAL_MS = 2_500;

/** Vibration pattern used for both the notification AND navigator.vibrate */
const VIBRATION_PATTERN = [400, 150, 400, 150, 400, 150, 600];

export const DriverHome = () => {
  const queryClient = useQueryClient();
  const [openedOffer, setOpenedOffer] = useState<any>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() => getNotificationPermission());
  // Web Audio context for the in-page alarm beep. Lazily created on first
  // offer so we don't ask for an AudioContext until we actually need one
  // (browsers warn / log when an AC sits idle).
  const audioCtxRef = useRef<AudioContext | null>(null);

  const { data: me } = useQuery({
    queryKey: ['driverMe'],
    queryFn: () => driversApi.me(),
    refetchInterval: 30000,
  });

  const { data: offerSummary } = useQuery({
    queryKey: ['currentOffer'],
    queryFn: () => apiClient.get('/driver/orders/current-offer').then(r => r.data),
    // Poll fast — every 5s — so we discover a new offer almost immediately.
    refetchInterval: 5000,
    // Keep polling even when the tab is in the background — the whole point
    // of notifications is to alert the driver while they're not looking.
    refetchIntervalInBackground: true,
  });

  const pendingOfferId: number | undefined =
    offerSummary?.id ?? offerSummary?.offer_id ?? offerSummary?.order_offer_id;
  // We want repeated alerts ONLY while the driver hasn't opened the offer
  // yet. Once they tap "show details", we stop nagging — the UI itself is
  // alert enough.
  const shouldAlarm = !!pendingOfferId && !openedOffer;

  // ── System-tray notification: fire immediately on a new offer, then
  //    re-fire every NOTIFY_REPEAT_INTERVAL_MS until the driver opens it.
  useEffect(() => {
    if (!shouldAlarm || !pendingOfferId) return;

    const price = offerSummary?.price ?? offerSummary?.order?.price;
    const area =
      offerSummary?.customer?.address ?? offerSummary?.order?.customer?.address ?? '';
    const fireNotification = () => {
      showOfferNotification({
        title: '🔔 طلب توصيل جديد!',
        body: price
          ? `المبلغ ${price} ج.م${area ? ` — ${area}` : ''} — اضغط لعرض التفاصيل`
          : 'لديك عرض توصيل جديد — اضغط لعرض التفاصيل',
        // Same tag + renotify=true → Android replays the alert (sound +
        // vibrate) every time we call it, without stacking multiple
        // entries in the shade.
        tag: `driver-offer-${pendingOfferId}`,
        url: '/driver/home',
      });
    };

    fireNotification();
    const id = setInterval(fireNotification, NOTIFY_REPEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [shouldAlarm, pendingOfferId, offerSummary]);

  // ── In-page audible beep + device vibration while the offer is pending.
  //    This is the secondary alert — even with the screen on and the tab
  //    foregrounded, we want an unmistakable "ringing phone" feeling.
  useEffect(() => {
    if (!shouldAlarm) return;

    const playBeep = () => {
      try {
        if (!audioCtxRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const AC = (window.AudioContext || (window as any).webkitAudioContext);
          if (!AC) return;
          audioCtxRef.current = new AC();
        }
        const ctx = audioCtxRef.current;
        // Some mobile browsers suspend the context until a user gesture;
        // resume() is a no-op if it's already running.
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});

        // Two-tone alarm: short rising "ding-dong" — much harder to ignore
        // than a single beep.
        const now = ctx.currentTime;
        const makeTone = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, now + start);
          gain.gain.exponentialRampToValueAtTime(0.4, now + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + duration + 0.05);
        };
        makeTone(880, 0, 0.25);
        makeTone(1175, 0.28, 0.35);
      } catch {
        // Audio is best-effort; silently ignore on unsupported browsers.
      }

      try {
        navigator.vibrate?.(VIBRATION_PATTERN);
      } catch {
        // Vibration is best-effort.
      }
    };

    playBeep();
    const id = setInterval(playBeep, ALARM_REPEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [shouldAlarm]);

  const availabilityMutation = useMutation({
    mutationFn: (val: boolean) => driversApi.setAvailability(val),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driverMe'] }),
  });

  const openOfferMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/driver/orders/offers/${id}/open`).then(r => r.data),
    onSuccess: (data) => setOpenedOffer(data),
  });

  const acceptOfferMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/driver/orders/offers/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentOffer'] });
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      setOpenedOffer(null);
    },
  });

  const ignoreOfferMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/driver/orders/offers/${id}/ignore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentOffer'] });
      setOpenedOffer(null);
    },
  });

  const isAvailable = me?.is_available;
  const isRestricted = me?.restricted_until && new Date(me.restricted_until) > new Date();

  const offerOrder = openedOffer?.order ?? openedOffer;

  const requestNotifications = async () => {
    const result = await ensureNotificationPermission();
    setNotifPerm(result);
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* ── Enable Android system notifications banner ──── */}
      {isPushSupported() && notifPerm !== 'granted' && (
        <div
          className={`rounded-2xl p-4 border-2 ${
            notifPerm === 'denied'
              ? 'bg-orange-50 border-orange-200'
              : 'bg-blue-50 border-blue-200'
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">🔔</span>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-base ${
                notifPerm === 'denied' ? 'text-orange-800' : 'text-blue-800'
              }`}>
                {notifPerm === 'denied'
                  ? 'تنبيهات الطلبات معطّلة'
                  : 'فعِّل تنبيهات الطلبات'}
              </p>
              <p className={`text-sm mt-1 ${
                notifPerm === 'denied' ? 'text-orange-700' : 'text-blue-700'
              }`}>
                {notifPerm === 'denied'
                  ? 'لن يصلك صوت / إشعار عند وصول طلب جديد. فعِّلها من إعدادات المتصفح للموقع.'
                  : 'احصل على تنبيه في شريط إشعارات الأندرويد فور وصول طلب — حتى لو كان التطبيق في الخلفية.'}
              </p>
              {notifPerm === 'default' && (
                <button
                  onClick={requestNotifications}
                  className="mt-3 bg-blue-600 active:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl active:scale-95"
                >
                  ✅ تفعيل التنبيهات
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Availability toggle ─────────────────────────── */}
      <button
        onClick={() => !isRestricted && availabilityMutation.mutate(!isAvailable)}
        disabled={availabilityMutation.isPending || !!isRestricted}
        className={`w-full rounded-2xl p-5 text-white text-right transition-all active:scale-[0.98] shadow-md ${
          isRestricted ? 'bg-red-600' : isAvailable ? 'bg-green-500' : 'bg-gray-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-75 mb-1">حالتك الحالية — اضغط للتغيير</p>
            <p className="text-3xl font-black">
              {isRestricted ? '⛔ موقوف' : isAvailable ? '🟢 متاح' : '⚫ غير متاح'}
            </p>
            <p className="text-sm opacity-70 mt-1">
              {isRestricted
                ? `حتى ${new Date(me!.restricted_until).toLocaleString('ar-EG')}`
                : isAvailable
                ? 'تستقبل الطلبات الآن'
                : 'اضغط لتفعيل التوفر'}
            </p>
          </div>
          <div className={`relative h-10 w-20 rounded-full border-2 border-white/40 flex-shrink-0 ${isAvailable && !isRestricted ? 'bg-green-400' : 'bg-gray-500'}`}>
            <span className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow-lg transition-all duration-300 ${isAvailable && !isRestricted ? 'left-10' : 'left-1'}`} />
          </div>
        </div>
      </button>

      {/* ── Opened offer details card ───────────────────── */}
      {openedOffer && offerOrder && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Price banner */}
          <div className="bg-green-500 text-white text-center py-5 px-4">
            <p className="text-sm font-semibold opacity-80 mb-1">💰 المبلغ</p>
            <p className="text-6xl font-black leading-none">{offerOrder.price}</p>
            <p className="text-xl font-bold mt-1">جنيه مصري</p>
            <p className="text-sm opacity-70 mt-2">⏱ {offerOrder.delivery_eta_minutes} دقيقة وقت التوصيل</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Pickup */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-sm font-bold text-blue-700 mb-1">📍 نقطة الاستلام</p>
              <p className="text-lg text-gray-900 font-bold leading-snug break-words whitespace-pre-wrap">{offerOrder.pickup_address}</p>
              {offerOrder.pickup_contact && (
                <p className="text-base text-gray-600 mt-1">جهة الاتصال: {offerOrder.pickup_contact}</p>
              )}
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(offerOrder.pickup_address)}`}
                target="_blank" rel="noopener noreferrer"
                aria-label={`فتح خريطة لعنوان الاستلام: ${offerOrder.pickup_address}`}
                className="inline-flex items-center gap-2 mt-3 bg-blue-600 text-white text-base font-bold px-4 py-2.5 rounded-xl active:scale-95"
              >
                <span aria-hidden="true">🗺️</span> افتح الخريطة
              </a>
            </div>

            {/* Delivery area */}
            {offerOrder.customer?.address && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <p className="text-sm font-bold text-emerald-700 mb-1">🏠 منطقة التوصيل</p>
                <p className="text-lg text-gray-900 font-bold break-words whitespace-pre-wrap leading-snug">{offerOrder.customer.address}</p>
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(offerOrder.customer.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  aria-label={`فتح خريطة لمنطقة التوصيل: ${offerOrder.customer.address}`}
                  className="inline-flex items-center gap-2 mt-3 bg-emerald-600 text-white text-base font-bold px-4 py-2.5 rounded-xl active:scale-95"
                >
                  <span aria-hidden="true">🗺️</span> افتح الخريطة
                </a>
              </div>
            )}

            {/* Package */}
            {offerOrder.package_description && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                <p className="text-sm font-bold text-orange-700 mb-1">📦 محتوى الطرد</p>
                <p className="text-lg text-gray-800 break-words whitespace-pre-wrap leading-relaxed">{offerOrder.package_description}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 pt-0 space-y-2">
            <button
              onClick={() => acceptOfferMutation.mutate(openedOffer.id)}
              disabled={acceptOfferMutation.isPending}
              className="w-full bg-green-500 active:bg-green-700 text-white font-black py-5 rounded-2xl text-xl shadow-md transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {acceptOfferMutation.isPending ? '⏳ جارٍ القبول...' : '✅ قبول العرض'}
            </button>
            <button
              onClick={() => ignoreOfferMutation.mutate(openedOffer.id)}
              disabled={ignoreOfferMutation.isPending}
              className="w-full text-red-500 font-bold py-3 text-lg active:opacity-60"
            >
              {ignoreOfferMutation.isPending ? '...' : '✕ رفض العرض'}
            </button>
          </div>
        </div>
      )}

      {/* ── New offer notification card (not yet opened) ─ */}
      {offerSummary && !openedOffer && (
        <div className="bg-blue-600 text-white rounded-2xl overflow-hidden shadow-md">
          <div className="flex items-center gap-4 p-4">
            <div className="relative w-14 h-14 flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
              <div className="relative w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-3xl">🔔</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg">طلب توصيل جديد!</p>
              <p className="text-blue-200 text-sm">اضغط لاكتشاف التفاصيل والسعر</p>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={() => pendingOfferId && openOfferMutation.mutate(pendingOfferId)}
              disabled={openOfferMutation.isPending || !pendingOfferId}
              className="w-full bg-white text-blue-700 font-black py-4 rounded-2xl text-lg shadow-lg transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              {openOfferMutation.isPending ? 'جارٍ الفتح...' : '👁 اعرض التفاصيل والسعر'}
            </button>
            <button
              onClick={() => pendingOfferId && ignoreOfferMutation.mutate(pendingOfferId)}
              disabled={ignoreOfferMutation.isPending || !pendingOfferId}
              className="w-full text-blue-300 font-semibold py-2 text-base active:opacity-60"
            >
              تجاهل هذا الطلب
            </button>
          </div>
        </div>
      )}

      {/* ── Standby / no offer ──────────────────────────── */}
      {!offerSummary && !openedOffer && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center text-center space-y-5">
          {isAvailable ? (
            <>
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-60" />
                <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-emerald-50">
                  <span className="text-5xl">📡</span>
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-gray-800">جاهز للطلبات</p>
                <p className="text-gray-400 text-sm mt-1">سيظهر الطلب هنا فور توفره</p>
              </div>
            </>
          ) : (
            <>
              <div className="relative w-28 h-28 flex items-center justify-center rounded-full bg-gray-50 border-4 border-gray-100">
                <span className="text-5xl opacity-50">😴</span>
              </div>
              <div>
                <p className="text-xl font-black text-gray-800">غير متاح للطلبات</p>
                <p className="text-gray-400 text-sm mt-1">قم بتفعيل التوفر لاستقبال طلبات جديدة</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
