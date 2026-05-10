import { apiClient } from './client';

export type TimeOn = 'created_at' | 'completed_at' | 'updated_at';

export type OrderStatus =
  | 'pending'
  | 'offered'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type TimeseriesBucket = 'day' | 'week' | 'month';

export interface IncomeBlock {
  total_income: string;
  order_count: number;
  average_order_value: string;
}

export interface ByStatusItem {
  status: OrderStatus;
  count: number;
  total_price: string;
}

export interface TimeseriesItem {
  period_start: string;
  order_count: number;
  total_price: string;
}

export interface TopCustomerItem {
  customer_id: number;
  full_name: string;
  phone: string;
  order_count: number;
  total_price: string;
}

export interface TopDriverItem {
  driver_id: number;
  full_name: string;
  phone: string;
  order_count: number;
  total_price: string;
}

export interface IncomeForDayResponse {
  income: IncomeBlock;
  date: string;
  time_on: TimeOn;
  statuses: OrderStatus[];
}

export interface IncomeForRangeResponse {
  income: IncomeBlock;
  from_date: string;
  to_date: string;
  time_on: TimeOn;
  statuses: OrderStatus[];
}

export interface SimpleAnalysisResponse {
  from_date: string;
  to_date: string;
  time_on: TimeOn;
  statuses: OrderStatus[];
  overall: IncomeBlock;
  by_status: ByStatusItem[];
}

export interface AdvancedAnalysisRequest {
  from_date: string;
  to_date: string;
  time_on?: TimeOn;
  statuses?: OrderStatus[];
  include_timeseries?: boolean;
  timeseries_bucket?: TimeseriesBucket;
  top_customers_limit?: number;
  top_drivers_limit?: number;
}

export interface AdvancedAnalysisResponse {
  from_date: string;
  to_date: string;
  time_on: TimeOn;
  statuses: OrderStatus[];
  overall: IncomeBlock;
  by_status: ByStatusItem[];
  timeseries: TimeseriesItem[];
  top_customers: TopCustomerItem[];
  top_drivers: TopDriverItem[];
}

interface RangeParams {
  from: string;
  to: string;
  time_on?: TimeOn;
  statuses?: OrderStatus[];
}

interface DayParams {
  on: string;
  time_on?: TimeOn;
  statuses?: OrderStatus[];
}

export const analyticsApi = {
  incomeForDay: (params: DayParams) =>
    apiClient
      .get<IncomeForDayResponse>('/admin/analytics/income/daily', { params })
      .then((r) => r.data),

  incomeForRange: (params: RangeParams) =>
    apiClient
      .get<IncomeForRangeResponse>('/admin/analytics/income', { params })
      .then((r) => r.data),

  simple: (params: RangeParams) =>
    apiClient
      .get<SimpleAnalysisResponse>('/admin/analytics/simple', { params })
      .then((r) => r.data),

  advanced: (payload: AdvancedAnalysisRequest) =>
    apiClient
      .post<AdvancedAnalysisResponse>('/admin/analytics/advanced', payload)
      .then((r) => r.data),
};
