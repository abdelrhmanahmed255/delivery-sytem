import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetails, setShowDetails] = useState<any>(null);
  const [showRestrict, setShowRestrict] = useState<any>(null);
  const [showReject, setShowReject] = useState<any>(null);
  const [showShiftClose, setShowShiftClose] = useState<any>(null);
  const [showShiftHistory, setShowShiftHistory] = useState<any>(null);
  const [shiftHistoryOffset, setShiftHistoryOffset] = useState(0);
  const [showDispatchQueue, setShowDispatchQueue] = useState(false);
  const [showIdleDrivers, setShowIdleDrivers] = useState(false);
  const [showDriverChat, setShowDriverChat] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [restrictMinutes, setRestrictMinutes] = useState('60');
  const [restrictReason, setRestrictReason] = useState('');
  const [closePayout, setClosePayout] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const LIMIT = 20;

  // Auto-open chat when navigated here from the notification bell
  useEffect(() => {
    const s = location.state as any;
    if (s?.chatDriver) {
      setShowDriverChat(s.chatDriver);
      setChatMessage('');
      // Clear the state so refreshing the page doesn't re-open the modal
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const [form, setForm] = useState({
    email: '', phone: '', full_name: '', legal_arabic_name: '',
    national_id_number: '', password: '', vehicle_type: '', vehicle_plate: '',
  });

  // Build the active search term: phone takes priority (digits are unambiguous)
  const activeSearch = searchPhone.trim() || searchName.trim() || undefined;

  const { data, isLoading, isFetching, dataUpdatedAt } = useQuery({
    // When searching, fetch up to 200 rows without offset so we can filter client-side
    // (the backend /admin/drivers does not support a search query param)
    queryKey: ['drivers', activeSearch ? 'search-all' : offset],
    queryFn: () => driversApi.list(activeSearch ? { limit: 200, offset: 0 } : { limit: LIMIT, offset }),
    refetchInterval: 30_000,
  });

  // Client-side filtering
  const filteredItems: any[] = activeSearch
    ? (data?.items ?? []).filter((d: any) => {
        const q = activeSearch.toLowerCase();
        return (
          d.full_name?.toLowerCase().includes(q) ||
          d.legal_arabic_name?.toLowerCase().includes(q) ||
          d.phone?.includes(activeSearch)
        );
      })
    : (data?.items ?? []);

  // Reset to first page whenever search changes
  const handleSearchName = (v: string) => { setSearchName(v); setOffset(0); };
  const handleSearchPhone = (v: string) => { setSearchPhone(v); setOffset(0); };

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

  const openShiftMutation = useMutation({
    mutationFn: (id: number) => driversApi.openShift(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const closeShiftMutation = useMutation({
    mutationFn: () => driversApi.closeShift(showShiftClose.id, {
      recorded_payout: closePayout ? closePayout : undefined,
      closing_note: closeNote || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setShowShiftClose(null);
      setClosePayout('');
      setCloseNote('');
    },
  });

  const SHIFT_LIMIT = 10;
  const { data: shiftHistoryData, isLoading: shiftHistoryLoading } = useQuery({
    queryKey: ['driver-shifts', showShiftHistory?.id, shiftHistoryOffset],
    queryFn: () => driversApi.listShifts(showShiftHistory.id, { limit: SHIFT_LIMIT, offset: shiftHistoryOffset }),
    enabled: !!showShiftHistory,
  });

  const { data: dispatchQueueData, isLoading: dispatchQueueLoading } = useQuery({
    queryKey: ['dispatch-queue'],
    queryFn: () => driversApi.getDispatchQueue(),
    enabled: showDispatchQueue,
    refetchInterval: showDispatchQueue ? 10_000 : false,
  });

  const { data: idleDriversData, isLoading: idleDriversLoading } = useQuery({
    queryKey: ['idle-drivers'],
    queryFn: () => driversApi.getIdleDrivers({ idle_minutes: 45 }),
    enabled: showIdleDrivers,
    refetchInterval: showIdleDrivers ? 30_000 : false,
  });

  const { data: chatThreadData } = useQuery({
    queryKey: ['driver-chat-thread', showDriverChat?.id],
    queryFn: () => driversApi.openDriverChat(showDriverChat.id),
    enabled: !!showDriverChat,
  });

  const { data: chatMessagesData, refetch: refetchChat } = useQuery({
    queryKey: ['driver-chat-messages', showDriverChat?.id],
    queryFn: () => driversApi.getDriverChatMessages(showDriverChat.id),
    enabled: !!showDriverChat,
    refetchInterval: showDriverChat ? 8_000 : false,
  });

  const sendChatMutation = useMutation({
    mutationFn: () => driversApi.sendDriverChatMessage(showDriverChat!.id, chatMessage),
    onSuccess: () => { setChatMessage(''); refetchChat(); },
  });

  const isRestricted = (driver: any) => driver.restricted_until && new Date(driver.restricted_until) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">المناديبون</h2>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-gray-400 hidden sm:block">
              آخر تحديث: {new Date(dataUpdatedAt).toLocaleTimeString('ar-EG')}
            </span>
          )}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['drivers'] })}
            disabled={isFetching}
            title="تحديث يدوي"
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
            onClick={() => setShowCreate(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + إضافة مندوب
          </button>
          <button
            onClick={() => setShowDispatchQueue(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            🎯 طابور التوزيع
          </button>
          <button
            onClick={() => setShowIdleDrivers(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            😴 الخاملون
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-sm">🔍</span>
            <input
              type="text"
              value={searchName}
              onChange={e => handleSearchName(e.target.value)}
              placeholder="ابحث بالاسم..."
              className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchName && (
              <button
                type="button"
                onClick={() => handleSearchName('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold px-1"
              >✕</button>
            )}
          </div>
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-sm">📱</span>
            <input
              type="tel"
              value={searchPhone}
              onChange={e => handleSearchPhone(e.target.value)}
              placeholder="ابحث برقم الهاتف..."
              dir="ltr"
              className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
            />
            {searchPhone && (
              <button
                type="button"
                onClick={() => handleSearchPhone('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold px-1"
              >✕</button>
            )}
          </div>
        </div>
        {activeSearch && (
          <p className="text-xs text-indigo-600 mt-2 px-1">
            نتائج البحث عن: <span className="font-semibold">"{activeSearch}"</span>
            {' — '}{isLoading ? '...' : filteredItems.length} نتيجة
            <button onClick={() => { handleSearchName(''); handleSearchPhone(''); }} className="mr-2 text-red-500 hover:text-red-700 font-semibold">مسح البحث ✕</button>
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading && <p className="px-4 py-8 text-center text-gray-400">جارٍ تحميل المناديبين...</p>}
          {!isLoading && filteredItems.length === 0 && <p className="px-4 py-8 text-center text-gray-400">{activeSearch ? 'لا توجد نتائج مطابقة.' : 'لا يوجد مناديبون.'}</p>}
          {filteredItems.map((driver: any) => (
            <div key={driver.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{driver.full_name}</p>
                  <p className="text-xs text-gray-400">{driver.legal_arabic_name}</p>
                  <p className="text-sm text-gray-500">{driver.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={driver.approval_status} />
                  {isRestricted(driver) && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-semibold">موقوف</span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${driver.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {driver.is_available ? 'متاح' : 'غير متاح'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500">مخالفات: <span className="font-bold text-gray-700">{driver.consecutive_strikes}</span></p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowDetails(driver)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 font-medium">تفاصيل</button>
                {driver.approval_status === 'pending' && (
                  <>
                    <button onClick={() => approveMutation.mutate(driver.id)} disabled={approveMutation.isPending} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 font-medium">موافقة</button>
                    <button onClick={() => { setShowReject(driver); setRejectNote(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-medium">رفض</button>
                  </>
                )}
                {driver.approval_status === 'approved' && (
                  isRestricted(driver) ? (
                    <button onClick={() => unrestrictMutation.mutate(driver.id)} className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-medium">رفع الإيقاف</button>
                  ) : (
                    <button onClick={() => { setShowRestrict(driver); setRestrictMinutes('60'); setRestrictReason(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 font-medium">إيقاف</button>
                  )
                )}
                {driver.approval_status === 'approved' && (
                  driver.current_shift_id ? (
                    <button onClick={() => { setShowShiftClose(driver); setClosePayout(''); setCloseNote(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-medium border border-red-200">إغلاق وردية</button>
                  ) : (
                    <button onClick={() => openShiftMutation.mutate(driver.id)} disabled={openShiftMutation.isPending} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium border border-blue-200">فتح وردية</button>
                  )
                )}
                <button onClick={() => { setShowShiftHistory(driver); setShiftHistoryOffset(0); }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 font-medium">الورديات</button>
                <button onClick={() => { setShowDriverChat(driver); setChatMessage(''); }} className="text-xs px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 font-medium">💬 محادثة</button>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
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
              {!isLoading && filteredItems.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">{activeSearch ? 'لا توجد نتائج مطابقة.' : 'لا يوجد مناديبون.'}</td></tr>
              )}
              {filteredItems.map((driver: any) => (
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
                    {driver.current_shift_id && (
                      <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-semibold">وردية مفتوحة</span>
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
                      {driver.approval_status === 'approved' && (
                        driver.current_shift_id ? (
                          <button
                            onClick={() => { setShowShiftClose(driver); setClosePayout(''); setCloseNote(''); }}
                            className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-medium border border-red-200"
                          >
                            إغلاق وردية
                          </button>
                        ) : (
                          <button
                            onClick={() => openShiftMutation.mutate(driver.id)}
                            disabled={openShiftMutation.isPending}
                            className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium border border-blue-200"
                          >
                            فتح وردية
                          </button>
                        )
                      )}
                      <button
                        onClick={() => { setShowShiftHistory(driver); setShiftHistoryOffset(0); }}
                        className="text-xs px-2 py-1 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium border border-gray-200"
                      >
                        الورديات
                      </button>
                      <button
                        onClick={() => { setShowDriverChat(driver); setChatMessage(''); }}
                        className="text-xs px-2 py-1 rounded-md bg-cyan-50 text-cyan-700 hover:bg-cyan-100 font-medium border border-cyan-200"
                      >
                        💬 محادثة
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !activeSearch && <div className="px-4 pb-4"><Pagination total={data.total} limit={LIMIT} offset={offset} onPageChange={setOffset} /></div>}
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

      {/* Close Shift Modal */}
      {showShiftClose && (
        <Modal title={`إغلاق وردية — ${showShiftClose.full_name}`} onClose={() => setShowShiftClose(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              رقم الوردية الحالية: <span className="font-bold text-gray-800">#{showShiftClose.current_shift_id}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المدفوع (اختياري)</label>
              <input
                type="number" min="0" step="0.01"
                value={closePayout}
                onChange={e => setClosePayout(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات الإغلاق (اختياري)</label>
              <textarea
                value={closeNote}
                onChange={e => setCloseNote(e.target.value)}
                rows={3}
                placeholder="ملاحظات حول الوردية..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            {closeShiftMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">فشل إغلاق الوردية. حاول مرة أخرى.</p>
            )}
            <button
              onClick={() => closeShiftMutation.mutate()}
              disabled={closeShiftMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {closeShiftMutation.isPending ? 'جارٍ الإغلاق...' : 'إغلاق الوردية'}
            </button>
          </div>
        </Modal>
      )}

      {/* Shift History Modal */}
      {showShiftHistory && (
        <Modal title={`سجل الورديات — ${showShiftHistory.full_name}`} onClose={() => setShowShiftHistory(null)}>
          <div className="space-y-3">
            {shiftHistoryLoading && <p className="text-center text-gray-400 py-6">جارٍ التحميل...</p>}
            {!shiftHistoryLoading && shiftHistoryData?.items?.length === 0 && (
              <p className="text-center text-gray-400 py-6">لا توجد ورديات مسجلة.</p>
            )}
            {shiftHistoryData?.items?.map((shift: any) => (
              <div key={shift.id} className="border border-gray-100 rounded-xl p-4 space-y-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800 text-sm">وردية #{shift.id}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${shift.closed_at ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                    {shift.closed_at ? 'مغلقة' : 'مفتوحة'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <p className="text-gray-400">فُتحت</p>
                    <p className="font-medium">{new Date(shift.opened_at).toLocaleString('ar-EG')}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">أُغلقت</p>
                    <p className="font-medium">{shift.closed_at ? new Date(shift.closed_at).toLocaleString('ar-EG') : '—'}</p>
                  </div>
                  {shift.recorded_payout && (
                    <div>
                      <p className="text-gray-400">المبلغ المدفوع</p>
                      <p className="font-semibold text-green-700">{shift.recorded_payout} ج.م</p>
                    </div>
                  )}
                  {shift.closing_note && (
                    <div className="col-span-2">
                      <p className="text-gray-400">ملاحظات</p>
                      <p className="font-medium">{shift.closing_note}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {shiftHistoryData && (
              <Pagination
                total={shiftHistoryData.total}
                limit={SHIFT_LIMIT}
                offset={shiftHistoryOffset}
                onPageChange={setShiftHistoryOffset}
              />
            )}
          </div>
        </Modal>
      )}

      {/* Dispatch Queue Modal */}
      {showDispatchQueue && (
        <Modal title="طابور التوزيع التلقائي" onClose={() => setShowDispatchQueue(false)}>
          <div className="space-y-4">
            {dispatchQueueLoading && <p className="text-center text-gray-400 py-6">جارٍ التحميل...</p>}
            {dispatchQueueData && (
              <>
                {dispatchQueueData.next_driver && (
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                    <p className="text-xs text-indigo-500 font-semibold mb-1">المندوب التالي للاستلام</p>
                    <p className="text-lg font-black text-indigo-800">{dispatchQueueData.next_driver.driver?.full_name}</p>
                    <p className="text-xs text-indigo-600 mt-1">{dispatchQueueData.next_driver.queue_reason}</p>
                  </div>
                )}
                <div className="space-y-2">
                  {dispatchQueueData.queue?.map((item: any) => (
                    <div key={item.driver?.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{item.driver?.full_name}</p>
                        <p className="text-xs text-gray-500">{item.queue_reason}</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full">#{item.queue_rank}</span>
                    </div>
                  ))}
                  {dispatchQueueData.queue?.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">الطابور فارغ حالياً.</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 text-center">
                  آخر تحديث: {new Date(dispatchQueueData.generated_at).toLocaleString('ar-EG')}
                </p>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Idle Drivers Modal */}
      {showIdleDrivers && (
        <Modal title="المناديبون الخاملون (45+ دقيقة)" onClose={() => setShowIdleDrivers(false)}>
          <div className="space-y-3">
            {idleDriversLoading && <p className="text-center text-gray-400 py-6">جارٍ التحميل...</p>}
            {idleDriversData?.length === 0 && <p className="text-center text-gray-400 py-6">لا يوجد مناديبون خاملون حالياً.</p>}
            {idleDriversData?.map((item: any) => (
              <div key={item.driver?.id} className="border border-amber-100 bg-amber-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">{item.driver?.full_name}</p>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">{Math.round(item.idle_minutes)} دقيقة خمول</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  {item.last_assigned_at && (
                    <div><span className="text-gray-400">آخر تعيين: </span>{new Date(item.last_assigned_at).toLocaleString('ar-EG')}</div>
                  )}
                  {item.current_shift_opened_at && (
                    <div><span className="text-gray-400">بداية الوردية: </span>{new Date(item.current_shift_opened_at).toLocaleString('ar-EG')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Driver Chat Modal */}
      {showDriverChat && (
        <Modal title={`محادثة مع ${showDriverChat.full_name}`} onClose={() => { setShowDriverChat(null); setChatMessage(''); }}>
          <div className="flex flex-col h-[420px]">
            <div className="flex-1 overflow-y-auto space-y-2 pb-2">
              {!chatMessagesData && <p className="text-center text-gray-400 py-4 text-sm">جارٍ التحميل...</p>}
              {chatMessagesData?.length === 0 && <p className="text-center text-gray-400 py-4 text-sm">لا توجد رسائل بعد. ابدأ المحادثة.</p>}
              {chatMessagesData?.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    msg.sender_type === 'admin'
                      ? 'bg-cyan-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    <p>{msg.body}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">{new Date(msg.created_at).toLocaleTimeString('ar-EG')}</p>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 pt-2 border-t border-gray-100"
              onSubmit={e => { e.preventDefault(); if (chatMessage.trim()) sendChatMutation.mutate(); }}
            >
              <input
                type="text"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                placeholder="اكتب رسالتك..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="submit"
                disabled={!chatMessage.trim() || sendChatMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {sendChatMutation.isPending ? '...' : 'إرسال'}
              </button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
