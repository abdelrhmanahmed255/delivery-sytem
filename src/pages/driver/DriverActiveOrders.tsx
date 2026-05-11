import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driverOrdersApi } from '../../api/driverOrders';
import { StatusBadge } from '../../components/StatusBadge';

const OrderCard = ({
  order,
  onPickup,
  onComplete,
  isPickingUp,
  isCompleting,
}: {
  order: any;
  onPickup: (id: number) => void;
  onComplete: (id: number) => void;
  isPickingUp: boolean;
  isCompleting: boolean;
}) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const autoPickedUpRef = useRef(false);
  const autoCompletedRef = useRef(false);
  const onPickupRef = useRef(onPickup);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onPickupRef.current = onPickup; });
  useEffect(() => { onCompleteRef.current = onComplete; });

  const totalSecs = (order.delivery_eta_minutes ?? 30) * 60;

  useEffect(() => {
    if (order.status === 'assigned' && !autoPickedUpRef.current) {
      autoPickedUpRef.current = true;
      onPickupRef.current(order.id);
    }
  }, [order.status, order.id]);

  useEffect(() => {
    if (order.status !== 'in_progress') {
      setTimeLeft(null);
      autoCompletedRef.current = false;
      return;
    }
    const key = `pickup_ts_${order.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, Date.now().toString());
    }
    const pickupTs = Number(localStorage.getItem(key));
    const tick = () => {
      const elapsed = Math.floor((Date.now() - pickupTs) / 1000);
      const remaining = Math.max(0, totalSecs - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0 && !autoCompletedRef.current) {
        autoCompletedRef.current = true;
        localStorage.removeItem(key);
        onCompleteRef.current(order.id);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.status, order.id, totalSecs]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const pct = timeLeft !== null ? timeLeft / totalSecs : 1;
  const timerColor = pct > 0.5 ? 'text-green-600' : pct > 0.2 ? 'text-yellow-500' : 'text-red-600';
  const timerBg =
    pct > 0.5 ? 'bg-green-50 border-green-200' :
    pct > 0.2 ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200';

  return (
    <article
      className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
      aria-label={`طلب رقم ${order.code}، الحالة ${order.status}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-500">كود الطلب</p>
          <p className="font-mono font-black text-gray-900 text-xl tracking-wide">{order.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <span className="bg-green-100 text-green-800 font-black px-3 py-1.5 rounded-xl text-lg">
            {order.price} ج.م
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {order.status === 'in_progress' && timeLeft !== null && (
          <div
            className={`rounded-2xl border-2 p-4 text-center ${timerBg} ${pct <= 0.2 ? 'animate-pulse' : ''}`}
            role="timer"
            aria-live="polite"
            aria-label={`الوقت المتبقي للتسليم: ${formatTime(timeLeft)}`}
          >
            <p className="text-sm font-bold text-gray-600 mb-1">⏱ الوقت المتبقي للتسليم</p>
            <p className={`text-7xl font-black tabular-nums tracking-wider ${timerColor}`}>
              {formatTime(timeLeft)}
            </p>
            <p className="text-sm text-gray-500 mt-1">من أصل {order.delivery_eta_minutes} دقيقة</p>
            {timeLeft === 0 && (
              <p className="text-base text-red-600 font-black mt-2">
                ⚠️ انتهى الوقت — جارٍ إنهاء الطلب تلقائياً
              </p>
            )}
          </div>
        )}

        {order.status === 'assigned' && (
          <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold text-blue-800 text-lg">
                {isPickingUp ? 'جارٍ بدء التوصيل...' : 'تم قبول الطلب'}
              </p>
              <p className="text-base text-blue-500">سيبدأ العداد تلقائياً</p>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between bg-gray-50 rounded-xl p-3 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-500">العميل</p>
            <p className="text-xl font-black text-gray-900 break-words whitespace-normal leading-snug">
              {order.customer.full_name}
            </p>
            <p className="text-base text-gray-600 break-words whitespace-normal" dir="ltr">
              {order.customer.phone}
            </p>
          </div>
          <a
            href={`tel:${order.customer.phone}`}
            className="flex-shrink-0 w-16 h-16 bg-green-500 active:bg-green-600 text-white rounded-full flex items-center justify-center shadow-md text-3xl transition-transform active:scale-95"
            aria-label={`اتصال بالعميل ${order.customer.full_name} على الرقم ${order.customer.phone}`}
          >
            <span aria-hidden="true">📞</span>
          </a>
        </div>

        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-sm font-bold text-blue-700 mb-1">📍 نقطة الاستلام</p>
          <p className="text-lg text-gray-900 font-bold leading-snug break-words whitespace-normal">
            {order.pickup_address}
          </p>
          {order.pickup_contact && (
            <p className="text-sm text-gray-600 mt-1 break-words whitespace-normal">
              جهة الاتصال: {order.pickup_contact}
            </p>
          )}
          <a
            href={`https://maps.google.com/maps?q=${encodeURIComponent(order.pickup_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2.5 bg-blue-600 active:bg-blue-700 text-white text-base font-bold px-4 py-2.5 rounded-xl transition-transform active:scale-95"
            aria-label={`فتح خريطة لعنوان الاستلام: ${order.pickup_address}`}
          >
            <span aria-hidden="true">🗺️</span> فتح الخريطة
          </a>
        </div>

        {order.customer?.address && (
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-sm font-bold text-emerald-700 mb-1">🏠 عنوان التوصيل</p>
            <p className="text-lg text-gray-900 font-bold leading-snug break-words whitespace-normal">
              {order.customer.address}
            </p>
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(order.customer.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2.5 bg-emerald-600 active:bg-emerald-700 text-white text-base font-bold px-4 py-2.5 rounded-xl transition-transform active:scale-95"
              aria-label={`فتح خريطة لعنوان التوصيل: ${order.customer.address}`}
            >
              <span aria-hidden="true">🗺️</span> فتح الخريطة
            </a>
          </div>
        )}

        {order.package_description && (
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-sm font-bold text-orange-700 mb-1">📦 محتوى الطرد</p>
            <p className="text-lg text-gray-800 break-words whitespace-pre-wrap leading-relaxed">
              {order.package_description}
            </p>
          </div>
        )}
      </div>

      {order.status === 'in_progress' && (
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              localStorage.removeItem(`pickup_ts_${order.id}`);
              onComplete(order.id);
            }}
            disabled={isCompleting}
            aria-label="تأكيد تسليم الطلب للعميل"
            className="w-full bg-green-500 active:bg-green-700 text-white font-black py-5 rounded-2xl text-2xl shadow-md transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {isCompleting ? '⏳ جارٍ التأكيد...' : '✅ تم التسليم بنجاح'}
          </button>
        </div>
      )}
    </article>
  );
};

export const DriverActiveOrders = () => {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => driverOrdersApi.activeOrders(),
    refetchInterval: 12000,
  });

  const pickupMutation = useMutation({
    mutationFn: (orderId: number) => driverOrdersApi.pickup(orderId),
    onSuccess: (_, orderId) => {
      localStorage.setItem(`pickup_ts_${orderId}`, Date.now().toString());
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (orderId: number) => driverOrdersApi.complete(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeOrders'] }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-medium">جارٍ تحميل طلباتك...</p>
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6 gap-4">
        <span className="text-7xl">✅</span>
        <p className="text-2xl font-black text-gray-700">لا توجد توصيلات نشطة</p>
        <p className="text-gray-400 text-sm">اذهب لتبويب العروض لاستقبال طلبات جديدة</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">توصيلاتي</h2>
        <span className="bg-blue-100 text-blue-700 font-black text-sm px-3 py-1 rounded-full">
          {orders.length}
        </span>
      </div>
      {orders.map((order: any) => (
        <OrderCard
          key={order.id}
          order={order}
          onPickup={(id) => pickupMutation.mutate(id)}
          onComplete={(id) => completeMutation.mutate(id)}
          isPickingUp={pickupMutation.isPending && pickupMutation.variables === order.id}
          isCompleting={completeMutation.isPending && completeMutation.variables === order.id}
        />
      ))}
    </div>
  );
};
