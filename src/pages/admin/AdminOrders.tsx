import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders';
import { driversApi } from '../../api/drivers';
import { customersApi } from '../../api/customers';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';

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
  const LIMIT = 20;

  const [form, setForm] = useState({
    customer_id: '', pickup_address: '', pickup_contact: '',
    package_description: '', price: '0',
    delivery_eta_minutes: '30', distribution_mode: 'auto' as 'auto' | 'manual',
  });

  // Inline customer search/create state
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerCreate, setShowCustomerCreate] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ full_name: '', phone: '', address: '', notes: '' });
  const [customerCreateError, setCustomerCreateError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filterStatus, offset],
    queryFn: () => ordersApi.list({ status: filterStatus || undefined, limit: LIMIT, offset }),
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-list-all'],
    queryFn: () => driversApi.list({ limit: 200 }),
  });

  const { data: customerSearchResults } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: () => customersApi.list({ search: customerSearch, limit: 10 }),
    enabled: customerSearch.trim().length > 1,
  });

  const { data: offersData } = useQuery({
    queryKey: ['offers', showOffers],
    queryFn: () => ordersApi.getOffers(showOffers!),
    enabled: showOffers !== null,
  });

  const createCustomerMutation = useMutation({
    mutationFn: () => customersApi.create({
      full_name: newCustomer.full_name,
      phone: newCustomer.phone,
      address: newCustomer.address,
      notes: newCustomer.notes || undefined,
    }),
    onSuccess: (created: any) => {
      setSelectedCustomer(created);
      setForm(f => ({ ...f, customer_id: String(created.id) }));
      setShowCustomerCreate(false);
      setCustomerSearch(created.full_name);
      setNewCustomer({ full_name: '', phone: '', address: '', notes: '' });
      setCustomerCreateError('');
    },
    onError: () => setCustomerCreateError('فشل إنشاء العميل. يرجى التحقق من البيانات.'),
  });

  const createMutation = useMutation({
    mutationFn: () => ordersApi.create({
      customer_id: Number(form.customer_id),
      pickup_address: form.pickup_address,
      pickup_contact: form.pickup_contact || undefined,
      package_description: form.package_description || undefined,
      price: form.price,
      delivery_eta_minutes: Number(form.delivery_eta_minutes),
      distribution_mode: form.distribution_mode,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setShowCreate(false); },
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

  const resetCreate = () => {
    setForm({ customer_id: '', pickup_address: '', pickup_contact: '', package_description: '', price: '0', delivery_eta_minutes: '30', distribution_mode: 'auto' });
    setCustomerSearch('');
    setSelectedCustomer(null);
    setShowCustomerCreate(false);
    setNewCustomer({ full_name: '', phone: '', address: '', notes: '' });
    setCustomerCreateError('');
    setShowCreate(false);
  };

  const searchResults = customerSearch.trim().length > 1 ? (customerSearchResults?.items ?? []) : [];

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
          {!isLoading && data?.items?.length === 0 && <p className="px-4 py-8 text-center text-gray-400">لا توجد طلبات</p>}
          {data?.items?.map((order: any) => (
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
              {!isLoading && data?.items?.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">لا توجد طلبات</td></tr>
              )}
              {data?.items?.map((order: any) => (
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
        {data && <div className="px-4 pb-4"><Pagination total={data.total} limit={LIMIT} offset={offset} onPageChange={setOffset} /></div>}
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
                              onClick={() => {
                                setSelectedCustomer(c);
                                setForm(f => ({ ...f, customer_id: String(c.id) }));
                                setCustomerSearch(c.full_name);
                              }}
                              className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                            >
                              <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                              <p className="text-xs text-gray-500">{c.phone}</p>
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
                  placeholder="رقم الهاتف *"
                  required={showCustomerCreate}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الاستلام *</label>
              <input
                required
                type="text"
                value={form.pickup_address}
                onChange={e => setForm(f => ({ ...f, pickup_address: e.target.value }))}
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="الاسم أو رقم الهاتف"
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
