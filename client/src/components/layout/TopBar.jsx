"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
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
  const firstItemRef = useRef(null);
  const nightDate = useNightDate();

  const is = (prefix) =>
    Array.isArray(prefix)
      ? prefix.some((p) => pathname?.startsWith(p))
      : pathname?.startsWith(prefix);

  // Check briefing status for notification dot
  const { data: briefingData } = useQuery({
    queryKey: ["briefing-status", nightDate],
    queryFn: () => getLatestBriefing(nightDate),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const hasDraftBriefing = briefingData?.status === "draft";

  // Close dropdown on outside click + escape; focus first item on open
  useEffect(() => {
    function clickHandler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    function keyHandler(e) {
      if (e.key === "Escape" && dropdownOpen) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    if (dropdownOpen && firstItemRef.current) {
      firstItemRef.current.focus();
    }
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [dropdownOpen]);

  function handleMenuKeyDown(e) {
    const items = dropRef.current?.querySelectorAll('[role="menuitem"]') || [];
    if (!items.length) return;
    const currentIndex = Array.from(items).indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[(currentIndex + 1) % items.length];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[(currentIndex - 1 + items.length) % items.length];
      prev?.focus();
    }
  }

  async function handleLogout() {
    localStorage.removeItem("ridgeway_token");
    localStorage.removeItem("ridgeway_refresh_token");
    localStorage.removeItem("ridgeway_user");
    useAuthStore.getState().clearUser();
    document.cookie = "ridgeway_auth=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "ridgeway_role=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "ridgeway_setup=; path=/; max-age=0; SameSite=Lax";
    router.replace("/");
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
        <Link href="/overview" style={{
          fontFamily: MONO,
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--fg-1)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}>
          Sentinel
        </Link>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "20px", background: "var(--border-default)", flexShrink: 0, marginRight: "20px" }} />

      {/* Primary Nav */}
      <nav style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1 }}>
        <Link href="/overview" style={navLink(is(["/overview", "/dashboard"]))}>
          Overview
        </Link>
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
          <div ref={dropRef} style={{ position: "relative" }} onKeyDown={handleMenuKeyDown}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                cursor: "pointer",
                padding: "4px 8px 4px 4px",
                transition: "background var(--dur-fast)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
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
                  {displayUser.length > 18 ? displayUser.slice(0, 18) + "…" : displayUser}
                </span>
                {userRole && (
                  <span style={{
                    fontFamily: MONO,
                    fontSize: "11px",
                    color: "var(--fg-3)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    {formatRole(userRole)}
                  </span>
                )}
              </div>
              <ChevronDown
                size={14}
                style={{
                  color: "var(--fg-3)",
                  transition: "transform var(--dur-fast) var(--ease-out)",
                  transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "240px",
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm, 4px)",
                  boxShadow: "var(--shadow-modal, 0 4px 16px rgba(0,0,0,0.4))",
                  padding: "4px",
                  zIndex: 2000,
                }}
              >
                {/* User info header */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-hairline)",
                  marginBottom: "4px",
                }}>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: "12px",
                    color: "var(--fg-1)",
                    wordBreak: "break-all",
                    marginBottom: "4px",
                  }}>
                    {displayUser}
                  </div>
                  <div style={{
                    fontFamily: MONO,
                    fontSize: "11px",
                    color: "var(--fg-3)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    {formatRole(userRole)}
                  </div>
                </div>

                {/* Items */}
                {[
                  { label: "Profile", href: "/profile" },
                  {
                    label: "Settings",
                    href: isAdmin ? "/settings/general" : "/settings/documents",
                  },
                  ...(userRole === "super_admin"
                    ? [{ label: "Admin Panel", href: "/admin/orgs" }]
                    : []),
                ].map(({ label, href }, idx) => (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    ref={idx === 0 ? firstItemRef : null}
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: "block",
                      padding: "10px 16px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-sm, 13px)",
                      color: "var(--fg-2)",
                      textDecoration: "none",
                      transition: "background 120ms, color 120ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-surface-3)";
                      e.currentTarget.style.color = "var(--fg-1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--fg-2)";
                    }}
                  >
                    {label}
                  </Link>
                ))}

                {/* Divider */}
                <div style={{
                  height: "1px",
                  background: "var(--border-hairline)",
                  margin: "4px 0",
                }} />

                {/* Sign out */}
                <button
                  role="menuitem"
                  onClick={() => { setDropdownOpen(false); handleLogout(); }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 16px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-sm, 13px)",
                    color: "var(--sev-serious-text, var(--sev-serious))",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
