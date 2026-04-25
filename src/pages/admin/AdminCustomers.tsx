import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../api/customers';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';

export const AdminCustomers = () => {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const LIMIT = 20;

  const [form, setForm] = useState({ full_name: '', phone: '', address: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, offset],
    queryFn: () => customersApi.list({ search: search || undefined, limit: LIMIT, offset }),
  });

  const createMutation = useMutation({
    mutationFn: () => customersApi.create({ full_name: form.full_name, phone: form.phone, address: form.address, notes: form.notes || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowCreate(false); setForm({ full_name: '', phone: '', address: '', notes: '' }); },
  });

  const updateMutation = useMutation({
    mutationFn: () => customersApi.update(editing.id, { full_name: form.full_name, phone: form.phone, address: form.address, notes: form.notes || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setEditing(null); },
  });

  const openEdit = (c: any) => {
    setForm({ full_name: c.full_name, phone: c.phone, address: c.address, notes: c.notes ?? '' });
    setEditing(c);
  };

  const CustomerForm = ({ onSubmit, loading, label }: { onSubmit: () => void; loading: boolean; label: string }) => (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      {([['full_name', 'الاسم الكامل *', 'text'], ['phone', 'رقم الهاتف *', 'tel'], ['address', 'العنوان *', 'text']] as [string, string, string][]).map(([key, lbl, type]) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{lbl}</label>
          <input
            type={type}
            required
            value={(form as any)[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'جارٍ الحفظ...' : label}
      </button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">العملاء</h2>
        <button
          onClick={() => { setShowCreate(true); setForm({ full_name: '', phone: '', address: '', notes: '' }); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + عميل جديد
        </button>
      </div>

      {/* Search */}
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setOffset(0); }}>
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف أو العنوان..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <button type="submit" className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700">بحث</button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setOffset(0); }} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">مسح</button>
        )}
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading && <p className="px-4 py-8 text-center text-gray-400">جارٍ التحميل...</p>}
          {!isLoading && data?.items?.length === 0 && <p className="px-4 py-8 text-center text-gray-400">لا يوجد عملاء.</p>}
          {data?.items?.map((c: any) => (
            <div key={c.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{c.full_name}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                  <p className="text-sm text-gray-600 mt-1">{c.address}</p>
                  {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}
                </div>
                <button onClick={() => openEdit(c)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium flex-shrink-0">تعديل</button>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['الاسم', 'الهاتف', 'العنوان', 'ملاحظات', 'الإجراءات'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">جارٍ التحميل...</td></tr>}
              {!isLoading && data?.items?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">لا يوجد عملاء.</td></tr>}
              {data?.items?.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{c.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{c.address}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 max-w-[150px] truncate">{c.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                    >
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <div className="px-4 pb-4"><Pagination total={data.total} limit={LIMIT} offset={offset} onPageChange={setOffset} /></div>}
      </div>

      {showCreate && (
        <Modal title="عميل جديد" onClose={() => setShowCreate(false)}>
          <CustomerForm onSubmit={() => createMutation.mutate()} loading={createMutation.isPending} label="إنشاء العميل" />
        </Modal>
      )}
      {editing && (
        <Modal title={`تعديل — ${editing.full_name}`} onClose={() => setEditing(null)}>
          <CustomerForm onSubmit={() => updateMutation.mutate()} loading={updateMutation.isPending} label="حفظ التغييرات" />
        </Modal>
      )}
    </div>
  );
};
