import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driversApi } from '../../api/drivers';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';

// ─── Egyptian National ID Parser ──────────────────────────────────────────────
const EGYPT_GOVERNORATES: Record<string, string> = {
  '01': 'القاهرة', '02': 'الإسكندرية', '03': 'بورسعيد', '04': 'السويس',
  '11': 'دمياط', '12': 'الدقهلية', '13': 'الشرقية', '14': 'القليوبية',
  '15': 'كفر الشيخ', '16': 'الغربية', '17': 'المنوفية', '18': 'البحيرة',
  '19': 'الإسماعيلية', '21': 'الجيزة', '22': 'بني سويف', '23': 'الفيوم',
  '24': 'المنيا', '25': 'أسيوط', '26': 'سوهاج', '27': 'قنا',
  '28': 'أسوان', '29': 'الأقصر', '31': 'البحر الأحمر', '32': 'الوادي الجديد',
  '33': 'مطروح', '34': 'شمال سيناء', '35': 'جنوب سيناء', '88': 'خارج الجمهورية',
};

function parseEgyptianId(id: string) {
  if (!id || id.length !== 14 || !/^\d{14}$/.test(id)) return null;
  const century = id[0] === '2' ? '19' : '20';
  const yy = id.slice(1, 3);
  const mm = id.slice(3, 5);
  const dd = id.slice(5, 7);
  const govCode = id.slice(7, 9);
  const seq = id.slice(9, 13);
  const genderDigit = parseInt(seq[2], 10);
  const birthDate = `${century}${yy}-${mm}-${dd}`;
  const birthDateFormatted = new Date(birthDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return {
    birthDate: birthDateFormatted,
    age: isNaN(age) || age < 0 ? '—' : `${age} سنة`,
    gender: genderDigit % 2 !== 0 ? 'ذكر' : 'أنثى',
    governorate: EGYPT_GOVERNORATES[govCode] ?? `كود ${govCode}`,
  };
}
// ──────────────────────────────────────────────────────────────────────────────

export const AdminDrivers = () => {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetails, setShowDetails] = useState<any>(null);
  const [showRestrict, setShowRestrict] = useState<any>(null);
  const [showReject, setShowReject] = useState<any>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [restrictMinutes, setRestrictMinutes] = useState('60');
  const [restrictReason, setRestrictReason] = useState('');
  const LIMIT = 20;

  const [form, setForm] = useState({
    email: '', phone: '', full_name: '', legal_arabic_name: '',
    national_id_number: '', password: '', vehicle_type: '', vehicle_plate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', offset],
    queryFn: () => driversApi.list({ limit: LIMIT, offset }),
  });

  const createMutation = useMutation({
    mutationFn: () => driversApi.create({ ...form, vehicle_type: form.vehicle_type || undefined, vehicle_plate: form.vehicle_plate || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['drivers'] }); setShowCreate(false); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => driversApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => driversApi.reject(showReject.id, rejectNote || undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['drivers'] }); setShowReject(null); setRejectNote(''); },
  });

  const restrictMutation = useMutation({
    mutationFn: () => driversApi.restrict(showRestrict.id, Number(restrictMinutes), restrictReason || undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['drivers'] }); setShowRestrict(null); },
  });

  const unrestrictMutation = useMutation({
    mutationFn: (id: number) => driversApi.unrestrict(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const isRestricted = (driver: any) => driver.restricted_until && new Date(driver.restricted_until) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">المناديبون</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + إضافة مندوب
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['الاسم', 'الهاتف', 'البريد', 'الحالة', 'التوفر', 'المخالفات', 'الإجراءات'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">جارٍ تحميل المناديبين...</td></tr>
              )}
              {!isLoading && data?.items?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">لا يوجد مناديبون.</td></tr>
              )}
              {data?.items?.map((driver: any) => (
                <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">{driver.full_name}</div>
                    <div className="text-xs text-gray-400">{driver.legal_arabic_name}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{driver.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{driver.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={driver.approval_status} />
                    {isRestricted(driver) && (
                      <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-semibold">موقوف</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${driver.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {driver.is_available ? 'متاح' : 'غير متاح'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-center text-gray-700">{driver.consecutive_strikes}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setShowDetails(driver)}
                        className="text-xs px-2 py-1 rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium border border-gray-200"
                      >
                        تفاصيل
                      </button>
                      {driver.approval_status === 'pending' && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate(driver.id)}
                            disabled={approveMutation.isPending}
                            className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                          >
                            موافقة
                          </button>
                          <button
                            onClick={() => { setShowReject(driver); setRejectNote(''); }}
                            className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                          >
                            رفض
                          </button>
                        </>
                      )}
                      {driver.approval_status === 'approved' && (
                        isRestricted(driver) ? (
                          <button
                            onClick={() => unrestrictMutation.mutate(driver.id)}
                            className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium"
                          >
                            رفع الإيقاف
                          </button>
                        ) : (
                          <button
                            onClick={() => { setShowRestrict(driver); setRestrictMinutes('60'); setRestrictReason(''); }}
                            className="text-xs px-2 py-1 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium"
                          >
                            إيقاف
                          </button>
                        )
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

      {/* Driver Details Modal */}
      {showDetails && (() => {
        const idInfo = parseEgyptianId(showDetails.national_id_number);
        const restricted = showDetails.restricted_until && new Date(showDetails.restricted_until) > new Date();
        return (
          <Modal title={`بيانات المندوب — ${showDetails.full_name}`} onClose={() => setShowDetails(null)}>
            <div className="space-y-4 text-sm">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['الاسم (إنجليزي)', showDetails.full_name],
                  ['الاسم (عربي)', showDetails.legal_arabic_name],
                  ['البريد الإلكتروني', showDetails.email],
                  ['الهاتف', showDetails.phone],
                  ['رقم البطاقة الوطنية', showDetails.national_id_number],
                  ['المركبة', showDetails.vehicle_type ?? '—'],
                  ['رقم اللوحة', showDetails.vehicle_plate ?? '—'],
                  ['حالة الحساب', <StatusBadge status={showDetails.approval_status} />],
                  ['التوفر', showDetails.is_available ? <span className="text-green-600 font-semibold">متاح</span> : <span className="text-gray-400">غير متاح</span>],
                  ['المخالفات', String(showDetails.consecutive_strikes ?? 0)],
                ].map(([label, val]) => (
                  <div key={label as string} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{label as string}</p>
                    <p className="font-semibold text-gray-800">{val as any}</p>
                  </div>
                ))}
              </div>

              {/* Egyptian ID Card Analysis */}
              {showDetails.national_id_number && (
                <div className={`rounded-xl p-4 space-y-3 border-2 ${idInfo ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'}`}>
                  <p className="font-bold text-blue-800 flex items-center gap-2">
                    🪪 تحليل بطاقة الرقم القومي
                  </p>
                  {idInfo ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['تاريخ الميلاد', idInfo.birthDate],
                        ['العمر', idInfo.age],
                        ['النوع', idInfo.gender],
                        ['محافظة الميلاد', idInfo.governorate],
                      ].map(([lbl, val]) => (
                        <div key={lbl} className="bg-white rounded-lg p-2.5">
                          <p className="text-xs text-gray-400">{lbl}</p>
                          <p className="font-bold text-gray-800">{val}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-red-600 text-xs">الرقم القومي غير مكتمل أو غير صحيح (يجب أن يكون 14 رقماً)</p>
                  )}
                </div>
              )}

              {/* Restriction Info */}
              {restricted && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
                  <p className="font-bold text-red-700">⛔ الحساب موقوف</p>
                  <p className="text-red-600 text-xs">حتى: {new Date(showDetails.restricted_until).toLocaleString('ar-EG')}</p>
                  {showDetails.restriction_reason && (
                    <p className="text-red-600 text-xs">السبب: {showDetails.restriction_reason}</p>
                  )}
                </div>
              )}

              {/* Rejection Note */}
              {showDetails.rejection_note && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <p className="font-bold text-orange-700 mb-1">📝 ملاحظة الرفض</p>
                  <p className="text-orange-600 text-xs">{showDetails.rejection_note}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowDetails(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50">
                  إغلاق
                </button>
                {showDetails.approval_status === 'pending' && (
                  <>
                    <button
                      onClick={() => { approveMutation.mutate(showDetails.id); setShowDetails(null); }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl"
                    >
                      موافقة
                    </button>
                    <button
                      onClick={() => { setShowReject(showDetails); setRejectNote(''); setShowDetails(null); }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl"
                    >
                      رفض
                    </button>
                  </>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Create Driver Modal */}
      {showCreate && (
        <Modal title="إضافة مندوب جديد" onClose={() => setShowCreate(false)}>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
            {([
              ['full_name', 'الاسم الكامل *', 'text'],
              ['legal_arabic_name', 'الاسم بالعربي *', 'text'],
              ['national_id_number', 'رقم البطاقة *', 'text'],
              ['email', 'البريد الإلكتروني *', 'email'],
              ['phone', 'الهاتف *', 'tel'],
              ['password', 'كلمة المرور *', 'password'],
              ['vehicle_type', 'نوع المركبة', 'text'],
              ['vehicle_plate', 'رقم اللوحة', 'text'],
            ] as [string, string, string][]).map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  required={label.includes('*')}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            ))}
            {createMutation.error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">فشل إنشاء المندوب. تحقق من جميع الحقول المطلوبة.</p>
            )}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'جارٍ الإضافة...' : 'إضافة المندوب'}
            </button>
          </form>
        </Modal>
      )}

      {/* Reject Modal */}
      {showReject && (
        <Modal title={`رفض طلب ${showReject.full_name}`} onClose={() => setShowReject(null)}>
          <div className="space-y-4">
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={3}
              placeholder="ملاحظة الرفض (اختياري)..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'جارٍ الرفض...' : 'تأكيد الرفض'}
            </button>
          </div>
        </Modal>
      )}

      {/* Restrict Modal */}
      {showRestrict && (
        <Modal title={`إيقاف ${showRestrict.full_name}`} onClose={() => setShowRestrict(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">مدة الإيقاف (دقائق)</label>
              <input
                type="number" min="1" max="10080"
                value={restrictMinutes}
                onChange={e => setRestrictMinutes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">الحد الأقصى: 10080 دقيقة (7 أيام)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سبب الإيقاف</label>
              <textarea
                value={restrictReason}
                onChange={e => setRestrictReason(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="سبب الإيقاف (اختياري)..."
              />
            </div>
            <button
              onClick={() => restrictMutation.mutate()}
              disabled={restrictMutation.isPending}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {restrictMutation.isPending ? 'جارٍ الإيقاف...' : 'تطبيق الإيقاف'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
