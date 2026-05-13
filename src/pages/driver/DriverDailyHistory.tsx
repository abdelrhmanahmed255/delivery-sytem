import { useQuery } from '@tanstack/react-query';
import { driverOrdersApi } from '../../api/driverOrders';
import { StatusBadge } from '../../components/StatusBadge';

const ASSIGNED_VIA_AR: Record<string, string> = {
  auto: 'تلقائي',
  manual: 'يدوي',
  offer_accepted: 'قبول عرض',
  reassigned: 'إعادة تعيين',
};

export const DriverDailyHistory = () => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['driver-daily-history'],
    queryFn: () => driverOrdersApi.dailyHistory(),
    refetchInterval: 30_000,
  });

  const entries: any[] = data ?? [];
  const completedCount = entries.filter(e => e.order?.status === 'completed').length;
  const unassignedCount = entries.filter(e => e.unassigned_at).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">سجل اليوم</h2>
          <p className="text-xs text-gray-500 mt-0.5">جميع تعييناتك منذ بداية اليوم</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-colors ${
            isFetching ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className={isFetching ? 'animate-spin inline-block' : 'inline-block'}>↻</span>
          {isFetching ? 'جارٍ...' : 'تحديث'}
        </button>
      </div>

      {/* Summary */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{entries.length}</p>
            <p className="text-xs text-blue-500 font-medium">إجمالي التعيينات</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-green-700">{completedCount}</p>
            <p className="text-xs text-green-500 font-medium">مكتملة</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-orange-700">{unassignedCount}</p>
            <p className="text-xs text-orange-500 font-medium">أُلغي تعيينها</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-medium">لا توجد طلبات مسجلة اليوم بعد.</p>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry: any) => {
          const order = entry.order;
          const isActive = !entry.unassigned_at;
          return (
            <div
              key={entry.assignment_id}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                isActive ? 'border-green-200' : 'border-gray-100'
              }`}
            >
              {/* Status header */}
              <div className={`px-4 py-2 flex items-center justify-between ${isActive ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2">
                  <StatusBadge status={order?.status} />
                  <span className="text-xs text-gray-500 font-mono">{order?.code}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {ASSIGNED_VIA_AR[entry.assigned_via] ?? entry.assigned_via ?? '—'}
                </span>
              </div>

              {/* Order details */}
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{order?.customer?.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{order?.pickup_address}</p>
                    {order?.package_description && (
                      <p className="text-xs text-gray-500 truncate">📦 {order.package_description}</p>
                    )}
                  </div>
                  <p className="text-base font-black text-gray-900 flex-shrink-0">{order?.price} ج.م</p>
                </div>

                {/* Timeline */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 border-t border-gray-50 pt-2">
                  <div>
                    <span className="text-gray-400">تعيين: </span>
                    {entry.assigned_at ? new Date(entry.assigned_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                  <div>
                    <span className="text-gray-400">إلغاء تعيين: </span>
                    {entry.unassigned_at
                      ? new Date(entry.unassigned_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                      : <span className="text-green-600 font-semibold">لا يزال معك</span>}
                  </div>
                  {entry.unassigned_reason && (
                    <div className="col-span-2">
                      <span className="text-gray-400">سبب الإلغاء: </span>
                      {entry.unassigned_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
