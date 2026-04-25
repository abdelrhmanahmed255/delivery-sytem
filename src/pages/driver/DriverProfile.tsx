import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driversApi } from '../../api/drivers';

export const DriverProfile = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [pwSection, setPwSection] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [editForm, setEditForm] = useState<any>({});

  const { data: me, isLoading } = useQuery({
    queryKey: ['driverMe'],
    queryFn: () => driversApi.me(),
  });

  const openEdit = () => {
    setEditForm({
      full_name: me?.full_name ?? '',
      legal_arabic_name: me?.legal_arabic_name ?? '',
      phone: me?.phone ?? '',
      vehicle_plate: me?.vehicle_plate ?? '',
    });
    setEditing(true);
    setMsg(null);
  };

  const updateMutation = useMutation({
    mutationFn: () => driversApi.updateMe(editForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverMe'] });
      setEditing(false);
      setMsg({ text: '✅ تم تحديث بياناتك بنجاح', ok: true });
    },
    onError: () => setMsg({ text: 'فشل التحديث. حاول مرة أخرى.', ok: false }),
  });

  const changePwMutation = useMutation({
    mutationFn: () => driversApi.changeMyPassword(pwForm.current_password, pwForm.new_password),
    onSuccess: () => {
      setPwForm({ current_password: '', new_password: '' });
      setPwSection(false);
      setMsg({ text: '✅ تم تغيير كلمة المرور بنجاح', ok: true });
    },
    onError: () => setMsg({ text: 'كلمة المرور الحالية غير صحيحة.', ok: false }),
  });

  const availabilityMutation = useMutation({
    mutationFn: (val: boolean) => driversApi.setAvailability(val),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['driverMe'] }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isRestricted = me?.restricted_until && new Date(me.restricted_until) > new Date();
  const statusText = me?.approval_status === 'approved'
    ? { label: 'معتمد', cls: 'bg-green-400 text-white' }
    : me?.approval_status === 'pending'
    ? { label: 'قيد المراجعة', cls: 'bg-yellow-400 text-gray-900' }
    : { label: me?.approval_status ?? '', cls: 'bg-red-400 text-white' };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* ── Availability — BIG prominent card ─────────────────── */}
      <button
        onClick={() => !isRestricted && availabilityMutation.mutate(!me?.is_available)}
        disabled={availabilityMutation.isPending || !!isRestricted}
        className={`w-full rounded-2xl p-5 text-white text-right shadow-md transition-all active:scale-[0.98] disabled:opacity-70 ${
          isRestricted ? 'bg-red-600' : me?.is_available ? 'bg-green-500' : 'bg-gray-700'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm opacity-75 mb-1">
              {isRestricted ? 'حسابك موقوف' : 'حالتك — اضغط للتبديل'}
            </p>
            <p className="text-3xl font-black">
              {isRestricted ? '⛔ موقوف' : me?.is_available ? '🟢 متاح' : '⚫ غير متاح'}
            </p>
            <p className="text-sm opacity-70 mt-1">
              {isRestricted
                ? `حتى ${new Date(me!.restricted_until).toLocaleString('ar-EG')}`
                : me?.is_available
                ? 'تستقبل الطلبات الآن'
                : 'اضغط لتفعيل التوفر'}
            </p>
            {isRestricted && me?.restriction_reason && (
              <p className="text-sm opacity-70 mt-0.5">السبب: {me.restriction_reason}</p>
            )}
          </div>
          {/* Toggle indicator */}
          {!isRestricted && (
            <div className={`flex-shrink-0 relative h-10 w-20 rounded-full border-2 border-white/40 ${me?.is_available ? 'bg-green-400' : 'bg-gray-500'}`}>
              <span className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow-lg transition-all duration-300 ${me?.is_available ? 'left-10' : 'left-1'}`} />
            </div>
          )}
        </div>
      </button>

      {/* ── Profile card ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Avatar header */}
        <div className="bg-gradient-to-l from-blue-700 to-blue-500 p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/25 flex items-center justify-center text-3xl font-black text-white shadow-lg">
              {me?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="text-white min-w-0">
              <p className="text-xl font-black truncate">{me?.full_name}</p>
              <p className="text-blue-200 text-sm truncate">{me?.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${statusText.cls}`}>
                  {statusText.label}
                </span>
                {(me?.consecutive_strikes ?? 0) > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-400 text-white font-bold">
                    {me.consecutive_strikes} مخالفة
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile details / edit form */}
        {!editing ? (
          <div className="p-4">
            <div className="divide-y divide-gray-50">
              {[
                ['📱', 'الهاتف', me?.phone],
                ['🏍️', 'المركبة', me?.vehicle_type || 'دراجة نارية'],
                ['🔢', 'رقم اللوحة', me?.vehicle_plate || 'غير محدد'],
                ['🆔', 'رقم البطاقة الوطنية', me?.national_id_number || 'غير محدد'],
              ].map(([icon, label, value]) => (
                <div key={label as string} className="flex items-center justify-between py-3">
                  <span className="text-gray-500 text-sm flex items-center gap-2">
                    <span>{icon as string}</span>
                    {label as string}
                  </span>
                  <span className="text-gray-900 font-semibold text-sm text-left">{value as string}</span>
                </div>
              ))}
            </div>
            <button
              onClick={openEdit}
              className="mt-3 w-full border-2 border-blue-500 text-blue-600 font-bold py-3.5 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors"
            >
              ✏️ تعديل البيانات
            </button>
          </div>
        ) : (
          <form className="p-4 space-y-3" onSubmit={e => { e.preventDefault(); updateMutation.mutate(); }}>
            {([
              ['full_name', 'الاسم الكامل (إنجليزي)', 'text'],
              ['legal_arabic_name', 'الاسم بالعربي', 'text'],
              ['phone', 'رقم الهاتف', 'tel'],
              ['vehicle_plate', 'رقم اللوحة', 'text'],
            ] as [string, string, string][]).map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
                <input
                  type={type}
                  value={editForm[key] ?? ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl active:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 active:bg-blue-700"
              >
                {updateMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Change password ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => { setPwSection(p => !p); setMsg(null); }}
          className="w-full flex items-center justify-between px-4 py-4 text-gray-700"
        >
          <span className="font-bold flex items-center gap-2">🔐 تغيير كلمة المرور</span>
          <span className="text-gray-400 text-sm">{pwSection ? '▲ إغلاق' : '▼ فتح'}</span>
        </button>
        {pwSection && (
          <form className="px-4 pb-4 space-y-3" onSubmit={e => { e.preventDefault(); changePwMutation.mutate(); }}>
            <input
              type="password"
              required
              placeholder="كلمة المرور الحالية"
              value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="كلمة المرور الجديدة (٨ أحرف على الأقل)"
              value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={changePwMutation.isPending}
              className="w-full bg-gray-800 active:bg-gray-900 text-white font-bold py-4 rounded-xl disabled:opacity-50"
            >
              {changePwMutation.isPending ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
            </button>
          </form>
        )}
      </div>

      {/* ── Feedback message ───────────────────────────────────── */}
      {msg && (
        <div className={`p-4 rounded-2xl text-center font-bold text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
};

