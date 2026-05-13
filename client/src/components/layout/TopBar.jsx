"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { getLatestBriefing } from "@/lib/api";

const MONO = "var(--font-mono)";

const navLink = (active) => ({
  fontFamily: MONO,
  fontSize: "11px",
  fontWeight: active ? 600 : 400,
  color: active ? "var(--fg-1)" : "var(--fg-4)",
  textDecoration: "none",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  padding: "4px 0",
  borderBottom: active ? "1px solid var(--accent)" : "1px solid transparent",
  transition: "color 120ms ease, border-color 120ms ease",
  position: "relative",
});

function useNightDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TopBar() {
  const { user: currentUser, role: userRole } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef(null);
  const nightDate = useNightDate();

  const is = (prefix) =>
    Array.isArray(prefix)
      ? prefix.some((p) => pathname?.startsWith(p))
      : pathname?.startsWith(prefix);

  // Check briefing status for notification dot
  const { data: briefingData } = useQuery({
    queryKey: ["briefing-status", nightDate],
    queryFn: () => getLatestBriefing(nightDate),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const hasDraftBriefing = briefingData?.status === "draft";

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    localStorage.removeItem("ridgeway_token");
    localStorage.removeItem("ridgeway_refresh_token");
    localStorage.removeItem("ridgeway_user");
    useAuthStore.getState().clearUser();
    document.cookie = "ridgeway_auth=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "ridgeway_role=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "ridgeway_setup=; path=/; max-age=0; SameSite=Lax";
    router.replace("/login");
  }

  const displayUser = currentUser?.email || currentUser?.username || "";

  function formatRole(role) {
    if (role === "super_admin") return "Super Admin";
    if (role === "org_admin") return "Org Admin";
    if (role === "operator") return "Operator";
    return role || "";
  }

  const initials = displayUser
    ? displayUser.charAt(0).toUpperCase()
    : "?";

  const isAdmin = ["super_admin", "org_admin"].includes(userRole);

  return (
    <header style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      height: "56px",
      background: "var(--bg-surface-1)",
      borderBottom: "1px solid var(--border-default)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      paddingLeft: "20px",
      paddingRight: "20px",
      gap: "0",
    }}>
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginRight: "20px" }}>
        <span style={{
          width: "7px", height: "7px", borderRadius: "50%",
          background: "var(--accent)", flexShrink: 0,
        }} />
        <Link href="/dashboard" style={{
          fontFamily: MONO,
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--fg-1)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}>
          Ridgeway
        </Link>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "20px", background: "var(--border-default)", flexShrink: 0, marginRight: "20px" }} />

      {/* Primary Nav */}
      <nav style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1 }}>
        <Link href="/investigate" style={navLink(is(["/investigate", "/incident"]))}>
          Investigate
        </Link>
        <Link href="/briefing" style={{ ...navLink(is("/briefing")), position: "relative" }}>
          Briefing
          {hasDraftBriefing && (
            <span style={{
              position: "absolute",
              top: "-2px",
              right: "-8px",
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "var(--accent)",
            }} />
          )}
        </Link>
        <Link href="/dashboard" style={navLink(is("/dashboard"))}>
          Overview
        </Link>
      </nav>

      {/* Right: secondary nav + user dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        <Link href="/docs" style={navLink(is("/docs"))}>
          Docs
        </Link>
        {isAdmin && (
          <Link href="/settings/general" style={navLink(is("/settings"))}>
            Settings
          </Link>
        )}
        {userRole === "super_admin" && (
          <Link href="/admin/orgs" style={navLink(is("/admin"))}>
            Admin
          </Link>
        )}

        {/* Divider */}
        {currentUser && (
          <div style={{ width: "1px", height: "16px", background: "var(--border-default)" }} />
        )}

        {/* User dropdown */}
        {currentUser && (
          <div ref={dropRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                background: "var(--bg-surface-3)",
                border: "1px solid var(--border-strong)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--fg-2)",
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{
                  fontFamily: MONO,
                  fontSize: "11px",
                  color: "var(--fg-2)",
                  maxWidth: "140px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {displayUser}
                </span>
                {userRole && (
                  <span style={{
                    fontFamily: MONO,
                    fontSize: "9px",
                    color: "var(--fg-4)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    {formatRole(userRole)}
                  </span>
                )}
              </div>
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "200px",
                background: "var(--bg-surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                zIndex: 2000,
              }}>
                {/* User info header */}
                <div style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border-hairline)",
                }}>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: "11px",
                    color: "var(--fg-1)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: "2px",
                  }}>
                    {displayUser}
                  </div>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: "9px",
                    color: "var(--fg-4)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    {formatRole(userRole)}
                  </div>
                </div>

                {/* Links */}
                <div style={{ padding: "6px 0" }}>
                  {[
                    { label: "Profile", href: "/profile" },
                    ...(isAdmin ? [{ label: "Settings", href: "/settings/general" }] : []),
                    ...(userRole === "super_admin" ? [{ label: "Admin Panel", href: "/admin/orgs" }] : []),
                  ].map(({ label, href }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "block",
                        padding: "7px 14px",
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        color: "var(--fg-2)",
                        textDecoration: "none",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>

                {/* Divider + sign out */}
                <div style={{ borderTop: "1px solid var(--border-hairline)", padding: "6px 0 4px" }}>
                  <button
                    onClick={() => { setDropdownOpen(false); handleLogout(); }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "7px 14px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--sev-serious)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
