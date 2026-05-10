import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  isClosedInRange,
  isClosedOnDate,
  sumPayouts,
  useGlobalShifts,
  type AggregatedShift,
} from '../../api/shifts';
import {
  daysAgoIso,
  formatCount,
  formatMoney,
  startOfMonthIso,
  todayIso,
} from '../../utils/format';

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: '30d', label: 'آخر 30 يومًا' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'custom', label: 'مخصص' },
];

const presetRange = (p: Preset, current: { from: string; to: string }) => {
  switch (p) {
    case 'today':
      return { from: todayIso(), to: todayIso() };
    case '7d':
      return { from: daysAgoIso(6), to: todayIso() };
    case '30d':
      return { from: daysAgoIso(29), to: todayIso() };
    case 'month':
      return { from: startOfMonthIso(), to: todayIso() };
    case 'custom':
    default:
      return current;
  }
};

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ar-EG') : '—';

export const AdminShifts = () => {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>('30d');
  const [from, setFrom] = useState<string>(daysAgoIso(29));
  const [to, setTo] = useState<string>(todayIso());
  const [search, setSearch] = useState('');

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = presetRange(p, { from, to });
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const {
    shifts,
    closedShifts,
    openShifts,
    driversTotal,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGlobalShifts({ maxDrivers: 200, shiftsPerDriver: 50 });

  const today = todayIso();

  const todayClosed = useMemo(
    () => closedShifts.filter((s) => isClosedOnDate(s, today)),
    [closedShifts, today]
  );

  const inRangeClosed = useMemo(
    () => closedShifts.filter((s) => isClosedInRange(s, from, to)),
    [closedShifts, from, to]
  );

  const filtered: AggregatedShift[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return inRangeClosed;
    return inRangeClosed.filter(
      (s) =>
        s.driver_full_name?.toLowerCase().includes(term) ||
        s.driver_phone?.includes(term) ||
        String(s.id).includes(term)
    );
  }, [inRangeClosed, search]);

  const todayTotal = sumPayouts(todayClosed);
  const rangeTotal = sumPayouts(inRangeClosed);
  const avgPayout = inRangeClosed.length ? rangeTotal / inRangeClosed.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">ورديات المناديب</h2>
          <p className="text-sm text-gray-500 mt-1">
            متابعة الورديات التي أغلقها المسؤولون والمبالغ المُسجلة لكل وردية
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={isFetching}
          className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
            isFetching
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isFetching ? 'جارٍ التحديث...' : 'تحديث البيانات'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 rounded-xl shadow-sm">
          <p className="text-xs font-medium opacity-80">إجمالي مبالغ ورديات اليوم</p>
          <p className="text-2xl font-bold mt-2 break-words">
            {isLoading ? '...' : formatMoney(todayTotal)}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {formatCount(todayClosed.length)} وردية مُغلقة اليوم
          </p>
        </div>

        <KpiCard
          accent="bg-blue-50 text-blue-700"
          label="إجمالي مبالغ الفترة"
          value={isLoading ? '...' : formatMoney(rangeTotal)}
          hint={`${formatCount(inRangeClosed.length)} وردية`}
        />
        <KpiCard
          accent="bg-amber-50 text-amber-700"
          label="متوسط مبلغ الوردية"
          value={isLoading ? '...' : formatMoney(avgPayout)}
          hint="خلال الفترة المحددة"
        />
        <KpiCard
          accent="bg-indigo-50 text-indigo-700"
          label="ورديات مفتوحة الآن"
          value={isLoading ? '...' : formatCount(openShifts.length)}
          hint={`من ${formatCount(driversTotal)} مندوب`}
        />
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 text-sm">
          حدث خطأ أثناء جلب الورديات. أعد المحاولة من زر التحديث.
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => applyPreset(p.value)}
              className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-full border transition-colors ${
                preset === p.value
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">من تاريخ الإغلاق</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset('custom');
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">إلى تاريخ الإغلاق</label>
            <input
              type="date"
              value={to}
              min={from}
              max={todayIso()}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset('custom');
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">بحث</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم المندوب، الهاتف، أو رقم الوردية..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Closed shifts list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-gray-800">
            الورديات المُغلقة
          </h3>
          <span className="text-xs text-gray-500">
            {formatCount(filtered.length)} نتيجة • إجمالي {formatMoney(sumPayouts(filtered))}
          </span>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading && (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">جارٍ تحميل الورديات...</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">لا توجد ورديات مُغلقة في هذه الفترة.</p>
          )}
          {filtered.map((s) => (
            <ShiftCardMobile key={s.id} shift={s} />
          ))}
          {shifts.length === 0 && !isLoading && driversTotal > 0 && (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">لم يتم تسجيل أي ورديات بعد.</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['#', 'المندوب', 'فُتحت', 'أُغلقت', 'مدة الوردية', 'المبلغ', 'مسؤول الإغلاق', 'ملاحظة'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                    جارٍ تحميل الورديات...
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                    لا توجد ورديات مُغلقة في هذه الفترة.
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/admin/drivers')}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{s.id}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-800">{s.driver_full_name}</div>
                    <div className="text-xs text-gray-400" dir="ltr">{s.driver_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(s.opened_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(s.closed_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDuration(s.opened_at, s.closed_at)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700 whitespace-nowrap">
                    {s.recorded_payout ? formatMoney(s.recorded_payout) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {s.closed_by_admin_id ? `#${s.closed_by_admin_id}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[260px]">
                    {s.closing_note ? (
                      <span className="break-words">{s.closing_note}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        تُجمع الورديات من قائمة المناديبين (حتى 200 مندوب) ويتم تحديث البيانات تلقائيًا كل 30 ثانية.
      </p>
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
    <span className={`self-start text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${accent}`}>
      {label}
    </span>
    <p className="text-2xl font-bold text-gray-900 mt-2 break-words">{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const ShiftCardMobile = ({ shift }: { shift: AggregatedShift }) => (
  <div className="p-4 space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 truncate">{shift.driver_full_name}</p>
        <p className="text-xs text-gray-500 truncate" dir="ltr">{shift.driver_phone}</p>
      </div>
      <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
        {shift.recorded_payout ? formatMoney(shift.recorded_payout) : '—'}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="bg-gray-50 rounded-lg p-2">
        <p className="text-gray-400">فُتحت</p>
        <p className="font-medium text-gray-700">{fmtDateTime(shift.opened_at)}</p>
      </div>
      <div className="bg-gray-50 rounded-lg p-2">
        <p className="text-gray-400">أُغلقت</p>
        <p className="font-medium text-gray-700">{fmtDateTime(shift.closed_at)}</p>
      </div>
      <div className="bg-gray-50 rounded-lg p-2 col-span-2">
        <p className="text-gray-400">المدة</p>
        <p className="font-medium text-gray-700">{formatDuration(shift.opened_at, shift.closed_at)}</p>
      </div>
      {shift.closing_note && (
        <div className="bg-gray-50 rounded-lg p-2 col-span-2">
          <p className="text-gray-400">ملاحظة</p>
          <p className="font-medium text-gray-700 break-words">{shift.closing_note}</p>
        </div>
      )}
    </div>
  </div>
);

const formatDuration = (openedIso: string, closedIso: string | null): string => {
  if (!closedIso) return '—';
  const ms = new Date(closedIso).getTime() - new Date(openedIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} د`;
  return `${hours} س ${minutes} د`;
};
