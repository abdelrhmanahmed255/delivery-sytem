import { apiClient } from './client';

export const customersApi = {
  list: (params?: { search?: string; limit?: number; offset?: number }) =>
    apiClient.get('/admin/customers', { params }).then(r => r.data),

  get: (customerId: number) =>
    apiClient.get(`/admin/customers/${customerId}`).then(r => r.data),

  create: (payload: { full_name: string; phone: string; address: string; notes?: string }) =>
    apiClient.post('/admin/customers', payload).then(r => r.data),

  update: (customerId: number, payload: Partial<{
    full_name: string; phone: string; address: string; notes: string;
  }>) => apiClient.patch(`/admin/customers/${customerId}`, payload).then(r => r.data),
};
