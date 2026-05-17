import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { driversApi } from '../../api/drivers';
import { apiClient } from '../../api/client';
import {
  ensureNotificationPermission,
  getNotificationPermission,
  isPushSupported,
} from '../../utils/notifications';

export const DriverHome = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() => getNotificationPermission());
  // Tracks availability locally so that backend-side automatic changes (e.g.
  // the server marking the driver unavailable after order assignment) do NOT
  // silently flip the toggle. Only a manual press updates this value.
  const [localAvailable, setLocalAvailable] = useState<boolean | null>(null);
  // Error shown when the driver tries to go available but has no open shift.
  const [noShiftError, setNoShiftError] = useState(false);


  const { data: me } = useQuery({
    queryKey: ['driverMe'],
    queryFn: () => driversApi.me(),
    refetchInterval: 30000,
  });

  // Initialise local availability from the server exactly once (first load).
  // After that, only manual toggle updates it — server polling is ignored.
  useEffect(() => {
    if (me?.is_available !== undefined && localAvailable === null) {
      setLocalAvailable(me.is_available);
    }
  }, [me?.is_available, localAvailable]);

  // Read the current offer from the shared react-query cache.
  // The actual polling + notification/sound/vibration is handled globally
  // by useOfferNotifications() in DriverLayout, so it works from ANY page.
  const { data: offerSummary } = useQuery({
    queryKey: ['currentOffer'],
    queryFn: () => apiClient.get('/driver/orders/current-offer').then(r => r.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const pendingOfferId: number | undefined =
    offerSummary?.id ?? offerSummary?.offer_id ?? offerSummary?.order_offer_id;

  const availabilityMutation = useMutation({
    mutationFn: (val: boolean) => driversApi.setAvailability(val),
    onMutate: (val: boolean) => {
      // Optimistically update local state immediately on press.
      setLocalAvailable(val);
      setNoShiftError(false);
    },
    onError: (err: any, val: boolean) => {
      // Revert local state if the server rejected the change.
      setLocalAvailable(!val);
      queryClient.invalidateQueries({ queryKey: ['driverMe'] });
      // 400 business_rule_violation → driver has no admin-opened shift.
      const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;
      if (err?.response?.status === 400 && code === 'business_rule_violation') {
        setNoShiftError(true);
      }
    },
    onSuccess: () => {
      setNoShiftError(false);
      queryClient.invalidateQueries({ queryKey: ['driverMe'] });
    },
  });

  const seeAndAcceptMutation = useMutation({
    mutationFn: async (id: number) => {
      // Backend might require the offer to be 'opened' before 'accepted', so we call both
      try {
        await apiClient.post(`/driver/orders/offers/${id}/open`);
      } catch (err) {
        // Ignore errors on open, attempt to accept anyway
      }
      return apiClient.post(`/driver/orders/offers/${id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentOffer'] });
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      // Redirect directly to active orders so the driver can see the full details
      navigate('/driver/active');
    },
  });

  const ignoreOfferMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/driver/orders/offers/${id}/ignore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentOffer'] });
    },
  });

  const isAvailable = localAvailable ?? me?.is_available;
  const isRestricted = me?.restricted_until && new Date(me.restricted_until) > new Date();

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

      {/* ── No open shift error ────────────────────────── */}
      {noShiftError && (
        <div
          role="alert"
          className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3"
        >
          <span className="text-3xl flex-shrink-0" aria-hidden="true">🔒</span>
          <div className="flex-1 min-w-0">
            <p className="font-black text-base text-red-800">لا توجد وردية مفتوحة</p>
            <p className="text-sm text-red-700 mt-1">
              لا يمكنك تفعيل التوفر الآن. يجب على المسؤول فتح وردية لك أولاً.
            </p>
          </div>
          <button
            onClick={() => setNoShiftError(false)}
            aria-label="إغلاق"
            className="text-red-400 text-xl leading-none active:opacity-60 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Availability toggle ─────────────────────────── */}
      <button
        onClick={() => !isRestricted && availabilityMutation.mutate(!isAvailable)}
        disabled={availabilityMutation.isPending || !!isRestricted || localAvailable === null}
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

      {/* ── New offer notification card (not yet opened) ─ */}
      {offerSummary && (
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
              onClick={() => pendingOfferId && seeAndAcceptMutation.mutate(pendingOfferId)}
              disabled={seeAndAcceptMutation.isPending || !pendingOfferId}
              className="w-full bg-white text-blue-700 font-black py-4 rounded-2xl text-lg shadow-lg transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              {seeAndAcceptMutation.isPending ? 'جارٍ القبول...' : '👁✅ رؤية وقبول الطلب'}
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
      {!offerSummary && (
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
