import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driversApi } from '../../api/drivers';
import { apiClient } from '../../api/client';

export const DriverHome = () => {
  const queryClient = useQueryClient();
  const [openedOffer, setOpenedOffer] = useState<any>(null);

  const { data: me } = useQuery({
    queryKey: ['driverMe'],
    queryFn: () => driversApi.me(),
    refetchInterval: 30000,
  });

  const { data: offerSummary } = useQuery({
    queryKey: ['currentOffer'],
    queryFn: () => apiClient.get('/driver/orders/current-offer').then(r => r.data),
    refetchInterval: 8000,
  });

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

  // The current-offer endpoint may return the ID under different field names
  const pendingOfferId: number | undefined =
    offerSummary?.id ?? offerSummary?.offer_id ?? offerSummary?.order_offer_id;

  const offerOrder = openedOffer?.order ?? openedOffer;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
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
              <p className="text-xs font-bold text-blue-600 mb-1">📍 نقطة الاستلام</p>
              <p className="text-gray-900 font-bold leading-snug">{offerOrder.pickup_address}</p>
              {offerOrder.pickup_contact && (
                <p className="text-sm text-gray-500 mt-1">جهة الاتصال: {offerOrder.pickup_contact}</p>
              )}
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(offerOrder.pickup_address)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95"
              >
                🗺️ افتح الخريطة
              </a>
            </div>

            {/* Delivery area */}
            {offerOrder.customer?.address && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-emerald-600 mb-1">🏠 منطقة التوصيل</p>
                <p className="text-gray-900 font-semibold">{offerOrder.customer.address}</p>
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(offerOrder.customer.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95"
                >
                  🗺️ افتح الخريطة
                </a>
              </div>
            )}

            {/* Package */}
            {offerOrder.package_description && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-orange-600 mb-1">📦 محتوى الطرد</p>
                <p className="text-gray-800">{offerOrder.package_description}</p>
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
            <>
              <span className="text-7xl">😴</span>
              <div>
                <p className="text-xl font-black text-gray-700">أنت غير متاح</p>
                <p className="text-gray-400 text-sm mt-1">فعّل التوفر من الزر أعلاه لاستقبال الطلبات</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
