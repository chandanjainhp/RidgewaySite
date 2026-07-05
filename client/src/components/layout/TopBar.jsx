"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  const pathname = usePathname();
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
      <nav aria-label="Primary navigation" style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1 }}>
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
        <Link href="/docs" style={navLink(is("/docs"))}>
          Docs
        </Link>
      </nav>
    </header>
  );
}
