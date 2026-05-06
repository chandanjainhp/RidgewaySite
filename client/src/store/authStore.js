import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      role: null,
      orgId: null,
      setUser: (user) => set({ 
        user, 
        role: user?.role || null, 
        orgId: user?.orgId || null 
      }),
      clearUser: () => set({ user: null, role: null, orgId: null }),
    }),
    {
      name: 'ridgeway-auth-storage',
    }
  )
);
