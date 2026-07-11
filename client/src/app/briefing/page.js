"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import BriefingDocument from "@/components/briefing/BriefingDocument";
import ApproveButton from "@/components/briefing/ApproveButton";
import { useBriefing, useBriefingStream } from "@/hooks/useBriefing";
import { formatNightLabel } from "@/lib/formatters";
import api from "@/lib/api";
import { toast } from "sonner";

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState("normal");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(8, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const diff = Math.max(0, target - now);
      const totalMins = Math.floor(diff / 60000);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
      setUrgency(
        totalMins < 30 ? "urgent" : totalMins < 60 ? "warn" : "normal",
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { timeLeft, urgency };
}

const SECTION_ORDER = [
  "executive_summary",
  "incidents",
  "recommendations",
  "anomalies",
  "follow_up",
];

export default function BriefingPage() {
  const nightDate = (() => {
    if (process.env.NEXT_PUBLIC_SEED_NIGHT_DATE)
      return process.env.NEXT_PUBLIC_SEED_NIGHT_DATE;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const { data, isLoading, refetch } = useBriefing(nightDate);
  const { timeLeft, urgency } = useCountdown();

  const briefing = data?.briefing || null;
  const isApproved = data?.isApproved || false;
  const canApprove = data?.canApprove || false;

  // Generation progress state (driven by SSE)
  const [genProgress, setGenProgress] = useState(0);
  const [genCompletedSections, setGenCompletedSections] = useState([]);

  const isGenerating = briefing?.status === "generating";

  useBriefingStream(isGenerating ? briefing?.id : null, {
    onSection: (name, progress) => {
      setGenProgress(progress);
      setGenCompletedSections((prev) => [...new Set([...prev, name])]);
    },
    onComplete: () => {
      setGenProgress(100);
      refetch();
    },
    onFailed: (reason) => {
      toast.error(`Briefing generation failed: ${reason || "unknown error"}`);
      refetch();
    },
  });

  // Reset progress counters when briefing changes
  useEffect(() => {
    if (!isGenerating) {
      setGenProgress(0);
      setGenCompletedSections([]);
    }
  }, [isGenerating]);

  const urgencyColor = {
    normal: "var(--fg-3)",
    warn: "var(--sev-minor)",
    urgent: "var(--sev-serious)",
  }[urgency];

  const handleRetry = async () => {
    try {
      await api.post(`/briefings/${briefing.id}/retry`);
      toast.success("Retry queued");
      refetch();
    } catch (err) {
      toast.error(`Retry failed: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <AppShell variant="briefing">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--fg-4)",
            }}
          >
            Loading…
          </span>
        </div>
      </AppShell>
    );
  }

  // ── STATE 1: No briefing ──────────────────────────────────────
  if (!briefing) {
    return (
      <AppShell variant="briefing">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "16px",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--fg-4)",
            }}
          >
            Briefing
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "20px",
              fontWeight: 500,
              color: "var(--fg-2)",
            }}
          >
            No briefing yet.
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              color: "var(--fg-4)",
              maxWidth: "320px",
            }}
          >
            Run an investigation from the Incidents workspace first. The briefing
            will appear once all incidents have been classified.
          </div>
          <Link
            href="/incidents"
            style={{
              marginTop: "8px",
              display: "inline-block",
              padding: "8px 20px",
              background: "var(--accent)",
              color: "var(--bg-base)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "2px",
            }}
          >
            Go to Investigate →
          </Link>
        </div>
      </AppShell>
    );
  }

  // ── STATE 2: Generating ───────────────────────────────────────
  if (briefing.status === "generating") {
    const progressPct = Math.max(
      genProgress,
      briefing.generationStartedAt ? 5 : 0,
    );
    return (
      <AppShell variant="briefing">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "32px",
            padding: "48px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--accent)",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--accent)",
                  animation: "pulse 2s ease-in-out infinite",
                  display: "inline-block",
                }}
              />
              Argus is drafting the briefing
            </div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "20px",
                fontWeight: 500,
                color: "var(--fg-1)",
              }}
            >
              Generation in progress…
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%", maxWidth: "480px" }}>
            <div
              style={{
                width: "100%",
                height: "4px",
                background: "var(--bg-surface-3)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "var(--accent)",
                  width: `${progressPct}%`,
                  transition: "width 400ms var(--ease-out)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--fg-3)",
              }}
            >
              <span>{progressPct}% complete</span>
              <span>
                {genCompletedSections.length} / {SECTION_ORDER.length} sections
              </span>
            </div>
          </div>

          {/* Section checklist */}
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {SECTION_ORDER.map((name) => {
              const done = genCompletedSections.includes(name);
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: done ? "var(--fg-2)" : "var(--fg-4)",
                  }}
                >
                  <span
                    style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "2px",
                      background: done
                        ? "var(--accent)"
                        : "var(--bg-surface-2)",
                      border: `1px solid ${done ? "var(--accent)" : "var(--border-default)"}`,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      color: "var(--bg-base)",
                    }}
                  >
                    {done ? "✓" : ""}
                  </span>
                  {name.replace(/_/g, " ").toUpperCase()}
                </div>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── STATE 4: Failed ───────────────────────────────────────────
  if (briefing.status === "failed") {
    return (
      <AppShell variant="briefing">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "16px",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              border: "1px solid var(--sev-serious)",
              background: "rgba(255,56,56,0.06)",
              maxWidth: "480px",
              width: "100%",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--sev-serious)",
                marginBottom: "8px",
              }}
            >
              Generation failed
            </div>
            {briefing.failureReason && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--fg-3)",
                }}
              >
                {briefing.failureReason}
              </div>
            )}
          </div>
          <button
            onClick={handleRetry}
            style={{
              padding: "8px 20px",
              background: "var(--bg-surface-2)",
              border: "1px solid var(--border-strong)",
              color: "var(--fg-1)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            Retry Generation
          </button>
          <Link
            href="/incidents"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--fg-4)",
              textDecoration: "none",
            }}
          >
            ← Back to Incidents
          </Link>
        </div>
      </AppShell>
    );
  }

  // ── STATE 3 & 4: Draft / Approved ─────────────────────────────
  return (
    <AppShell variant="briefing">
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Status banner */}
        {briefing.status === "approved" && (
          <div
            style={{
              width: "100%",
              padding: "8px 24px",
              background: "rgba(125,138,106,0.12)",
              borderBottom: "1px solid rgba(125,138,106,0.4)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--sev-harmless)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--sev-harmless)",
              }}
            />
            Briefing approved ✓ — ready for 8:00 AM
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 32px",
            borderBottom: "1px solid var(--border-hairline)",
            flexShrink: 0,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "24px",
                fontWeight: 500,
                color: "var(--fg-1)",
                margin: 0,
              }}
            >
              Morning Briefing
            </h1>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--fg-3)",
                marginTop: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {formatNightLabel(nightDate)}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "17px",
                  fontWeight: 600,
                  color: urgencyColor,
                }}
              >
                {timeLeft}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--fg-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                until 08:00
              </div>
            </div>
            <ApproveButton
              briefingId={briefing?.id}
              canApprove={canApprove}
              isApproved={isApproved}
              approvedAt={briefing?.approvedAt}
            />
          </div>
        </div>

        {/* Document body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <BriefingDocument briefing={briefing} isApproved={isApproved} />
        </div>
      </div>
    </AppShell>
  );
}
