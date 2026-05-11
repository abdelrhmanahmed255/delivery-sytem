import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders';
import { driversApi } from '../../api/drivers';
import { customersApi } from '../../api/customers';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { handlePhonePaste, normalizeIfPhoneLike, normalizeEgyptPhone } from '../../utils/phone';

const ORDER_STATUSES = ['pending', 'offered', 'assigned', 'in_progress', 'completed', 'cancelled', 'expired'];
const ETA_OPTIONS = [5,10,15, 30, 45, 60, 90, 120];

const STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  offered: 'تم العرض',
  assigned: 'تم التعيين',
  in_progress: 'جارٍ التوصيل',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  expired: 'منتهي',
};

// Get today's local-date boundaries [start, end) as ISO strings.
const getTodayBoundsIso = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const AdminOrders = () => {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<number | null>(null);
  const [showCancel, setShowCancel] = useState<number | null>(null);
  const [showOffers, setShowOffers] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');

  // Date scope: by default show "today only"; toggle to view full history.
  const [showAllDates, setShowAllDates] = useState(false);

  // Order-page customer filter (search by name / phone → show all their orders).
  const [orderCustomerSearch, setOrderCustomerSearch] = useState('');
  const [orderCustomerFilter, setOrderCustomerFilter] = useState<any>(null);

  // Available-drivers banner expand/collapse state.
  const [driversBannerOpen, setDriversBannerOpen] = useState(false);

  const LIMIT = 20;
  // When showing today only we fetch a wider window so the client-side
  // filter still has access to most of the day's orders without pagination.
  const TODAY_LIMIT = 200;

  const [form, setForm] = useState({
    customer_id: '', pickup_address: '', pickup_contact: '',
    package_description: '', price: '0',
    delivery_eta_minutes: '30', distribution_mode: 'auto' as 'auto' | 'manual',
  });
  // Tracks whether the user manually edited pickup_address — used so the
  // customer's name auto-fills the address only until the admin overrides it.
  const [pickupAddressTouched, setPickupAddressTouched] = useState(false);

  // Inline customer search/create state
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerCreate, setShowCustomerCreate] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ full_name: '', phone: '', address: '', notes: '' });
  const [customerCreateError, setCustomerCreateError] = useState('');

  // Today bounds recomputed on every render so a day rollover during a long
  // open session is reflected automatically on the next refetch.
  const today = getTodayBoundsIso();
  // The active filter mode controls which list query runs and how pagination
  // behaves. Customer filter wins (show all their orders, all dates).
  const todayMode = !showAllDates && !orderCustomerFilter;

  const listParams = useMemo(() => {
    if (orderCustomerFilter) {
      return { customer_id: orderCustomerFilter.id, status: filterStatus || undefined, limit: LIMIT, offset };
    }
    if (todayMode) {
      return { status: filterStatus || undefined, from: today.start, to: today.end, limit: TODAY_LIMIT, offset: 0 };
    }
    return { status: filterStatus || undefined, limit: LIMIT, offset };
  }, [orderCustomerFilter, todayMode, filterStatus, offset, today.start, today.end]);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', listParams],
    queryFn: () => ordersApi.list(listParams),
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-list-all'],
    queryFn: () => driversApi.list({ limit: 200 }),
    refetchInterval: 30_000,
  });

  const { data: customerSearchResults } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: () => customersApi.list({ search: normalizeIfPhoneLike(customerSearch), limit: 10 }),
    enabled: customerSearch.trim().length > 1,
  });

  // Autocomplete for the orders-page customer filter.
  const { data: orderCustomerResults } = useQuery({
    queryKey: ['order-customer-search', orderCustomerSearch],
    queryFn: () => customersApi.list({ search: normalizeIfPhoneLike(orderCustomerSearch), limit: 10 }),
    enabled: orderCustomerSearch.trim().length > 1 && !orderCustomerFilter,
  });

  const { data: offersData } = useQuery({
    queryKey: ['offers', showOffers],
    queryFn: () => ordersApi.getOffers(showOffers!),
    enabled: showOffers !== null,
  });

  const createCustomerMutation = useMutation({
    mutationFn: () => customersApi.create({
      full_name: newCustomer.full_name,
      phone: normalizeEgyptPhone(newCustomer.phone) || newCustomer.phone,
      address: newCustomer.address,
      notes: newCustomer.notes || undefined,
    }),
    onSuccess: (created: any) => {
      pickCustomer(created);
      setShowCustomerCreate(false);
      setNewCustomer({ full_name: '', phone: '', address: '', notes: '' });
      setCustomerCreateError('');
    },
    onError: () => setCustomerCreateError('فشل إنشاء العميل. يرجى التحقق من البيانات.'),
  });

  const createMutation = useMutation({
    mutationFn: () => ordersApi.create({
      customer_id: Number(form.customer_id),
      pickup_address: form.pickup_address,
      pickup_contact: form.pickup_contact ? (normalizeEgyptPhone(form.pickup_contact) || form.pickup_contact) : undefined,
      package_description: form.package_description || undefined,
      price: form.price,
      delivery_eta_minutes: Number(form.delivery_eta_minutes),
      distribution_mode: form.distribution_mode,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); resetCreate(); },
  });

  const assignMutation = useMutation({
    mutationFn: () => ordersApi.assign(showAssign!, Number(assignDriverId)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setShowAssign(null); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(showCancel!, cancelReason || undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setShowCancel(null); setCancelReason(''); },
  });

  const activeDrivers = driversData?.items?.filter((d: any) => d.approval_status === 'approved' && d.is_available && d.is_active) ?? [];

  // Selecting a customer (either from search or after inline create) also
  // pre-fills the pickup address with the customer's name — many customers
  // share an address with their own name, and the admin can still edit it.
  const pickCustomer = (c: any) => {
    setSelectedCustomer(c);
    setForm(f => ({
      ...f,
      customer_id: String(c.id),
      pickup_address: pickupAddressTouched && f.pickup_address ? f.pickup_address : c.full_name,
    }));
    setCustomerSearch(c.full_name);
  };

  const resetCreate = () => {
    setForm({ customer_id: '', pickup_address: '', pickup_contact: '', package_description: '', price: '0', delivery_eta_minutes: '30', distribution_mode: 'auto' });
    setCustomerSearch('');
    setSelectedCustomer(null);
    setShowCustomerCreate(false);
    setNewCustomer({ full_name: '', phone: '', address: '', notes: '' });
    setCustomerCreateError('');
    setPickupAddressTouched(false);
    setShowCreate(false);
  };

  const searchResults = customerSearch.trim().length > 1 ? (customerSearchResults?.items ?? []) : [];
  const orderCustomerOptions = orderCustomerSearch.trim().length > 1 ? (orderCustomerResults?.items ?? []) : [];

  // Client-side guard for the today filter — if the backend doesn't honor the
  // from/to params, we still cull anything outside today's window here.
  const visibleOrders = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = data?.items ?? [];
    if (!todayMode) return items;
    const startMs = new Date(today.start).getTime();
    const endMs = new Date(today.end).getTime();
    return items.filter((o) => {
      const t = o.created_at ? new Date(o.created_at).getTime() : NaN;
      return Number.isFinite(t) && t >= startMs && t < endMs;
    });
  }, [data, todayMode, today.start, today.end]);

  const todayLabel = useMemo(
    () => new Date(today.start).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [today.start]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">الطلبات</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + طلب جديد
        </button>
      </div>

      {/* Available drivers banner */}
      <div className="bg-gradient-to-l from-emerald-50 via-green-50 to-white border border-emerald-100 rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setDriversBannerOpen(o => !o)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-emerald-50/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`relative inline-flex h-3 w-3`}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${activeDrivers.length > 0 ? 'bg-emerald-400 opacity-75 animate-ping' : 'bg-gray-300'}`}></span>
              <span className={`relative inline-flex h-3 w-3 rounded-full ${activeDrivers.length > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
            </span>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-800">
                المناديبون المتاحون: <span className="text-emerald-700">{activeDrivers.length}</span>
              </p>
              <p className="text-xs text-gray-500">
                {activeDrivers.length === 0
                  ? 'لا يوجد مندوب متاح حالياً لاستلام طلبات جديدة.'
                  : 'جاهزون لاستلام الطلبات الآن.'}
              </p>
            </div>
          </div>
          <span className="text-emerald-700 text-xs font-semibold">
            {driversBannerOpen ? 'إخفاء ▴' : 'عرض ▾'}
          </span>
        </button>
        {driversBannerOpen && (
          <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t border-emerald-100">
            {activeDrivers.length === 0 && (
              <p className="text-sm text-gray-500 col-span-full py-3 text-center">
                لا يوجد مندوب متاح حالياً.
              </p>
            )}
            {activeDrivers.map((d: any) => (
              <div
                key={d.id}
                className="flex items-center gap-2 bg-white border border-emerald-100 rounded-lg px-3 py-2"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{d.full_name}</p>
                  <p className="text-xs text-gray-500 truncate" dir="ltr">{d.phone}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search-by-customer + scope toggle */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            {orderCustomerFilter ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs text-indigo-700 font-medium">عرض كل طلبات العميل:</p>
                  <p className="text-sm font-bold text-indigo-900">{orderCustomerFilter.full_name}</p>
                  <p className="text-xs text-indigo-700" dir="ltr">{orderCustomerFilter.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setOrderCustomerFilter(null); setOrderCustomerSearch(''); setOffset(0); }}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold"
                >
                  إزالة الفلتر ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={orderCustomerSearch}
                  onChange={e => setOrderCustomerSearch(e.target.value)}
                  onPaste={handlePhonePaste(setOrderCustomerSearch)}
                  placeholder="🔍 ابحث عن عميل (الاسم أو رقم الهاتف) لعرض كل طلباته..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {orderCustomerSearch.trim().length > 1 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {orderCustomerOptions.length > 0 ? (
                      orderCustomerOptions.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setOrderCustomerFilter(c); setOrderCustomerSearch(''); setOffset(0); }}
                          className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                          <p className="text-xs text-gray-500" dir="ltr">{c.phone}</p>
                          {c.address && <p className="text-xs text-gray-400 truncate">{c.address}</p>}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-gray-500">لا توجد نتائج لـ "{orderCustomerSearch}"</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!orderCustomerFilter && (
              <>
                <span className="text-xs text-gray-500 whitespace-nowrap hidden sm:inline">
                  {todayMode ? `📅 ${todayLabel}` : '📚 عرض كامل السجل'}
                </span>
                {todayMode ? (
                  // Default view: today only. One button to switch to all-time history.
                  <button
                    type="button"
                    onClick={() => { setShowAllDates(true); setOffset(0); }}
                    className="text-xs font-semibold px-3 py-2 rounded-lg border bg-white text-gray-700 border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    title="عرض جميع الطلبات السابقة"
                  >
                    📋 عرض كل الطلبات
                  </button>
                ) : (
                  // History view: one button to return to today's auto-rolling list.
                  <button
                    type="button"
                    onClick={() => { setShowAllDates(false); setOffset(0); }}
                    className="text-xs font-semibold px-3 py-2 rounded-lg border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 transition-colors whitespace-nowrap"
                    title="العودة لعرض طلبات اليوم تلقائياً"
                  >
                    📅 عرض اليوم فقط
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {!orderCustomerFilter && (
          <p className={`text-xs rounded-lg px-3 py-1.5 inline-block ${todayMode ? 'text-emerald-700 bg-emerald-50' : 'text-gray-600 bg-gray-50'}`}>
            {todayMode
              ? `📅 يتم عرض طلبات اليوم فقط (${visibleOrders.length}). تنتقل القائمة تلقائياً لليوم التالي عند انتهاء اليوم الحالي.`
              : `📚 يتم عرض كامل سجل الطلبات${data ? ` (${data.total} طلب)` : ''}. اضغط "عرض اليوم فقط" للعودة لعرض اليوم.`}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading && <p className="px-4 py-8 text-center text-gray-400">جارٍ تحميل الطلبات...</p>}
          {!isLoading && visibleOrders.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400">
              {todayMode ? `لا توجد طلبات بعد لـ ${todayLabel}` : 'لا توجد طلبات'}
            </p>
          )}
          {visibleOrders.map((order: any) => (
            <div key={order.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{order.customer.full_name}</p>
                  <p className="text-xs text-gray-400">{order.customer.phone}</p>
                  <p className="text-xs font-mono text-gray-300">{order.code}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={order.status} />
                  <span className="text-sm font-bold text-gray-900">{order.price} ج.م</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 truncate">{order.pickup_address}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>المندوب: {order.assigned_driver?.full_name ?? '—'}</span>
                <span>{order.delivery_eta_minutes} د</span>
              </div>
              <div className="flex flex-wrap gap-2">
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
                {['العميل', 'تفاصيل الطلب', 'العنوان', 'الحالة', 'المندوب', 'السعر', 'الوقت', 'الإجراءات'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">جارٍ تحميل الطلبات...</td></tr>
              )}
              {!isLoading && visibleOrders.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {todayMode ? `لا توجد طلبات بعد لـ ${todayLabel}` : 'لا توجد طلبات'}
                </td></tr>
              )}
              {visibleOrders.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-800">{order.customer.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{order.customer.phone}</p>
                    <p className="text-xs font-mono text-gray-300 mt-0.5">{order.code}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[160px]">
                    {order.package_description
                      ? <p className="text-sm text-gray-700 truncate">{order.package_description}</p>
                      : <p className="text-xs text-gray-300">—</p>}
                    {order.pickup_contact && <p className="text-xs text-gray-400 mt-0.5">📞 {order.pickup_contact}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate">{order.pickup_address}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{order.assigned_driver?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{order.price} ج.م</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{order.delivery_eta_minutes} د</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
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
        {data && !todayMode && (
          <div className="px-4 pb-4">
            <Pagination total={data.total} limit={LIMIT} offset={offset} onPageChange={setOffset} />
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreate && (
        <Modal title="إنشاء طلب جديد" onClose={resetCreate}>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>

            {/* Customer search/select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العميل *</label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">{selectedCustomer.full_name}</p>
                    <p className="text-xs text-emerald-600">{selectedCustomer.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedCustomer(null); setForm(f => ({ ...f, customer_id: '' })); setCustomerSearch(''); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    تغيير
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerCreate(false); }}
                    onPaste={handlePhonePaste(v => { setCustomerSearch(v); setShowCustomerCreate(false); })}
                    placeholder="ابحث بالاسم أو رقم الهاتف..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {/* Dropdown results */}
                  {customerSearch.trim().length > 1 && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.length > 0 ? (
                        <>
                          {searchResults.map((c: any) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => pickCustomer(c)}
                              className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                            >
                              <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                              <p className="text-xs text-gray-500" dir="ltr">{c.phone}</p>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => { setShowCustomerCreate(true); setCustomerSearch(''); }}
                            className="w-full text-right px-3 py-2 text-sm text-emerald-700 font-medium hover:bg-emerald-50 border-t border-gray-100"
                          >
                            + إنشاء عميل جديد
                          </button>
                        </>
                      ) : (
                        <div className="px-3 py-3">
                          <p className="text-sm text-gray-500 mb-2">لا توجد نتائج لـ "{customerSearch}"</p>
                          <button
                            type="button"
                            onClick={() => { setShowCustomerCreate(true); setCustomerSearch(''); }}
                            className="text-sm text-emerald-700 font-semibold hover:underline"
                          >
                            + إنشاء عميل جديد
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inline new customer form */}
            {showCustomerCreate && (
              <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-emerald-800 text-sm">إنشاء عميل جديد</p>
                <input
                  type="text"
                  value={newCustomer.full_name}
                  onChange={e => setNewCustomer(n => ({ ...n, full_name: e.target.value }))}
                  placeholder="الاسم الكامل *"
                  required={showCustomerCreate}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer(n => ({ ...n, phone: e.target.value }))}
                  onPaste={handlePhonePaste(v => setNewCustomer(n => ({ ...n, phone: v })))}
                  onBlur={e => {
                    const v = normalizeEgyptPhone(e.target.value);
                    if (v && v !== e.target.value) setNewCustomer(n => ({ ...n, phone: v }));
                  }}
                  placeholder="رقم الهاتف *  (مثال: 01XXXXXXXXX)"
                  required={showCustomerCreate}
                  dir="ltr"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 text-right"
                />
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={e => setNewCustomer(n => ({ ...n, address: e.target.value }))}
                  placeholder="العنوان *"
                  required={showCustomerCreate}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={newCustomer.notes}
                  onChange={e => setNewCustomer(n => ({ ...n, notes: e.target.value }))}
                  placeholder="ملاحظات (اختياري)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                {customerCreateError && <p className="text-xs text-red-600">{customerCreateError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowCustomerCreate(false); setCustomerCreateError(''); }}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCustomer.full_name || !newCustomer.phone || !newCustomer.address) {
                        setCustomerCreateError('يرجى ملء الحقول المطلوبة.');
                        return;
                      }
                      createCustomerMutation.mutate();
                    }}
                    disabled={createCustomerMutation.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
                  >
                    {createCustomerMutation.isPending ? 'جارٍ الإنشاء...' : 'إنشاء العميل'}
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">عنوان الاستلام *</label>
                {selectedCustomer && !pickupAddressTouched && (
                  <span className="text-xs text-emerald-600 font-medium">↺ تلقائي من اسم العميل — يمكنك التعديل</span>
                )}
              </div>
              <input
                required
                type="text"
                value={form.pickup_address}
                onChange={e => { setForm(f => ({ ...f, pickup_address: e.target.value })); setPickupAddressTouched(true); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="مثال: شارع ٢٦ يوليو، الجيزة"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">جهة الاتصال عند الاستلام</label>
              <input
                type="text"
                value={form.pickup_contact}
                onChange={e => setForm(f => ({ ...f, pickup_contact: e.target.value }))}
                onPaste={handlePhonePaste(v => setForm(f => ({ ...f, pickup_contact: v })))}
                onBlur={e => {
                  const v = normalizeEgyptPhone(e.target.value);
                  if (v && v !== e.target.value) setForm(f => ({ ...f, pickup_contact: v }));
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="الاسم أو رقم الهاتف (يدعم الصق من واتساب)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">وصف الطرد</label>
              <textarea
                value={form.package_description}
                onChange={e => setForm(f => ({ ...f, package_description: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="ماذا يوجد في الطرد؟"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السعر (ج.م)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوقت المتوقع (دقائق) *</label>
                <select
                  required
                  value={form.delivery_eta_minutes}
                  onChange={e => setForm(f => ({ ...f, delivery_eta_minutes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {ETA_OPTIONS.map(v => <option key={v} value={v}>{v} دقيقة</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">طريقة التوزيع</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="dist_mode" value="auto" checked={form.distribution_mode === 'auto'} onChange={() => setForm(f => ({ ...f, distribution_mode: 'auto' }))} />
                  <span className="text-sm font-medium">تلقائي</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="dist_mode" value="manual" checked={form.distribution_mode === 'manual'} onChange={() => setForm(f => ({ ...f, distribution_mode: 'manual' }))} />
                  <span className="text-sm font-medium">يدوي</span>
                </label>
              </div>
            </div>
            {createMutation.error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">فشل إنشاء الطلب. يرجى التحقق من البيانات.</p>
            )}
            <button
              type="submit"
              disabled={createMutation.isPending || !form.customer_id}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'جارٍ الإنشاء...' : 'إنشاء الطلب'}
            </button>
          </form>
        </Modal>
      )}

      {/* Assign Driver Modal */}
      {showAssign !== null && (
        <Modal title="تعيين مندوب يدوياً" onClose={() => setShowAssign(null)}>
          <div className="space-y-4">
            <select
              value={assignDriverId}
              onChange={e => setAssignDriverId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">اختر مندوباً متاحاً...</option>
              {activeDrivers.map((d: any) => (
                <option key={d.id} value={d.id}>{d.full_name} — {d.phone}</option>
              ))}
            </select>
            {activeDrivers.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">لا يوجد مناديب معتمدون ومتاحون حالياً.</p>
            )}
            <button
              onClick={() => assignMutation.mutate()}
              disabled={!assignDriverId || assignMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {assignMutation.isPending ? 'جارٍ التعيين...' : 'تعيين المندوب'}
            </button>
          </div>
        </Modal>
      )}

      {/* Cancel Order Modal */}
      {showCancel !== null && (
        <Modal title="إلغاء الطلب" onClose={() => setShowCancel(null)}>
          <div className="space-y-4">
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              placeholder="سبب الإلغاء (اختياري)..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            />
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
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

              // Determine view-state label and color
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
                // pending + viewed = driver opened but hasn't responded yet
                viewBadge = { label: '👁 شاهد — لم يرد بعد', bg: 'bg-yellow-100', text: 'text-yellow-700' };
              } else {
                viewBadge = { label: '📨 أُرسل — لم يُشاهد', bg: 'bg-blue-50', text: 'text-blue-500' };
              }

              return (
                <div
                  key={offer.id}
                  className="border border-gray-100 rounded-xl p-4 space-y-3"
                >
                  {/* Driver name + view-state badge */}
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

                  {/* Timeline */}
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
