import { apiClient } from './client';

export const authApi = {
  adminLogin: (email: string, password: string) =>
    apiClient.post('/auth/admin/login', { email, password }).then(r => r.data),

  driverLogin: (email: string, password: string) =>
    apiClient.post('/auth/driver/login', { email, password }).then(r => r.data),

  driverRegister: (payload: {
    email: string; phone: string; full_name: string;
    legal_arabic_name: string; national_id_number: string;
    password: string; vehicle_type?: string; vehicle_plate?: string;
  }) => apiClient.post('/auth/driver/register', payload).then(r => r.data),
};
