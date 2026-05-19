"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useInvestigationStore } from "@/store/investigationStore";
import { useAuth } from "@/hooks/useAuth";
import { useMapStore } from "@/store/mapStore";
import { useDroneReplay } from "@/hooks/useDroneReplay";
import { useIncidents } from "@/hooks/useIncidents";
import { useStartInvestigation } from "@/hooks/useInvestigation";
import { useAgentStream } from "@/hooks/useAgentStream";
import AgentFeed from "@/components/agent/AgentFeed";
import StatusBar from "@/components/layout/StatusBar";
import EventPanel from "@/components/events/EventPanel";
import { useQuery } from "@tanstack/react-query";
import { clearStoredToken, getEventPins } from "@/lib/api";
import useSiteMap from "@/hooks/useSiteMap";
import { toast } from "sonner";
import { X } from "lucide-react";

const DroneTimeline = dynamic(
  () => import("@/components/map/DroneTimeline"),
  { ssr: false }
);

const SiteMap = dynamic(
  () => import("@/components/map/SiteMap"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: "100%", width: "100%",
        background: "var(--bg-canvas)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "8px",
      }}>
        <span style={{
          display: "inline-block", width: "6px", height: "6px", borderRadius: "50%",
          background: "var(--accent)",
          animation: "status-pulse 1.4s ease-in-out infinite",
        }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "10px",
          color: "var(--fg-4)", letterSpacing: "0.12em", textTransform: "uppercase",
        }}>Loading map…</span>
      </div>
    ),
  }
);

/* ── column header shared styles ────────────────────── */
const COL_HEAD = {
  wrapper: {
    display: "flex", alignItems: "center", gap: "9px",
    padding: "0 16px", height: "40px", flexShrink: 0,
    background: "var(--bg-surface-1)",
    borderBottom: "1px solid var(--border-default)",
  },
  title: {
    fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 600,
    letterSpacing: "0.14em", color: "var(--fg-1)", textTransform: "uppercase",
  },
  sub: {
    fontFamily: "var(--font-mono)", fontSize: "10px",
    color: "var(--fg-4)", marginLeft: "auto",
    fontVariantNumeric: "tabular-nums",
  },
  liveDot: {
    width: "7px", height: "7px", borderRadius: "50%",
    background: "var(--accent)",
    boxShadow: "0 0 8px rgba(184,212,232,.6)",
    animation: "status-pulse 1.6s ease-in-out infinite",
    flexShrink: 0,
  },
};

export default function InvestigationView() {
  const router = useRouter();
  const nightDate = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SEED_NIGHT_DATE) return process.env.NEXT_PUBLIC_SEED_NIGHT_DATE;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const dismissed = sessionStorage.getItem('ridgeway_welcome_dismissed');
      // If user has lastLoginAt within last 5 minutes, show banner
      const loginTime = new Date(user.lastLoginAt).getTime();
      const now = new Date().getTime();
      if (!dismissed && (now - loginTime < 5 * 60 * 1000 || user.firstLogin)) {
        setShowWelcome(true);
      }
    }
  }, [user]);

  const dismissWelcome = () => {
    sessionStorage.setItem('ridgeway_welcome_dismissed', 'true');
    setShowWelcome(false);
  };

  const jobId     = useInvestigationStore((s) => s.jobId);
  const jobStatus = useInvestigationStore((s) => s.jobStatus);
  const stats     = useInvestigationStore((s) => s.investigationStats);
  const feedItems = useInvestigationStore((s) => s.feedItems);

  const setSiteMapData = useMapStore((s) => s.setSiteMapData);
  const setEventPins   = useMapStore((s) => s.setEventPins);

  const { data: incidentsData, isError: isIncidentsError, error: incidentsError } = useIncidents({ nightDate });
  const { mutate: startInvestigation, isPending: isStarting } = useStartInvestigation();

  useAgentStream(jobId);
  useDroneReplay("PATROL-2026-04-15-N01");

  const { data: siteMapData, isLoading: isMapLoading, isError: isMapError, error: mapError } = useSiteMap();

  const { data: eventPins, isError: isPinsError, error: pinsError } = useQuery({
    queryKey: ["eventPins", nightDate],
    queryFn: () => getEventPins(nightDate),
    enabled: !!nightDate,
    staleTime: 30000,
    retry: (n, err) => {
      if (err?.statusCode === 401 || err?.statusCode === 403) return false;
      return n < (err?.statusCode ? 1 : 2);
    },
    refetchInterval: jobStatus === "running" ? 5000 : false,
  });

  /* auth / error toasts */
  useEffect(() => {
    const authErr = [incidentsError, mapError, pinsError].find(
      (e) => e?.statusCode === 401 || e?.statusCode === 403 || e?.type === "UNAUTHORIZED"
    );
    if (authErr) {
      clearStoredToken();
      toast.error("Session expired.");
      router.replace("/login");
      return;
    }
    if (isIncidentsError || isMapError || isPinsError) {
      toast.error(`Data error: ${incidentsError?.message || mapError?.message || pinsError?.message}`);
    }
  }, [isIncidentsError, isMapError, isPinsError, incidentsError, mapError, pinsError, router]);

  /* populate stores */
  useEffect(() => { if (siteMapData) setSiteMapData(siteMapData); }, [siteMapData]);
  useEffect(() => { if (eventPins?.length > 0) setEventPins(eventPins); }, [eventPins]);

  /* col-head metadata */
  const toolCallCount = feedItems.filter((i) => i.type === "tool_called").length;
  const totalEvents   = incidentsData?.incidents?.length ?? 0;
  const reviewPending = stats.escalationCount ?? 0;
  const isLive        = jobStatus === "running";
  const activityCollapsed = jobStatus === "idle" && !jobId && !activityExpanded;

  return (
    <div style={{
      position: "fixed", top: "56px", left: 0, right: 0, bottom: 0,
      display: "grid", gridTemplateRows: showWelcome ? "auto auto 1fr" : "auto 1fr",
      background: "var(--bg-base)", overflow: "hidden",
    }}>

      {/* ── WELCOME BANNER ──────────────────────────────── */}
      {showWelcome && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          background: "var(--bg-surface-2)",
          borderBottom: "1px solid var(--accent-dim)",
          position: "relative", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              display: "flex", width: "22px", height: "22px",
              alignItems: "center", justifyContent: "center",
              borderRadius: "50%",
              background: "rgba(184,212,232,0.12)",
              fontSize: "13px", flexShrink: 0,
            }}>👋</span>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
              color: "var(--fg-2)", margin: 0,
            }}>
              Welcome to Sentinel. Platform configured — tonight&apos;s events will appear here tomorrow morning.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, marginLeft: "16px" }}>
            <button
              onClick={dismissWelcome}
              style={{
                background: "transparent", border: "none",
                color: "var(--fg-4)", cursor: "pointer", padding: "4px",
                display: "flex", alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STATUS BAR ──────────────────────────────────── */}
      <StatusBar
        jobStatus={jobStatus}
        resolvedIncidents={stats.resolvedIncidents}
        totalIncidents={stats.totalIncidents}
        escalationCount={stats.escalationCount}
        diagnosticMessage={
          incidentsError?.message || mapError?.message || pinsError?.message || null
        }
        onReviewBriefing={() => router.push("/briefing")}
      />

      {/* ── THREE-COLUMN GRID ────────────────────────────── */}
      {/* Activity column collapses to 56px rail when idle and no jobId. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: activityCollapsed ? "56px 1fr 360px" : "360px 1fr 360px",
        gap: "1px",
        background: "var(--border-default)",
        overflow: "hidden", minHeight: 0,
        transition: "grid-template-columns var(--dur-med, 220ms) var(--ease-out, ease-out)",
      }}>

        {/* ══ LEFT · Argus Activity ════════════════════════ */}
        <aside aria-label="Argus activity" style={{
          background: "var(--bg-base)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0,
          position: "relative",
        }}>
          {activityCollapsed ? (
            <button
              onClick={() => setActivityExpanded(true)}
              aria-label="Expand Argus activity column"
              style={{
                height: "100%", width: "100%",
                background: "var(--bg-surface-1)",
                border: "none",
                borderRight: "1px solid var(--border-default)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "space-between",
                padding: "16px 0",
                cursor: "pointer",
                color: "var(--fg-3)",
              }}
            >
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
                letterSpacing: "0.18em", textTransform: "uppercase",
                color: "var(--fg-2)",
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
              }}>
                Argus
              </span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "10px",
                color: "var(--fg-4)",
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
              }}>
                {toolCallCount} calls
              </span>
            </button>
          ) : (
            <>
              {/* Column header */}
              <div style={{
                ...COL_HEAD.wrapper,
                borderLeft: isLive ? "2px solid var(--accent)" : "2px solid transparent",
                paddingLeft: isLive ? "14px" : "16px",
              }}>
                {isLive && <span style={COL_HEAD.liveDot} />}
                <span style={COL_HEAD.title}>Argus Activity</span>
                <span style={COL_HEAD.sub}>
                  {stats.totalIncidents > 0
                    ? `${stats.resolvedIncidents}/${stats.totalIncidents} · `
                    : ""}
                  {toolCallCount} calls
                </span>
              </div>
              <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                {jobStatus === "idle" && !jobId ? (
                  <div style={{
                    height: "100%", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "16px",
                    padding: "24px",
                  }}>
                    <p style={{
                      fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)",
                      color: "var(--fg-3)", textAlign: "center", margin: 0,
                    }}>
                      No Argus activity yet.
                    </p>
                  </div>
                ) : (
                  <AgentFeed />
                )}
              </div>
            </>
          )}
        </aside>

        {/* ══ CENTER · Site Map ═════════════════════════════ */}
        <div style={{
          background: "var(--bg-base)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0,
        }}>
          {/* Column header */}
          <div style={COL_HEAD.wrapper}>
            <span style={COL_HEAD.title}>Site Map</span>
            <span style={COL_HEAD.sub}>SENTINEL · 6 ZONES · DRONE RWY-03</span>
          </div>

          {/* Map — takes all remaining vertical space */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
            <SiteMap
              siteMapData={siteMapData}
              eventPins={eventPins}
              isLoading={isMapLoading}
              isError={isMapError}
              errorMessage={mapError?.message}
              nightDate={nightDate}
            />

            {/* Start-investigation overlay — only when activity column is collapsed */}
            {activityCollapsed && (
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                background: "var(--bg-surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm, 4px)",
                padding: "20px 24px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
                boxShadow: "var(--shadow-modal, 0 4px 16px rgba(0,0,0,0.4))",
                zIndex: 500,
              }}>
                <p style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)",
                  color: "var(--fg-3)", textAlign: "center", margin: 0,
                }}>
                  No investigation running for {nightDate}.
                </p>
                <button
                  onClick={() => startInvestigation({ nightDate })}
                  disabled={isStarting}
                  style={{
                    background: "var(--accent)", color: "var(--bg-base)",
                    border: "none", borderRadius: "var(--radius-xs)",
                    padding: "8px 20px", fontSize: "var(--text-sm)",
                    fontFamily: "var(--font-sans)", fontWeight: 600,
                    cursor: isStarting ? "not-allowed" : "pointer",
                    opacity: isStarting ? 0.6 : 1,
                    letterSpacing: "0.02em",
                  }}
                >
                  {isStarting ? "Starting…" : "Start investigation"}
                </button>
              </div>
            )}
          </div>

          {/* Drone timeline scrubber — pinned at map bottom */}
          <div style={{ flexShrink: 0 }}>
            <DroneTimeline />
          </div>
        </div>

        {/* ══ RIGHT · Events ════════════════════════════════ */}
        <aside aria-label="Events list" style={{
          background: "var(--bg-base)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", minHeight: 0,
        }}>
          {/* Column header */}
          <div style={{
            ...COL_HEAD.wrapper,
            borderLeft: reviewPending > 0 ? "2px solid var(--sev-serious)" : "2px solid transparent",
            paddingLeft: reviewPending > 0 ? "14px" : "16px",
          }}>
            {reviewPending > 0 && (
              <span style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: "var(--sev-serious)",
                boxShadow: "var(--glow-serious)",
                animation: "status-pulse 1.4s ease-in-out infinite",
                flexShrink: 0,
              }} />
            )}
            <span style={COL_HEAD.title}>Events</span>
            <span style={COL_HEAD.sub}>
              {totalEvents} logged
              {reviewPending > 0 && (
                <span style={{ color: "var(--sev-serious)", marginLeft: "6px" }}>
                  · {reviewPending} review
                </span>
              )}
            </span>
          </div>
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <EventPanel nightDate={nightDate} />
          </div>
        </aside>

      </div>
    </div>
  );
}
