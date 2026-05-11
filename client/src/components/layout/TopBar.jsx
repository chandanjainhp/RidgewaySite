"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function TopBar() {
  const [time, setTime] = useState("");
  const [nightLabel, setNightLabel] = useState("Night of --");
  const { user: currentUser, role: userRole } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };

    const loadCurrentUser = () => {
      // Zustand handles the initial state loading automatically with persist middleware,
      // but if we need a sync read we can still check localStorage as fallback if needed.
    };

    const updateNightLabel = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const parts = new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).formatToParts(d);
      const weekday = parts.find((p) => p.type === "weekday")?.value || "";
      const day = parts.find((p) => p.type === "day")?.value || "";
      const month = parts.find((p) => p.type === "month")?.value || "";
      setNightLabel(`Night of ${weekday} ${day} ${month}`.trim());
    };

    updateTime();
    updateNightLabel();
    loadCurrentUser();

    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const investigateActive = pathname?.startsWith("/investigate") || pathname?.startsWith("/incident");
  const briefingActive = pathname?.startsWith("/briefing");
  const profileActive = pathname?.startsWith("/profile");
  const adminActive = pathname?.startsWith("/admin");
  const settingsActive = pathname?.startsWith("/settings");

  async function handleLogout() {
    localStorage.removeItem("ridgeway_token");
    localStorage.removeItem("ridgeway_refresh_token");
    localStorage.removeItem("ridgeway_user");
    useAuthStore.getState().clearUser();
    document.cookie = "ridgeway_auth=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "ridgeway_role=; path=/; max-age=0; SameSite=Lax";
    router.push("/login");
  }

  const displayUser = currentUser?.email || currentUser?.username || "";

  function formatRole(role) {
    if (role === "super_admin") return "Super Admin";
    if (role === "org_admin") return "Org Admin";
    if (role === "operator") return "Operator";
    return role || "";
  }

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "56px",
        backgroundColor: "#0f1117",
        borderBottom: "1px solid #2a3347",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        paddingLeft: "20px",
        paddingRight: "20px",
      }}
    >
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: "12px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: "#22c55e",
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "13px",
            fontWeight: 600,
            color: "#e2e8f0",
            letterSpacing: "0.04em",
          }}
        >
          RIDGEWAY SITE
        </span>
        <span style={{ color: "#2a3347", margin: "0 16px" }}>|</span>
        <nav style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/investigate"
            style={{
              fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "11px",
              color: investigateActive ? "#e2e8f0" : "#4a5568",
              textDecoration: "none",
              letterSpacing: "0.08em",
            }}
          >
            INVESTIGATE
          </Link>
          <Link
            href="/briefing"
            style={{
              fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "11px",
              color: briefingActive ? "#e2e8f0" : "#4a5568",
              textDecoration: "none",
              letterSpacing: "0.08em",
            }}
          >
            BRIEFING
          </Link>
          <Link
            href="/profile"
            style={{
              fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "11px",
              color: profileActive ? "#e2e8f0" : "#4a5568",
              textDecoration: "none",
              letterSpacing: "0.08em",
            }}
          >
            PROFILE
          </Link>
          {['super_admin', 'org_admin'].includes(userRole) && (
            <Link
              href="/settings/general"
              style={{
                fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "11px",
                color: settingsActive ? "#e2e8f0" : "#4a5568",
                textDecoration: "none",
                letterSpacing: "0.08em",
              }}
            >
              SETTINGS
            </Link>
          )}
          {userRole === 'super_admin' && (
            <Link
              href="/admin/orgs"
              style={{
                fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "11px",
                color: adminActive ? "#e2e8f0" : "#4a5568",
                textDecoration: "none",
                letterSpacing: "0.08em",
              }}
            >
              ADMIN
            </Link>
          )}
        </nav>
      </div>

      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: "12px",
          color: "#8892a4",
        }}
      >
        {nightLabel}
      </div>

      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: "16px" }}>
        {displayUser ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
            <Link
              href="/profile"
              style={{
                fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "10px",
                color: profileActive ? "#8892a4" : "#4a5568",
                maxWidth: "150px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              title={displayUser}
            >
              {displayUser}
            </Link>
            {userRole ? (
              <span
                style={{
                  fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "9px",
                  color: "#374151",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {formatRole(userRole)}
              </span>
            ) : null}
          </div>
        ) : null}
        <span
          style={{
            fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "13px",
            color: "#e2e8f0",
          }}
        >
          {time}
        </span>
        {currentUser && (
          <button
            type="button"
            onClick={handleLogout}
            style={{
              fontFamily: "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "10px",
              color: "#4a5568",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#4a5568";
            }}
          >
            SIGN OUT
          </button>
        )}
      </div>
    </header>
  );
}
