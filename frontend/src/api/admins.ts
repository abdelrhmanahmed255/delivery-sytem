import { apiClient } from './client';

export const adminsApi = {
  me: () => apiClient.get('/admin/admins/me').then(r => r.data),

  changeMyPassword: (current_password: string, new_password: string) =>
    apiClient.post('/admin/admins/me/password', { current_password, new_password }).then(r => r.data),

  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get('/admin/admins', { params }).then(r => r.data),

  get: (adminId: number) =>
    apiClient.get(`/admin/admins/${adminId}`).then(r => r.data),

  create: (payload: { email: string; full_name: string; phone?: string; password: string; is_superadmin?: boolean }) =>
    apiClient.post('/admin/admins', payload).then(r => r.data),

  update: (adminId: number, payload: Partial<{ full_name: string; phone: string; is_active: boolean; is_superadmin: boolean }>) =>
    apiClient.patch(`/admin/admins/${adminId}`, payload).then(r => r.data),
};

export const activityApi = {
  list: (params?: {
    actor_type?: string; actor_id?: number; action?: string;
    target_type?: string; target_id?: number; limit?: number; offset?: number;
  }) => apiClient.get('/admin/activity', { params }).then(r => r.data),
};

export const settingsApi = {
  get: () => apiClient.get('/admin/settings').then(r => r.data),
  update: (payload: { offer_open_timeout_seconds?: number; driver_restriction_seconds?: number }) =>
    apiClient.patch('/admin/settings', payload).then(r => r.data),
};
