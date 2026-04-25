import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Use /api prefix so Vercel rewrites proxy to the backend without
// colliding with frontend SPA routes (e.g. /admin/drivers).
// In production this hits the Vercel rewrite rules.
// In development, configure the Vite proxy to forward /api/* to the backend.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
