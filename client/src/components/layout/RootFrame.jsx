"use client";

import { usePathname } from "next/navigation";
import TopBar from "@/components/layout/TopBar";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/opt",
  "/forgot-password",
  "/reset-password",
  "/suspended",
  "/forbidden",
  "/invite/accept",
]);

export default function RootFrame({ children }) {
  const pathname = usePathname();
  const path = pathname || "";
  const isPublicRoute =
    PUBLIC_ROUTES.has(path) ||
    path.startsWith("/reset-password") ||
    path.startsWith("/invite/accept");

  const suppressTopBar = isPublicRoute || path.startsWith("/admin");

  return (
    <>
      {!suppressTopBar ? <TopBar /> : null}
      <div style={{ paddingTop: suppressTopBar ? "0" : "56px" }}>{children}</div>
    </>
  );
}
