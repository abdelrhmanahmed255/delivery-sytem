import { apiClient } from './client';

export const ordersApi = {
  list: (params?: { status?: string; driver_id?: number; customer_id?: number; limit?: number; offset?: number }) =>
    apiClient.get('/admin/orders', { params }).then(r => r.data),

  get: (orderId: number) =>
    apiClient.get(`/admin/orders/${orderId}`).then(r => r.data),

  create: (payload: {
    customer_id: number; pickup_address: string; pickup_contact?: string;
    package_description?: string; price?: number | string;
    scheduled_for?: string; delivery_eta_minutes: number;
    distribution_mode?: 'auto' | 'manual';
  }) => apiClient.post('/admin/orders', payload).then(r => r.data),

  getOffers: (orderId: number) =>
    apiClient.get(`/admin/orders/${orderId}/offers`).then(r => r.data),

  assign: (orderId: number, driver_id: number) =>
    apiClient.post(`/admin/orders/${orderId}/assign`, { driver_id }).then(r => r.data),

  cancel: (orderId: number, reason?: string) =>
    apiClient.post(`/admin/orders/${orderId}/cancel`, { reason }).then(r => r.data),
};
