// Helpers to format the analytics API responses.
// Backend sends Decimal values as strings (sometimes with leading zeros or
// signs) which can be huge. We try to render them in a clean human form
// without losing too much precision.

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const ABS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const COUNT_FORMATTER = new Intl.NumberFormat('en-US');

/** Convert a Decimal-as-string into a finite number (best-effort). */
export const decimalToNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
};

/** Format a money string in EGP (ج.م). */
export const formatMoney = (value: string | number | null | undefined): string => {
  const n = decimalToNumber(value);
  const sign = n < 0 ? '-' : '';
  return `${sign}${ABS_FORMATTER.format(Math.abs(n))} ج.م`;
};

/** Format a money string without currency suffix. */
export const formatMoneyPlain = (value: string | number | null | undefined): string => {
  return CURRENCY_FORMATTER.format(decimalToNumber(value));
};

/** Format an integer count with thousands separators. */
export const formatCount = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0';
  return COUNT_FORMATTER.format(value);
};

/** ISO date helpers for query params (YYYY-MM-DD). */
export const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const todayIso = (): string => toIsoDate(new Date());

export const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIsoDate(d);
};

export const startOfMonthIso = (): string => {
  const d = new Date();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

/** Format a period_start ISO timestamp for a given bucket. */
export const formatBucketLabel = (
  iso: string,
  bucket: 'day' | 'week' | 'month'
): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (bucket === 'month') {
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short' });
  }
  if (bucket === 'week') {
    return d.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' });
  }
  return d.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' });
};
