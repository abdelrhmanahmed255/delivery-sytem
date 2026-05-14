import { apiClient } from './client';

export const driversApi = {
  list: (params?: { limit?: number; offset?: number; search?: string }) =>
    apiClient.get('/admin/drivers', { params }).then(r => r.data),

  get: (driverId: number) =>
    apiClient.get(`/admin/drivers/${driverId}`).then(r => r.data),

  create: (payload: {
    email: string; phone: string; full_name: string;
    legal_arabic_name: string; national_id_number: string;
    password: string; vehicle_type?: string; vehicle_plate?: string;
  }) => apiClient.post('/admin/drivers', payload).then(r => r.data),

  update: (driverId: number, payload: Partial<{
    full_name: string; legal_arabic_name: string; national_id_number: string;
    phone: string; vehicle_type: string; vehicle_plate: string; is_active: boolean;
  }>) => apiClient.patch(`/admin/drivers/${driverId}`, payload).then(r => r.data),

  approve: (driverId: number) =>
    apiClient.post(`/admin/drivers/${driverId}/approve`).then(r => r.data),

  reject: (driverId: number, note?: string) =>
    apiClient.post(`/admin/drivers/${driverId}/reject`, { note }).then(r => r.data),

  restrict: (driverId: number, minutes: number, reason?: string) =>
    apiClient.post(`/admin/drivers/${driverId}/restrict`, { minutes, reason }).then(r => r.data),

  unrestrict: (driverId: number) =>
    apiClient.post(`/admin/drivers/${driverId}/unrestrict`).then(r => r.data),

  // Driver self endpoints
  me: () => apiClient.get('/drivers/me').then(r => r.data),

  updateMe: (payload: Partial<{
    full_name: string; legal_arabic_name: string; national_id_number: string;
    phone: string; vehicle_type: string; vehicle_plate: string;
  }>) => apiClient.patch('/drivers/me', payload).then(r => r.data),

  changeMyPassword: (current_password: string, new_password: string) =>
    apiClient.post('/drivers/me/password', { current_password, new_password }).then(r => r.data),

  setAvailability: (is_available: boolean) =>
    apiClient.post('/drivers/me/availability', { is_available }).then(r => r.data),

  // Shift management (admin only)
  openShift: (driverId: number) =>
    apiClient.post(`/admin/drivers/${driverId}/shifts/open`).then(r => r.data),

  closeShift: (driverId: number, payload?: { recorded_payout?: number | string; closing_note?: string }) =>
    apiClient.post(`/admin/drivers/${driverId}/shifts/close`, payload ?? {}).then(r => r.data),

  getCurrentShift: (driverId: number) =>
    apiClient.get(`/admin/drivers/${driverId}/shifts/current`).then(r => r.data),

  listShifts: (driverId: number, params?: { limit?: number; offset?: number }) =>
    apiClient.get(`/admin/drivers/${driverId}/shifts`, { params }).then(r => r.data),

  // Dispatch queue & idle drivers (admin)
  getDispatchQueue: (limit = 100) =>
    apiClient.get('/admin/drivers/dispatch-queue', { params: { limit } }).then(r => r.data),

  getIdleDrivers: (params?: { idle_minutes?: number; limit?: number }) =>
    apiClient.get('/admin/drivers/idle', { params }).then(r => r.data),

  // Admin ↔ Driver Chat (admin side)
  openDriverChat: (driverId: number) =>
    apiClient.post(`/admin/drivers/${driverId}/chat`).then(r => r.data),

  getDriverChatMessages: (driverId: number, params?: { limit?: number; offset?: number }) =>
    apiClient.get(`/admin/drivers/${driverId}/chat/messages`, { params }).then(r => r.data),

  sendDriverChatMessage: (driverId: number, body: string) =>
    apiClient.post(`/admin/drivers/${driverId}/chat/messages`, { body }).then(r => r.data),

  // Driver self — chat
  getMyChatThread: () =>
    apiClient.get('/drivers/me/chat').then(r => r.data),

  getMyChatMessages: (params?: { limit?: number; offset?: number }) =>
    apiClient.get('/drivers/me/chat/messages', { params }).then(r => r.data),

  sendMyChatMessage: (body: string) =>
    apiClient.post('/drivers/me/chat/messages', { body }).then(r => r.data),
};
