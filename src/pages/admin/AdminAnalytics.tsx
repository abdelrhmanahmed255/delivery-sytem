import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  analyticsApi,
  type OrderStatus,
  type TimeOn,
  type TimeseriesBucket,
} from '../../api/analytics';
import {
  isClosedOnDate,
  sumPayouts,
  useGlobalShifts,
} from '../../api/shifts';
import {
  decimalToNumber,
  formatBucketLabel,
  formatCount,
  formatMoney,
  formatMoneyPlain,
  daysAgoIso,
  startOfMonthIso,
  todayIso,
} from '../../utils/format';

// "all" means: show every order in the date range regardless of status.
// The backend `time_on` parameter can only target one timestamp at a time,
// so for "all data" we send `created_at` — every order has a creation
// timestamp (pending, completed, cancelled, expired), which gives the
// broadest possible window. The other three options are explicit overrides
// when the admin wants a narrower slice (e.g. completed_at for revenue
// actually collected).
type TimeOnChoice = TimeOn | 'all';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'offered', label: 'تم العرض' },
  { value: 'assigned', label: 'تم التعيين' },
  { value: 'in_progress', label: 'جارٍ التوصيل' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'cancelled', label: 'ملغى' },
  { value: 'expired', label: 'منتهي' },
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500',
  offered: 'bg-blue-500',
  assigned: 'bg-indigo-500',
  in_progress: 'bg-orange-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  expired: 'bg-gray-500',
};

const STATUS_LABELS: Record<OrderStatus, string> = STATUS_OPTIONS.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<OrderStatus, string>
);

const TIME_ON_OPTIONS: { value: TimeOnChoice; label: string }[] = [
  { value: 'all', label: 'كل الطلبات في الفترة' },
  { value: 'completed_at', label: 'الإيرادات الفعلية (تاريخ الاكتمال)' },
  { value: 'created_at', label: 'تاريخ الإنشاء' },
  { value: 'updated_at', label: 'آخر تحديث' },
];

const BUCKET_OPTIONS: { value: TimeseriesBucket; label: string }[] = [
  { value: 'day', label: 'يومي' },
  { value: 'week', label: 'أسبوعي' },
  { value: 'month', label: 'شهري' },
];

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: '30d', label: 'آخر 30 يومًا' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'custom', label: 'مخصص' },
];

const DEFAULT_PRESET: Preset = '30d';
const defaultFrom = () => daysAgoIso(29);
const defaultTo = () => todayIso();

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

export const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>(DEFAULT_PRESET);
  const [from, setFrom] = useState<string>(defaultFrom());
  const [to, setTo] = useState<string>(defaultTo());
  // Default to "all" — the admin opts in to a specific filter only when needed.
  const [timeOn, setTimeOn] = useState<TimeOnChoice>('all');
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [bucket, setBucket] = useState<TimeseriesBucket>('day');
  const [topLimit, setTopLimit] = useState<number>(5);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = presetRange(p, { from, to });
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const toggleStatus = (s: OrderStatus) => {
    setStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  // Map "all" → created_at so we get every order in the range regardless of
  // status. Sending `completed_at` (the server default) would silently drop
  // pending/cancelled/expired orders, which is the opposite of what the
  // admin expects from a "show me everything" option.
  const apiTimeOn: TimeOn = timeOn === 'all' ? 'created_at' : timeOn;
  const apiStatuses = statuses.length ? statuses : undefined;

  // Today's order income (fixed "completed" metric — independent of filters).
  const todayQuery = useQuery({
    queryKey: ['analytics', 'today-income'],
    queryFn: () =>
      analyticsApi.incomeForDay({
        on: todayIso(),
        statuses: ['completed'],
      }),
    staleTime: 60_000,
  });

  // Today's CLOSED-SHIFT payouts (the headline metric the admin actually wants).
  const todayIsoStr = todayIso();
  const { closedShifts, isLoading: shiftsLoading } = useGlobalShifts({
    maxDrivers: 200,
    shiftsPerDriver: 30,
    staleTime: 60_000,
  });
  const todayClosedShifts = useMemo(
    () => closedShifts.filter((s) => isClosedOnDate(s, todayIsoStr)),
    [closedShifts, todayIsoStr]
  );
  const todayShiftPayoutTotal = useMemo(
    () => sumPayouts(todayClosedShifts),
    [todayClosedShifts]
  );

  // Advanced query drives KPIs + by-status + timeseries + tops.
  // Refetches automatically when any filter changes.
  const advancedQuery = useQuery({
    queryKey: [
      'analytics',
      'advanced',
      from,
      to,
      apiTimeOn,
      statuses.slice().sort().join(',') || 'all',
      bucket,
      topLimit,
    ],
    queryFn: () =>
      analyticsApi.advanced({
        from_date: from,
        to_date: to,
        time_on: apiTimeOn,
        statuses: apiStatuses,
        include_timeseries: true,
        timeseries_bucket: bucket,
        top_customers_limit: topLimit,
        top_drivers_limit: topLimit,
      }),
    staleTime: 30_000,
  });

  const data = advancedQuery.data;

  const totalByStatus = useMemo(() => {
    if (!data?.by_status?.length) return 0;
    return data.by_status.reduce((sum, s) => sum + s.count, 0);
  }, [data]);

  const maxTimeseries = useMemo(() => {
    if (!data?.timeseries?.length) return 0;
    return data.timeseries.reduce(
      (max, t) => Math.max(max, decimalToNumber(t.total_price)),
      0
    );
  }, [data]);

  const swapDates = () => {
    setFrom(to);
    setTo(from);
  };

  const resetFilters = () => {
    setPreset(DEFAULT_PRESET);
    setFrom(defaultFrom());
    setTo(defaultTo());
    setTimeOn('all');
    setStatuses([]);
    setBucket('day');
    setTopLimit(5);
  };

  const presetLabel =
    PRESETS.find((p) => p.value === preset)?.label ?? 'مخصص';
  const timeOnLabel =
    TIME_ON_OPTIONS.find((o) => o.value === timeOn)?.label ?? 'الكل';
  const activeStatusLabels = statuses
    .map((s) => STATUS_LABELS[s] ?? s)
    .join('، ');

  // Anything that differs from the page defaults counts as an "active filter".
  const hasActiveFilters =
    preset !== DEFAULT_PRESET ||
    timeOn !== 'all' ||
    statuses.length > 0 ||
    from !== defaultFrom() ||
    to !== defaultTo();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">التحليلات والإيرادات</h2>
          <p className="text-sm text-gray-500 mt-1">
            جميع الفلاتر تُطبَّق تلقائيًا، والافتراضي يشمل كل الحالات وكل المعايير.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/shifts')}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ورديات المناديب
          </button>
          <button
            onClick={() => advancedQuery.refetch()}
            disabled={advancedQuery.isFetching}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              advancedQuery.isFetching
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {advancedQuery.isFetching ? 'جارٍ التحديث...' : 'تحديث البيانات'}
          </button>
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 rounded-xl shadow-sm">
          <p className="text-xs font-medium opacity-80">إجمالي مبالغ ورديات اليوم</p>
          <p className="text-2xl font-bold mt-2 break-words">
            {shiftsLoading ? '...' : formatMoney(todayShiftPayoutTotal)}
          </p>
          <p className="text-xs opacity-80 mt-1">
            {shiftsLoading
              ? '—'
              : `${formatCount(todayClosedShifts.length)} وردية مُغلقة اليوم`}
          </p>
        </div>

        <KpiCard
          label="إيرادات اليوم (مكتملة)"
          value={
            todayQuery.isLoading
              ? '...'
              : formatMoney(todayQuery.data?.income.total_income)
          }
          loading={todayQuery.isLoading}
          accent="bg-emerald-50 text-emerald-700"
          hint={
            todayQuery.data
              ? `${formatCount(todayQuery.data.income.order_count)} طلب مكتمل`
              : undefined
          }
        />
        <KpiCard
          label="إجمالي الإيراد (الفترة)"
          value={data ? formatMoney(data.overall.total_income) : '—'}
          loading={advancedQuery.isLoading}
          accent="bg-blue-50 text-blue-700"
          hint={data ? `${formatCount(data.overall.order_count)} طلب` : undefined}
        />
        <KpiCard
          label="متوسط قيمة الطلب"
          value={data ? formatMoney(data.overall.average_order_value) : '—'}
          loading={advancedQuery.isLoading}
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      {/* Active filters summary */}
      <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 md:p-4 flex flex-wrap items-center gap-2 text-xs md:text-sm">
        <span className="font-semibold text-emerald-800">الفلاتر النشطة:</span>
        <FilterPill>{presetLabel}</FilterPill>
        <FilterPill>
          من <span dir="ltr">{from}</span> إلى <span dir="ltr">{to}</span>
        </FilterPill>
        <FilterPill>معيار التاريخ: {timeOnLabel}</FilterPill>
        <FilterPill>
          الحالات: {statuses.length === 0 ? 'كل الحالات' : activeStatusLabels}
        </FilterPill>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-auto text-xs font-semibold px-3 py-1 rounded-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            إعادة الضبط
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">الفلاتر</h3>
          <span className="text-[11px] text-gray-400">
            تُطبَّق تلقائيًا — لا حاجة لزر "تطبيق".
          </span>
        </div>

        {/* Preset chips */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">من تاريخ</label>
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">إلى تاريخ</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={to}
                min={from}
                max={todayIso()}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset('custom');
                }}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={swapDates}
                title="تبديل التواريخ"
                className="px-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                ⇄
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              معيار التاريخ
            </label>
            <select
              value={timeOn}
              onChange={(e) => setTimeOn(e.target.value as TimeOnChoice)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {TIME_ON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              "كل الطلبات في الفترة" يعرض كل طلب أُنشئ خلال النطاق الزمني بغض النظر عن حالته. اختر "الإيرادات الفعلية" لرؤية الطلبات المكتملة فقط.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-gray-500">حالات الطلبات</label>
            {statuses.length > 0 && (
              <button
                onClick={() => setStatuses([])}
                className="text-[11px] text-gray-500 hover:text-gray-800 font-medium"
              >
                إزالة كل الحالات
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => {
              const active = statuses.includes(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => toggleStatus(s.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    active
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${STATUS_COLORS[s.value]}`}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            عند ترك الحالات فارغة سيتم احتساب جميع الحالات تلقائيًا.
          </p>
        </div>
      </div>

      {advancedQuery.isError && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 text-sm">
          تعذر تحميل التحليلات. تأكد من النطاق الزمني وأعد المحاولة.
        </div>
      )}

      {/* Status breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">التوزيع حسب الحالة</h3>
          <span className="text-xs text-gray-500">
            {data ? `${formatCount(totalByStatus)} طلب` : ''}
          </span>
        </div>
        {advancedQuery.isLoading ? (
          <p className="text-gray-400 text-sm">جارٍ التحميل...</p>
        ) : !data?.by_status?.length ? (
          <p className="text-gray-400 text-sm">لا توجد بيانات في الفترة المختارة.</p>
        ) : (
          <div className="space-y-3">
            {data.by_status.map((s) => {
              const pct = totalByStatus ? (s.count / totalByStatus) * 100 : 0;
              return (
                <div key={s.status} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs md:text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[s.status]}`} />
                      <span className="font-medium">{STATUS_LABELS[s.status] ?? s.status}</span>
                      <span className="text-gray-400">({formatCount(s.count)})</span>
                    </div>
                    <div className="text-gray-700 font-semibold">{formatMoney(s.total_price)}</div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${STATUS_COLORS[s.status]} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeseries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-gray-800">إيرادات حسب الفترة</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 hidden sm:inline">
              من {from} إلى {to}
            </span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {BUCKET_OPTIONS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBucket(b.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    bucket === b.value
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {advancedQuery.isLoading ? (
          <p className="text-gray-400 text-sm">جارٍ التحميل...</p>
        ) : !data?.timeseries?.length ? (
          <p className="text-gray-400 text-sm">لا توجد بيانات لعرضها.</p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-1 md:gap-2 min-w-full pt-4"
              style={{ minHeight: '180px' }}
              dir="ltr"
            >
              {data.timeseries.map((t, idx) => {
                const value = decimalToNumber(t.total_price);
                const heightPct = maxTimeseries
                  ? Math.max((value / maxTimeseries) * 100, value > 0 ? 4 : 0)
                  : 0;
                return (
                  <div
                    key={`${t.period_start}-${idx}`}
                    className="flex flex-col items-center justify-end flex-1 min-w-[28px] group"
                    title={`${formatBucketLabel(t.period_start, bucket)} • ${formatMoneyPlain(t.total_price)} ج.م • ${formatCount(t.order_count)} طلب`}
                  >
                    <span className="text-[10px] text-gray-400 mb-1 group-hover:text-gray-700 transition-colors">
                      {value > 0 ? formatMoneyPlain(t.total_price) : ''}
                    </span>
                    <div
                      className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t transition-all"
                      style={{ height: `${heightPct}%`, minHeight: value > 0 ? '4px' : '0' }}
                    />
                    <span className="text-[10px] text-gray-500 mt-1 truncate max-w-full">
                      {formatBucketLabel(t.period_start, bucket)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top customers + Top drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopList
          title="أفضل العملاء"
          loading={advancedQuery.isLoading}
          items={
            data?.top_customers?.map((c) => ({
              id: c.customer_id,
              name: c.full_name,
              phone: c.phone,
              count: c.order_count,
              total: c.total_price,
            })) ?? []
          }
          limit={topLimit}
          onLimitChange={setTopLimit}
          countLabel="طلب"
        />
        <TopList
          title="أفضل المناديب"
          loading={advancedQuery.isLoading}
          items={
            data?.top_drivers?.map((d) => ({
              id: d.driver_id,
              name: d.full_name,
              phone: d.phone,
              count: d.order_count,
              total: d.total_price,
            })) ?? []
          }
          limit={topLimit}
          onLimitChange={setTopLimit}
          countLabel="طلب"
        />
      </div>
    </div>
  );
};

const FilterPill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 bg-white border border-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[11px] md:text-xs font-medium">
    {children}
  </span>
);

const KpiCard = ({
  label,
  value,
  loading,
  accent,
  hint,
}: {
  label: string;
  value: string;
  loading: boolean;
  accent: string;
  hint?: string;
}) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
    <span className={`text-[11px] font-semibold uppercase tracking-wide self-start px-2 py-0.5 rounded ${accent}`}>
      {label}
    </span>
    <p className="text-2xl font-bold text-gray-900 mt-2 break-words">
      {loading ? '...' : value}
    </p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

interface TopListItem {
  id: number;
  name: string;
  phone: string;
  count: number;
  total: string;
}

const TopList = ({
  title,
  loading,
  items,
  limit,
  onLimitChange,
  countLabel,
}: {
  title: string;
  loading: boolean;
  items: TopListItem[];
  limit: number;
  onLimitChange: (n: number) => void;
  countLabel: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <select
        value={limit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
        className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {[5, 10, 20].map((n) => (
          <option key={n} value={n}>
            أفضل {n}
          </option>
        ))}
      </select>
    </div>
    {loading ? (
      <p className="text-gray-400 text-sm">جارٍ التحميل...</p>
    ) : items.length === 0 ? (
      <p className="text-gray-400 text-sm">لا توجد بيانات.</p>
    ) : (
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li
            key={it.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{it.name || `#${it.id}`}</p>
                <p className="text-xs text-gray-500 truncate" dir="ltr">{it.phone}</p>
              </div>
            </div>
            <div className="text-left flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">{formatMoney(it.total)}</p>
              <p className="text-xs text-gray-500">
                {formatCount(it.count)} {countLabel}
              </p>
            </div>
          </li>
        ))}
      </ol>
    )}
  </div>
);
