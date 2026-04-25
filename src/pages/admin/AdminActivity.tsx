import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../../api/admins';
import { Pagination } from '../../components/Pagination';

const ACTOR_LABELS: Record<string, string> = {
  admin: 'مسؤول',
  driver: 'مندوب',
  system: 'النظام',
  customer: 'عميل',
};

const ACTION_LABELS: Record<string, string> = {
  // auth
  admin_login: 'تسجيل دخول مسؤول',
  driver_login: 'تسجيل دخول مندوب',
  // orders
  order_created: 'إنشاء طلب',
  order_cancelled: 'إلغاء طلب',
  order_assigned: 'تعيين طلب',
  order_pickup: 'استلام طلب',
  order_completed: 'اكتمال طلب',
  offer_sent: 'إرسال عرض',
  offer_opened: 'فتح عرض',
  offer_accepted: 'قبول عرض',
  offer_ignored: 'تجاهل عرض',
  offer_expired: 'انتهاء عرض',
  // drivers
  driver_registered: 'تسجيل مندوب',
  driver_approved: 'موافقة على مندوب',
  driver_rejected: 'رفض مندوب',
  driver_restricted: 'إيقاف مندوب',
  driver_unrestricted: 'رفع إيقاف مندوب',
  driver_availability_changed: 'تغيير حالة التوفر',
  driver_profile_updated: 'تحديث بيانات مندوب',
  driver_password_changed: 'تغيير كلمة مرور مندوب',
  // customers
  customer_created: 'إنشاء عميل',
  customer_updated: 'تحديث بيانات عميل',
  // settings
  settings_updated: 'تحديث إعدادات النظام',
  admin_password_changed: 'تغيير كلمة مرور مسؤول',
};

const TARGET_LABELS: Record<string, string> = {
  order: 'طلب',
  driver: 'مندوب',
  customer: 'عميل',
  admin: 'مسؤول',
  offer: 'عرض',
  settings: 'إعدادات',
};

export const AdminActivity = () => {
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const { data, isLoading } = useQuery({
    queryKey: ['activity', offset],
    queryFn: () => activityApi.list({ limit: LIMIT, offset }),
  });

  const formatDate = (d: string) => new Date(d).toLocaleString('ar-EG');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">سجل النشاط</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading && <p className="px-4 py-8 text-center text-gray-400">جارٍ التحميل...</p>}
          {data?.items?.map((log: any) => (
            <div key={log.id} className="p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${log.actor_type === 'admin' ? 'bg-emerald-100 text-emerald-700' : log.actor_type === 'driver' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {ACTOR_LABELS[log.actor_type] ?? log.actor_type}{log.actor_id ? ` #${log.actor_id}` : ''}
                </span>
                <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{ACTION_LABELS[log.action] ?? log.action}</p>
              {log.target_type && (
                <p className="text-xs text-gray-500">{TARGET_LABELS[log.target_type] ?? log.target_type} #{log.target_id}</p>
              )}
              {log.details && (
                <p className="text-xs text-gray-400 break-words">{typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}</p>
              )}
            </div>
          ))}
        </div>
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['الوقت', 'الفاعل', 'الإجراء', 'الهدف', 'التفاصيل'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">جارٍ التحميل...</td></tr>}
              {data?.items?.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${log.actor_type === 'admin' ? 'bg-emerald-100 text-emerald-700' : log.actor_type === 'driver' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {ACTOR_LABELS[log.actor_type] ?? log.actor_type}
                    </span>
                    {log.actor_id && <span className="mr-1 text-gray-500">#{log.actor_id}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {log.target_type
                      ? `${TARGET_LABELS[log.target_type] ?? log.target_type} #${log.target_id}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px]">
                    {log.details
                      ? <span className="break-words">{typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}</span>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <div className="px-4 pb-4"><Pagination total={data.total} limit={LIMIT} offset={offset} onPageChange={setOffset} /></div>}
      </div>
    </div>
  );
};
