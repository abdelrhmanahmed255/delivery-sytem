import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Role = 'admin' | 'driver' | null;

interface AuthState {
  token: string | null;
  role: Role;
  accountId: number | null;
  login: (token: string, role: Role, accountId: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      accountId: null,
      login: (token, role, accountId) => set({ token, role, accountId }),
      logout: () => set({ token: null, role: null, accountId: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
