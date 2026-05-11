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
  getOrgMe,
  ERROR_TYPES,
} from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const router = useRouter();
  const { setUser, clearUser } = useAuthStore();

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: ({ email, password }) => loginUser(email, password),
    onSuccess: async (data) => {
      // Store the access token
      setStoredToken(data.accessToken);

      // Store refresh token if provided
      if (data.refreshToken) {
        localStorage.setItem("ridgeway_refresh_token", data.refreshToken);
      }

      if (data?.user) {
        localStorage.setItem("ridgeway_user", JSON.stringify(data.user));
        setUser(data.user);
      }

      // Set auth cookie for middleware
      if (typeof window !== "undefined") {
        document.cookie = `ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax`;
        if (data?.user?.role) {
          document.cookie = `ridgeway_role=${data.user.role}; path=/; max-age=86400; SameSite=Lax`;
        }
      }

      toast.success("Welcome back");

      // Check org setup status before redirect
      try {
        const orgData = await getOrgMe();
        const setupDone = orgData?.setupComplete;
        if (typeof window !== "undefined") {
          document.cookie = `ridgeway_setup=${setupDone ? "1" : "0"}; path=/; max-age=86400; SameSite=Lax`;
        }
        router.replace(setupDone ? "/investigate" : "/setup");
      } catch {
        router.replace("/investigate");
      }
    },
    onError: (error) => {
      if (error.type === ERROR_TYPES.UNAUTHORIZED) {
        toast.error("Invalid email or password");
      } else {
        toast.error("Login failed — please try again");
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => logoutUser(),
    onSuccess: () => {
      localStorage.removeItem("ridgeway_user");
      clearUser();
      // Clear auth cookie
      if (typeof window !== "undefined") {
        document.cookie = `ridgeway_auth=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `ridgeway_role=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `ridgeway_setup=; path=/; max-age=0; SameSite=Lax`;
      }
      router.push("/login");
      toast.info("Logged out");
    },
    onError: () => {
      // Clear token locally even if server request fails
      clearStoredToken();
      localStorage.removeItem("ridgeway_user");
      clearUser();
      if (typeof window !== "undefined") {
        document.cookie = `ridgeway_auth=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `ridgeway_role=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `ridgeway_setup=; path=/; max-age=0; SameSite=Lax`;
      }
      router.push("/login");
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (userData) => registerUser(userData),
    onSuccess: (data) => {
      // Store tokens from registration response
      if (data?.accessToken) {
        setStoredToken(data.accessToken);
      }
      if (data?.refreshToken) {
        localStorage.setItem("ridgeway_refresh_token", data.refreshToken);
      }
      if (data?.user) {
        localStorage.setItem("ridgeway_user", JSON.stringify(data.user));
        setUser(data.user);
      }

      // Set auth cookie
      if (typeof window !== "undefined") {
        document.cookie = `ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax`;
        if (data?.user?.role) {
          document.cookie = `ridgeway_role=${data.user.role}; path=/; max-age=86400; SameSite=Lax`;
        }
        document.cookie = `ridgeway_setup=0; path=/; max-age=86400; SameSite=Lax`;
      }

      toast.success("Account created successfully!");

      router.replace("/setup");
    },
    onError: (error) => {
      toast.error(error.message || "Registration failed");
    },
  });

  // Token refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem("ridgeway_refresh_token");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }
      return refreshAccessToken(refreshToken);
    },
    onSuccess: (data) => {
      setStoredToken(data.accessToken);
    },
    onError: () => {
      clearStoredToken();
      router.push("/login");
    },
  });

  // Determine authentication status from token presence
  const isAuthenticated = !!getStoredToken();

  return {
    // Mutations
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    register: registerMutation.mutate,
    refreshToken: refreshMutation.mutate,

    // State
    isAuthenticated,
    isLoading:
      loginMutation.isPending ||
      logoutMutation.isPending ||
      registerMutation.isPending,

    // Errors
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    refreshError: refreshMutation.error,

    // Mutation status
    loginMutation,
    logoutMutation,
    registerMutation,
    refreshMutation,
  };
}
