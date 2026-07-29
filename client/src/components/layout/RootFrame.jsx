"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import { useAuthStore } from "@/store/authStore";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/opt",
  "/docs",
  "/forgot-password",
  "/reset-password",
  "/suspended",
  "/forbidden",
]);

export default function RootFrame({ children }) {
  const pathname = usePathname();
  const path = pathname || "";
  const role = useAuthStore((s) => s.role);
  const isPublicRoute =
    PUBLIC_ROUTES.has(path) ||
    path.startsWith("/reset-password");

  const suppressTopBar = isPublicRoute || path.startsWith("/admin");

  // Middleware gates /settings/* on ridgeway_role. Persist store may have the
  // role while the cookie was cleared — keep them aligned.
  useEffect(() => {
    if (typeof document === "undefined" || !role) return;
    const hasRoleCookie = document.cookie.split(";").some((c) => c.trim().startsWith("ridgeway_role="));
    if (!hasRoleCookie) {
      document.cookie = `ridgeway_role=${role}; path=/; max-age=86400; SameSite=Lax`;
    }
  }, [role]);

  return (
    <>
      {!suppressTopBar && <a href="#main" className="skip-to-content">Skip to content</a>}
      {!suppressTopBar ? <TopBar /> : null}
      <div id={suppressTopBar ? undefined : "main"} style={{ paddingTop: suppressTopBar ? "0" : "56px" }}>{children}</div>
    </>
  );
}
