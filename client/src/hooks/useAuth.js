"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  loginUser,
  registerUser,
  logoutUser,
  refreshAccessToken,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  ERROR_TYPES,
} from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

function clearAuthCookies() {
  if (typeof window === "undefined") return;
  document.cookie = `ridgeway_auth=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `ridgeway_role=; path=/; max-age=0; SameSite=Lax`;
}

export function useAuth() {
  const router = useRouter();
  const { setUser, clearUser } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: ({ email, password }) => loginUser(email, password),
    onSuccess: async (data, variables) => {
      const role = data?.user?.role;
      const adminMode = variables?.adminMode === true;

      if (adminMode && role !== "super_admin") {
        try { await logoutUser(); } catch (_) {}
        clearStoredToken();
        localStorage.removeItem("ridgeway_user");
        clearUser();
        clearAuthCookies();
        toast.error("This sign-in is for platform admins only. Please use the customer sign-in.");
        router.replace("/");
        return;
      }

      setStoredToken(data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem("ridgeway_refresh_token", data.refreshToken);
      }
      if (data?.user) {
        localStorage.setItem("ridgeway_user", JSON.stringify(data.user));
        setUser(data.user);
      }

      if (typeof window !== "undefined") {
        document.cookie = `ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax`;
        if (role) {
          document.cookie = `ridgeway_role=${role}; path=/; max-age=86400; SameSite=Lax`;
        }
      }

      toast.success("Welcome back");
      router.replace(role === "super_admin" ? "/admin/users" : "/overview");
    },
    onError: (error) => {
      if (error.type === ERROR_TYPES.UNAUTHORIZED) {
        toast.error("Invalid email or password");
      } else {
        toast.error("Login failed — please try again");
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logoutUser(),
    onSuccess: () => {
      localStorage.removeItem("ridgeway_user");
      clearUser();
      clearAuthCookies();
      router.replace("/");
      toast.info("Logged out");
    },
    onError: () => {
      clearStoredToken();
      localStorage.removeItem("ridgeway_user");
      clearUser();
      clearAuthCookies();
      router.replace("/");
    },
  });

  const registerMutation = useMutation({
    mutationFn: (userData) => registerUser(userData),
    onSuccess: (data) => {
      if (data?.accessToken) setStoredToken(data.accessToken);
      if (data?.refreshToken) {
        localStorage.setItem("ridgeway_refresh_token", data.refreshToken);
      }
      if (data?.user) {
        localStorage.setItem("ridgeway_user", JSON.stringify(data.user));
        setUser(data.user);
      }
      if (typeof window !== "undefined") {
        document.cookie = `ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax`;
        if (data?.user?.role) {
          document.cookie = `ridgeway_role=${data.user.role}; path=/; max-age=86400; SameSite=Lax`;
        }
      }
      toast.success("Account created successfully!");
      router.replace("/overview");
    },
    onError: (error) => {
      toast.error(error.message || "Registration failed");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem("ridgeway_refresh_token");
      if (!refreshToken) throw new Error("No refresh token available");
      return refreshAccessToken(refreshToken);
    },
    onSuccess: (data) => setStoredToken(data.accessToken),
    onError: () => {
      clearStoredToken();
      router.replace("/");
    },
  });

  return {
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    register: registerMutation.mutate,
    refreshToken: refreshMutation.mutate,
    isAuthenticated: !!getStoredToken(),
    isLoading:
      loginMutation.isPending ||
      logoutMutation.isPending ||
      registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    refreshError: refreshMutation.error,
    loginMutation,
    logoutMutation,
    registerMutation,
    refreshMutation,
  };
}
