import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      role: null,
      orgName: null, // site name (legacy key kept for TopBar)
      setUser: (user) =>
        set({
          user,
          role: user?.role || null,
          orgName: user?.orgName || user?.siteName || null,
        }),
      setOrgName: (orgName) => set({ orgName }),
      clearUser: () => set({ user: null, role: null, orgName: null }),
    }),
    { name: "ridgeway-auth" }
  )
);
