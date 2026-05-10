import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { driversApi } from './drivers';

export interface DriverShiftRead {
  id: number;
  driver_id: number;
  opened_at: string;
  closed_at: string | null;
  opened_by_admin_id: number;
  closed_by_admin_id: number | null;
  recorded_payout: string | null;
  closing_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverShiftCloseRead extends DriverShiftRead {
  completed_orders_count: number;
  completed_orders_total_price: string;
}

export interface PageDriverShiftRead {
  items: DriverShiftRead[];
  total: number;
  limit: number;
  offset: number;
}

export interface DriverSummary {
  id: number;
  full_name: string;
  phone: string;
  current_shift_id: number | null;
}

export interface AggregatedShift extends DriverShiftRead {
  driver_full_name: string;
  driver_phone: string;
}

export const shiftsApi = {
  open: (driverId: number) =>
    apiClient
      .post<DriverShiftRead>(`/admin/drivers/${driverId}/shifts/open`)
      .then((r) => r.data),

  close: (
    driverId: number,
    payload?: { recorded_payout?: number | string; closing_note?: string }
  ) =>
    apiClient
      .post<DriverShiftCloseRead>(`/admin/drivers/${driverId}/shifts/close`, payload ?? {})
      .then((r) => r.data),

  current: (driverId: number) =>
    apiClient
      .get<DriverShiftRead>(`/admin/drivers/${driverId}/shifts/current`)
      .then((r) => r.data),

  list: (driverId: number, params?: { limit?: number; offset?: number }) =>
    apiClient
      .get<PageDriverShiftRead>(`/admin/drivers/${driverId}/shifts`, { params })
      .then((r) => r.data),
};

/**
 * The backend has no global "all shifts" endpoint. To give the admin a
 * cross-fleet view we fetch the drivers page (capped to maxDrivers) and
 * fan out one shifts request per driver in parallel via React Query.
 *
 * The returned data is annotated with each driver's display fields so the
 * UI can render the table without an extra lookup.
 */
export function useGlobalShifts(options?: {
  maxDrivers?: number;
  shiftsPerDriver?: number;
  staleTime?: number;
}) {
  const maxDrivers = options?.maxDrivers ?? 200;
  const shiftsPerDriver = options?.shiftsPerDriver ?? 50;
  const staleTime = options?.staleTime ?? 30_000;

  const driversQuery = useQuery({
    queryKey: ['shifts-drivers', maxDrivers],
    queryFn: () => driversApi.list({ limit: maxDrivers, offset: 0 }),
    staleTime,
  });

  const drivers: DriverSummary[] = (driversQuery.data?.items ?? []).map((d: any) => ({
    id: d.id,
    full_name: d.full_name,
    phone: d.phone,
    current_shift_id: d.current_shift_id ?? null,
  }));

  const shiftQueries = useQueries({
    queries: drivers.map((d) => ({
      queryKey: ['shifts-by-driver', d.id, shiftsPerDriver],
      queryFn: () => shiftsApi.list(d.id, { limit: shiftsPerDriver, offset: 0 }),
      enabled: !!driversQuery.data,
      staleTime,
    })),
  });

  const isLoading =
    driversQuery.isLoading ||
    (drivers.length > 0 && shiftQueries.some((q) => q.isLoading));

  const isFetching =
    driversQuery.isFetching || shiftQueries.some((q) => q.isFetching);

  const isError =
    driversQuery.isError || shiftQueries.some((q) => q.isError);

  const allShifts: AggregatedShift[] = useMemo(() => {
    const out: AggregatedShift[] = [];
    drivers.forEach((d, idx) => {
      const page = shiftQueries[idx]?.data;
      if (!page?.items) return;
      page.items.forEach((s) => {
        out.push({
          ...s,
          driver_full_name: d.full_name,
          driver_phone: d.phone,
        });
      });
    });
    return out.sort((a, b) => {
      const at = a.closed_at ?? a.opened_at;
      const bt = b.closed_at ?? b.opened_at;
      return bt.localeCompare(at);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.map((d) => d.id).join(','), shiftQueries.map((q) => q.dataUpdatedAt).join(',')]);

  const refetch = () => {
    driversQuery.refetch();
    shiftQueries.forEach((q) => q.refetch());
  };

  return {
    drivers,
    shifts: allShifts,
    closedShifts: allShifts.filter((s) => s.closed_at),
    openShifts: allShifts.filter((s) => !s.closed_at),
    driversTotal: driversQuery.data?.total ?? 0,
    isLoading,
    isFetching,
    isError,
    refetch,
  };
}

export const sumPayouts = (shifts: { recorded_payout: string | null }[]): number => {
  return shifts.reduce((acc, s) => {
    if (!s.recorded_payout) return acc;
    const n = Number(s.recorded_payout);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
};

export const isClosedOnDate = (shift: DriverShiftRead, isoDate: string): boolean => {
  if (!shift.closed_at) return false;
  return shift.closed_at.slice(0, 10) === isoDate;
};

export const isClosedInRange = (
  shift: DriverShiftRead,
  fromIso: string,
  toIso: string
): boolean => {
  if (!shift.closed_at) return false;
  const d = shift.closed_at.slice(0, 10);
  return d >= fromIso && d <= toIso;
};
