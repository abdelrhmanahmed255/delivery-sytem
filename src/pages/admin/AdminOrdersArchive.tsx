import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders';
import { driversApi } from '../../api/drivers';
import { customersApi } from '../../api/customers';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { OrderDetailsModal } from '../../components/OrderDetailsModal';
import { handlePhonePaste, normalizeIfPhoneLike } from '../../utils/phone';

const ORDER_STATUSES = ['pending', 'offered', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'];

const STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  offered: 'تم العرض',
  assigned: 'تم التعيين',
  in_progress: 'جارٍ التوصيل',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  expired: 'منتهي',
};

// Convert a YYYY-MM-DD date-picker value to an ISO timestamp at local
// midnight. For the "to" bound we add a day so the range is exclusive end.
const dateInputToIsoStart = (v: string): string | undefined => {
  if (!v) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d).toISOString();
};
const dateInputToIsoEnd = (v: string): string | undefined => {
  if (!v) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d + 1).toISOString();
};

export const AdminOrdersArchive = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [offset, setOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Customer filter (server-side customer_id lookup → spans all dates if no
  // date range is set; otherwise constrained to the chosen range too).
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<any>(null);

  // Action modal state (kept identical to the today page so the actions
  // behave the same way for the admin).
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [showCancel, setShowCancel] = useState<number | null>(null);
  const [showOffers, setShowOffers] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [showDetails, setShowDetails] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');

  const LIMIT = 20;

  const listParams = useMemo(() => {
    const params: Record<string, unknown> = {
      status: filterStatus || undefined,
      from: dateInputToIsoStart(fromDate),
      to: dateInputToIsoEnd(toDate),
      limit: LIMIT,
      offset,
    };
    if (customerFilter) params.customer_id = customerFilter.id;
    return params;
  }, [filterStatus, fromDate, toDate, offset, customerFilter]);

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['orders', listParams],
    queryFn: () => ordersApi.list(listParams),
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-list-all'],
    queryFn: () => driversApi.list({ limit: 200 }),
  });

  const { data: customerResults } = useQuery({
    queryKey: ['order-customer-search', customerSearch],
    queryFn: () => customersApi.list({ search: normalizeIfPhoneLike(customerSearch), limit: 10 }),
    enabled: customerSearch.trim().length > 1 && !customerFilter,
  });

  const { data: offersData } = useQuery({
    queryKey: ['offers', showOffers],
    queryFn: () => ordersApi.getOffers(showOffers!),
    enabled: showOffers !== null,
  });

  const activeDrivers = driversData?.items?.filter((d: any) => d.approval_status === 'approved' && d.is_available && d.is_active) ?? [];

  // Same optimistic mutation pattern as the today page → snappy UI even on
  // a slow backend, with automatic rollback on error.
  const assignMutation = useMutation({
    mutationFn: () => ordersApi.assign(showAssign!, Number(assignDriverId)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueriesData({ queryKey: ['orders'] });
      const driver = activeDrivers.find((d: any) => d.id === Number(assignDriverId));
      queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((o: any) =>
            o.id === showAssign ? { ...o, status: 'assigned', assigned_driver: driver ?? o.assigned_driver } : o
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous?.forEach(([key, value]: any) => queryClient.setQueryData(key, value));
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); },
    onSuccess: () => { setShowAssign(null); setAssignDriverId(''); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(showCancel!, cancelReason || undefined),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueriesData({ queryKey: ['orders'] });
      queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((o: any) =>
            o.id === showCancel ? { ...o, status: 'cancelled' } : o
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous?.forEach(([key, value]: any) => queryClient.setQueryData(key, value));
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); },
    onSuccess: () => { setShowCancel(null); setCancelReason(''); },
  });

  const customerOptions = customerSearch.trim().length > 1 ? (customerResults?.items ?? []) : [];
  const items: any[] = data?.items ?? [];

  const lastUpdatedLabel = dataUpdatedAt > 0
    ? new Date(dataUpdatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const hasAnyFilter = !!(filterStatus || fromDate || toDate || customerFilter);

  const resetFilters = () => {
    setFilterStatus('');
    setFromDate('');
    setToDate('');
    setCustomerFilter(null);
    setCustomerSearch('');
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">سجل كل الطلبات</h2>
          <p className="text-xs text-gray-500 mt-0.5">📚 استعرض الطلبات السابقة وابحث بأي معيار</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdatedLabel && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              آخر تحديث: {lastUpdatedLabel}
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="تحديث القائمة بدون إعادة تحميل الصفحة"
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-colors ${
              isFetching
                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className={isFetching ? 'animate-spin inline-block' : 'inline-block'}>↻</span>
            {isFetching ? 'جارٍ...' : 'تحديث'}
          </button>
          <button
            onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            📅 طلبات اليوم
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
        {/* Date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">من تاريخ</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setOffset(0); }}
              max={toDate || undefined}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setOffset(0); }}
              min={fromDate || undefined}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Customer filter */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">فلتر العميل</label>
          {customerFilter ? (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-bold text-indigo-900">{customerFilter.full_name}</p>
                <p className="text-xs text-indigo-700" dir="ltr">{customerFilter.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => { setCustomerFilter(null); setCustomerSearch(''); setOffset(0); }}
                className="text-xs text-red-600 hover:text-red-800 font-semibold"
              >
                إزالة الفلتر ✕
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                onPaste={handlePhonePaste(setCustomerSearch)}
                placeholder="🔍 ابحث عن عميل (الاسم أو رقم الهاتف)..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {customerSearch.trim().length > 1 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {customerOptions.length > 0 ? (
                    customerOptions.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setCustomerFilter(c); setCustomerSearch(''); setOffset(0); }}
                        className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                        <p className="text-xs text-gray-500" dir="ltr">{c.phone}</p>
                        {c.address && <p className="text-xs text-gray-400 truncate">{c.address}</p>}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-gray-500">لا توجد نتائج لـ "{customerSearch}"</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => { setFilterStatus(''); setOffset(0); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!filterStatus ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            الكل
          </button>
          {ORDER_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setOffset(0); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filterStatus === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {STATUS_AR[s] ?? s}
            </button>
          ))}
        </div>

        {hasAnyFilter && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {data ? `${data.total} طلب يطابق الفلاتر الحالية` : 'جارٍ الحساب...'}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-800"
            >
              مسح كل الفلاتر ✕
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading && <p className="px-4 py-8 text-center text-gray-400">جارٍ تحميل الطلبات...</p>}
          {!isLoading && items.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400">لا توجد طلبات مطابقة.</p>
          )}
          {items.map((order: any) => (
            <div key={order.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{order.customer.full_name}</p>
                  <p className="text-xs text-gray-400">{order.customer.phone}</p>
                  <p className="text-xs font-mono text-gray-300">{order.code}</p>
                  {order.created_at && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      {new Date(order.created_at).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={order.status} />
                  <span className="text-sm font-bold text-gray-900">{order.price} ج.م</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(order)}
                className="w-full text-right text-sm text-gray-700 bg-gray-50 active:bg-gray-100 rounded-lg px-3 py-2 truncate hover:bg-gray-100 transition-colors"
                title="انقر لعرض كل التفاصيل"
              >
                {order.pickup_address}
              </button>
              {order.package_description && (
                <button
                  type="button"
                  onClick={() => setShowDetails(order)}
                  className="w-full text-right text-xs text-gray-600 bg-orange-50 active:bg-orange-100 rounded-lg px-3 py-2 truncate hover:bg-orange-100 transition-colors"
                  title="انقر لعرض كل تفاصيل الطرد"
                >
                  📦 {order.package_description}
                </button>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>المندوب: {order.assigned_driver?.full_name ?? '—'}</span>
                <span>{order.delivery_eta_minutes} د</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowDetails(order)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-semibold border border-gray-200">تفاصيل</button>
                <button onClick={() => setShowOffers(order.id)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium">العروض</button>
                {['pending', 'offered'].includes(order.status) && (
                  <button onClick={() => { setShowAssign(order.id); setAssignDriverId(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium">تعيين مندوب</button>
                )}
                {!['completed', 'cancelled', 'expired'].includes(order.status) && (
                  <button onClick={() => { setShowCancel(order.id); setCancelReason(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-medium">إلغاء</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['التاريخ', 'العميل', 'العنوان', 'الحالة', 'المندوب', 'السعر', 'الإجراءات'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">جارٍ تحميل الطلبات...</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">لا توجد طلبات مطابقة.</td></tr>
              )}
              {items.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {order.created_at
                      ? new Date(order.created_at).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                    <p className="text-[10px] font-mono text-gray-300 mt-0.5">{order.code}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-800">{order.customer.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{order.customer.phone}</p>
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate cursor-pointer hover:text-blue-700 hover:underline"
                    onClick={() => setShowDetails(order)}
                    title={order.pickup_address}
                  >
                    {order.pickup_address}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{order.assigned_driver?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{order.price} ج.م</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => setShowDetails(order)}
                        className="text-xs px-2 py-1 rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium border border-gray-200"
                        title="عرض كل تفاصيل الطلب"
                      >
                        تفاصيل
                      </button>
                      <button
                        onClick={() => setShowOffers(order.id)}
                        className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                      >
                        العروض
                      </button>
                      {['pending', 'offered'].includes(order.status) && (
                        <button
                          onClick={() => { setShowAssign(order.id); setAssignDriverId(''); }}
                          className="text-xs px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium"
                        >
                          تعيين
                        </button>
                      )}
                      {!['completed', 'cancelled', 'expired'].includes(order.status) && (
                        <button
                          onClick={() => { setShowCancel(order.id); setCancelReason(''); }}
                          className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.total > LIMIT && (
          <div className="px-4 pb-4">
            <Pagination total={data.total} limit={LIMIT} offset={offset} onPageChange={setOffset} />
          </div>
        )}
      </div>

      {/* Full Order Details Modal */}
      {showDetails && (
        <OrderDetailsModal order={showDetails} onClose={() => setShowDetails(null)} />
      )}

      {/* Assign Driver Modal */}
      {showAssign !== null && (
        <Modal title="تعيين مندوب يدوياً" onClose={() => assignMutation.isPending ? null : setShowAssign(null)}>
          <div className="space-y-4">
            <select
              value={assignDriverId}
              onChange={e => setAssignDriverId(e.target.value)}
              disabled={assignMutation.isPending}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
            >
              <option value="">اختر مندوباً متاحاً...</option>
              {activeDrivers.map((d: any) => (
                <option key={d.id} value={d.id}>{d.full_name} — {d.phone}</option>
              ))}
            </select>
            {activeDrivers.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">لا يوجد مناديب معتمدون ومتاحون حالياً.</p>
            )}
            {assignMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                ❌ فشل تعيين المندوب. تحقق من الاتصال وحاول مرة أخرى.
              </p>
            )}
            <button
              onClick={() => assignMutation.mutate()}
              disabled={!assignDriverId || assignMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {assignMutation.isPending && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {assignMutation.isPending ? 'جارٍ التعيين...' : 'تعيين المندوب'}
            </button>
          </div>
        </Modal>
      )}

      {/* Cancel Order Modal */}
      {showCancel !== null && (
        <Modal title="إلغاء الطلب" onClose={() => cancelMutation.isPending ? null : setShowCancel(null)}>
          <div className="space-y-4">
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              disabled={cancelMutation.isPending}
              placeholder="سبب الإلغاء (اختياري)..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
            />
            {cancelMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                ❌ فشل إلغاء الطلب. تحقق من الاتصال وحاول مرة أخرى.
              </p>
            )}
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {cancelMutation.isPending && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {cancelMutation.isPending ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
            </button>
          </div>
        </Modal>
      )}

      {/* Offers Modal */}
      {showOffers !== null && (
        <Modal title={`سجل العروض — طلب #${showOffers}`} onClose={() => setShowOffers(null)}>
          <div className="space-y-3">
            {offersData?.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">لم يُرسل أي عرض بعد.</p>
            )}
            {offersData?.map((offer: any) => {
              const offerDriver = driversData?.items?.find((d: any) => d.id === offer.driver_id);
              const viewed = !!offer.opened_at;
              const responded = !!offer.responded_at;

              let viewBadge: { label: string; bg: string; text: string };
              if (offer.status === 'accepted') {
                viewBadge = { label: '✅ شاهد وقبل', bg: 'bg-green-100', text: 'text-green-700' };
              } else if (offer.status === 'ignored' || offer.status === 'revoked') {
                viewBadge = { label: '🚫 شاهد ورفض', bg: 'bg-red-100', text: 'text-red-700' };
              } else if (offer.status === 'expired' && viewed) {
                viewBadge = { label: '👁 شاهد — انتهت المهلة', bg: 'bg-orange-100', text: 'text-orange-700' };
              } else if (offer.status === 'expired' && !viewed) {
                viewBadge = { label: '⏰ لم يشاهد — انتهت المهلة', bg: 'bg-gray-100', text: 'text-gray-500' };
              } else if (offer.status === 'skipped') {
                viewBadge = { label: '⏭ تخطى', bg: 'bg-gray-100', text: 'text-gray-500' };
              } else if (viewed) {
                viewBadge = { label: '👁 شاهد — لم يرد بعد', bg: 'bg-yellow-100', text: 'text-yellow-700' };
              } else {
                viewBadge = { label: '📨 أُرسل — لم يُشاهد', bg: 'bg-blue-50', text: 'text-blue-500' };
              }

              return (
                <div key={offer.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {offerDriver?.full_name ?? `مندوب #${offer.driver_id}`}
                      </p>
                      {offerDriver?.phone && (
                        <p className="text-xs text-gray-400 mt-0.5">{offerDriver.phone}</p>
                      )}
                    </div>
                    <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${viewBadge.bg} ${viewBadge.text}`}>
                      {viewBadge.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs text-gray-500 border-t border-gray-50 pt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">📤 أُرسل العرض</span>
                      <span>{new Date(offer.offered_at).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">⏳ تنتهي المهلة</span>
                      <span>{new Date(offer.expires_at).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {viewed ? (
                      <div className="flex justify-between font-semibold text-gray-700">
                        <span>👁 فتح العرض</span>
                        <span>{new Date(offer.opened_at).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-gray-300">
                        <span>👁 فتح العرض</span>
                        <span>لم يُفتح</span>
                      </div>
                    )}
                    {responded ? (
                      <div className="flex justify-between font-semibold text-gray-700">
                        <span>💬 وقت الرد</span>
                        <span>{new Date(offer.responded_at).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-gray-300">
                        <span>💬 وقت الرد</span>
                        <span>—</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
};
