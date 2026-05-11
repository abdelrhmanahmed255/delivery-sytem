import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';

interface OrderDetailsModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
  onClose: () => void;
}

const STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  offered: 'تم العرض',
  assigned: 'تم التعيين',
  in_progress: 'جارٍ التوصيل',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  expired: 'منتهي',
};

const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

// Renders the full, untruncated details of a single order. Used by the admin
// orders + archive pages when the row is clicked or the "details" button is
// pressed — gives the admin a single place to read everything (long package
// descriptions, full pickup address, customer info, timing, etc.) without
// breaking the responsive table layout.
export const OrderDetailsModal = ({ order, onClose }: OrderDetailsModalProps) => {
  if (!order) return null;

  return (
    <Modal title={`تفاصيل الطلب — ${order.code ?? `#${order.id}`}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {/* Status & price summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-xl p-3 col-span-1">
            <p className="text-xs text-gray-400">الحالة</p>
            <div className="mt-1"><StatusBadge status={order.status} /></div>
            <p className="text-[11px] text-gray-500 mt-1">{STATUS_AR[order.status] ?? order.status}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 col-span-1">
            <p className="text-xs text-emerald-700">السعر</p>
            <p className="text-lg font-black text-emerald-800 mt-1">{order.price} ج.م</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 col-span-1">
            <p className="text-xs text-blue-700">المدة المتوقعة</p>
            <p className="text-lg font-black text-blue-800 mt-1">{order.delivery_eta_minutes} د</p>
          </div>
        </div>

        {/* Customer */}
        <div className="border border-gray-100 rounded-xl p-3 space-y-1">
          <p className="text-xs font-bold text-gray-500">العميل</p>
          <p className="text-base font-bold text-gray-900 break-words">{order.customer?.full_name ?? '—'}</p>
          <p className="text-sm text-gray-600 break-words" dir="ltr">{order.customer?.phone ?? '—'}</p>
          {order.customer?.address && (
            <p className="text-xs text-gray-500 break-words leading-relaxed mt-1">📍 {order.customer.address}</p>
          )}
        </div>

        {/* Pickup address — full, never truncated */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-xs font-bold text-blue-700 mb-1">عنوان الاستلام</p>
          <p className="text-sm font-semibold text-gray-900 break-words whitespace-pre-wrap leading-relaxed">
            {order.pickup_address}
          </p>
          {order.pickup_contact && (
            <p className="text-xs text-gray-600 mt-1">📞 جهة الاتصال: {order.pickup_contact}</p>
          )}
        </div>

        {/* Package description — full, never truncated */}
        {order.package_description && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="text-xs font-bold text-orange-700 mb-1">وصف الطرد</p>
            <p className="text-sm text-gray-800 break-words whitespace-pre-wrap leading-relaxed">
              {order.package_description}
            </p>
          </div>
        )}

        {/* Driver */}
        <div className="border border-gray-100 rounded-xl p-3">
          <p className="text-xs font-bold text-gray-500">المندوب المُعيَّن</p>
          {order.assigned_driver ? (
            <>
              <p className="text-base font-bold text-gray-900 break-words mt-1">{order.assigned_driver.full_name}</p>
              {order.assigned_driver.phone && (
                <p className="text-sm text-gray-600" dir="ltr">{order.assigned_driver.phone}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">— لم يُعيَّن مندوب بعد</p>
          )}
        </div>

        {/* Timeline */}
        <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
          {[
            ['أُنشئ الطلب', order.created_at],
            ['آخر تحديث', order.updated_at],
            ['تم التعيين', order.assigned_at],
            ['بدء التوصيل', order.picked_up_at],
            ['تم التسليم', order.completed_at],
            ['تم الإلغاء', order.cancelled_at],
          ]
            .filter(([, v]) => !!v)
            .map(([label, v]) => (
              <div key={label as string} className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-gray-500">{label as string}</span>
                <span className="text-xs text-gray-700 font-medium">{fmtDateTime(v as string)}</span>
              </div>
            ))}
        </div>

        {/* Cancellation reason (if any) */}
        {order.cancellation_reason && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs font-bold text-red-700 mb-1">سبب الإلغاء</p>
            <p className="text-sm text-red-800 break-words whitespace-pre-wrap leading-relaxed">
              {order.cancellation_reason}
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50"
        >
          إغلاق
        </button>
      </div>
    </Modal>
  );
};
