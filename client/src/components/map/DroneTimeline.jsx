"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMapStore } from "@/store/mapStore";
import { NIGHT_START_HOUR } from "@/config/constants";

const NIGHT_DURATION_MINS = 8 * 60; // 22:00 → 06:00
const NIGHT_DURATION_SECS = NIGHT_DURATION_MINS * 60;
const TICK_INTERVAL_MS    = 200;
const SPEED_OPTIONS       = [1, 2, 4];

/* ── time helpers ─────────────────────────────────── */

function secsToDisplayTime(totalSecs) {
  const clamped = Math.max(0, Math.min(totalSecs, NIGHT_DURATION_SECS));
  const totalMins = Math.floor(clamped / 60);
  let h = Math.floor(NIGHT_START_HOUR + totalMins / 60);
  const m = totalMins % 60;
  const s = Math.floor(clamped % 60);
  if (h >= 24) h -= 24;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pctToSecs(pct) {
  return (pct / 100) * NIGHT_DURATION_SECS;
}

function secsToPct(secs) {
  return Math.min(100, Math.max(0, (secs / NIGHT_DURATION_SECS) * 100));
}

function pctToHHMM(pct) {
  const totalMins = Math.floor((pct / 100) * NIGHT_DURATION_MINS);
  let h = Math.floor(NIGHT_START_HOUR + totalMins / 60);
  const m = totalMins % 60;
  if (h >= 24) h -= 24;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timestampToPct(timestamp) {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  let h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  if (h < NIGHT_START_HOUR - 12) h += 24; // normalize overnight hours (00-06 → 24-30)
  const minsFromStart = (h - NIGHT_START_HOUR) * 60 + m + s / 60;
  if (minsFromStart < 0 || minsFromStart > NIGHT_DURATION_MINS) return null;
  return (minsFromStart / NIGHT_DURATION_MINS) * 100;
}

function formatSpan(startHHMM, endHHMM) {
  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  let startTotal = sh * 60 + sm;
  let endTotal   = eh * 60 + em;
  if (endTotal < startTotal) endTotal += 24 * 60;
  const diff = endTotal - startTotal;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}H ${String(m).padStart(2, "0")}M`;
}

/* ── severity tick colours ────────────────────────── */

const SEV_TICK_COLOR = {
  escalate:  "var(--sev-serious)",
  serious:   "var(--sev-serious)",
  monitor:   "var(--sev-minor)",
  minor:     "var(--sev-minor)",
  harmless:  "var(--sev-harmless)",
  uncertain: "var(--fg-4)",
  unknown:   "var(--fg-4)",
};

const SEV_LEGEND = [
  { key: "serious",  label: "Serious",  color: "var(--sev-serious)"  },
  { key: "minor",    label: "Minor",    color: "var(--sev-minor)"    },
  { key: "harmless", label: "Harmless", color: "var(--sev-harmless)" },
];

/* ══ Component ════════════════════════════════════════ */

export default function DroneTimeline() {
  const timelinePosition    = useMapStore((s) => s.timelinePosition);
  const setTimelinePosition = useMapStore((s) => s.setTimelinePosition);
  const setTimelineTime     = useMapStore((s) => s.setTimelineTime);
  const eventPins           = useMapStore((s) => s.eventPins);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed,     setSpeed]     = useState(1);
  const [muted,     setMuted]     = useState(true);

  // Stable ref so interval callback always reads latest position without re-subscribing
  const posRef = useRef(timelinePosition);
  posRef.current = timelinePosition;

  /* ── scrubber drag ── */
  const handleChange = useCallback((e) => {
    const pct = parseFloat(e.target.value);
    setTimelinePosition(pct);
    setTimelineTime(pctToHHMM(pct));
  }, [setTimelinePosition, setTimelineTime]);

  /* ── transport buttons ── */
  const skipToStart = () => {
    setIsPlaying(false);
    setTimelinePosition(0);
    setTimelineTime(pctToHHMM(0));
  };

  const skipToEnd = () => {
    setIsPlaying(false);
    setTimelinePosition(100);
    setTimelineTime(pctToHHMM(100));
  };

  const cycleSpeed = () =>
    setSpeed((s) => SPEED_OPTIONS[(SPEED_OPTIONS.indexOf(s) + 1) % SPEED_OPTIONS.length]);

  /* ── playback ticker ── */
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const currentSecs = pctToSecs(posRef.current);
      const nextSecs    = currentSecs + speed;
      if (nextSecs >= NIGHT_DURATION_SECS) {
        setIsPlaying(false);
        setTimelinePosition(100);
        setTimelineTime(pctToHHMM(100));
        return;
      }
      const newPct = secsToPct(nextSecs);
      setTimelinePosition(newPct);
      setTimelineTime(pctToHHMM(newPct));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, speed, setTimelinePosition, setTimelineTime]);

  /* ── derived display values ── */
  const currentSecs   = pctToSecs(timelinePosition);
  const nowString     = secsToDisplayTime(currentSecs);
  const startLabel    = "22:00";

  const ticks = eventPins
    .map((pin) => ({
      pct: timestampToPct(pin.timestamp || pin.time || pin.detectedAt),
      sev: pin.severity,
    }))
    .filter((t) => t.pct !== null);

  const maxTickPct = ticks.length > 0 ? Math.max(...ticks.map((t) => t.pct)) : null;
  const endLabel   = maxTickPct !== null ? pctToHHMM(maxTickPct) : pctToHHMM(100);
  const duration   = formatSpan(startLabel, endLabel);

  return (
    <>
      <style>{`
        .tl-btn {
          display:flex; align-items:center; justify-content:center;
          width:26px; height:26px; flex-shrink:0;
          background:var(--bg-surface-2); border:1px solid var(--border-default);
          border-radius:2px; color:var(--fg-3); cursor:pointer; padding:0;
          transition:background 100ms, color 100ms;
        }
        .tl-btn:hover { background:var(--bg-surface-3) !important; color:var(--fg-1) !important; }
        .tl-spd {
          display:flex; align-items:center; gap:4px;
          height:26px; padding:0 8px; flex-shrink:0;
          background:var(--bg-surface-2); border:1px solid var(--border-default);
          border-radius:2px; color:var(--fg-2); cursor:pointer;
          font-family:var(--font-mono); font-size:10px; font-weight:600; letter-spacing:0.06em;
          transition:background 100ms, color 100ms;
        }
        .tl-spd:hover { background:var(--bg-surface-3); color:var(--fg-1); }
        .tl-range {
          position:absolute; inset:0; width:100%; height:100%;
          opacity:0; cursor:pointer;
          -webkit-appearance:none; appearance:none; margin:0; z-index:2;
        }
      `}</style>

      <div style={{
        width: "100%",
        background: "var(--bg-surface-1)",
        borderTop: "1px solid var(--border-default)",
        boxSizing: "border-box",
        flexShrink: 0,
      }}>

        {/* ── Header row ───────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          height: "26px", padding: "0 16px",
          borderBottom: "1px solid var(--border-hairline)",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--fg-4)",
          }}>
            Drone Replay Scrubber · Transport Controls + Severity Ticks
          </span>
        </div>

        {/* ── Controls row ─────────────────────────────── */}
        <div style={{
          height: "44px", display: "flex", alignItems: "center",
          padding: "0 16px", gap: "10px", boxSizing: "border-box",
        }}>

          {/* Skip to start */}
          <button type="button" className="tl-btn" onClick={skipToStart} aria-label="Skip to start">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="2" height="10" rx="0.5" />
              <polygon points="11,1 4,6 11,11" />
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            className="tl-btn"
            onClick={() => setIsPlaying((v) => !v)}
            aria-label={isPlaying ? "Pause" : "Play"}
            style={{ color: isPlaying ? "var(--accent)" : undefined }}
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="1" width="3" height="10" rx="0.5" />
                <rect x="7" y="1" width="3" height="10" rx="0.5" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <polygon points="2,1 10,6 2,11" />
              </svg>
            )}
          </button>

          {/* Skip to end */}
          <button type="button" className="tl-btn" onClick={skipToEnd} aria-label="Skip to end">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="9" y="1" width="2" height="10" rx="0.5" />
              <polygon points="1,1 8,6 1,11" />
            </svg>
          </button>

          {/* Current time — seconds-accurate */}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            color: "var(--fg-2)", minWidth: "62px", flexShrink: 0,
            fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em",
          }}>
            {nowString}
          </span>

          {/* ── Scrubber track ── */}
          <div style={{
            flex: 1, position: "relative",
            height: "4px", borderRadius: "2px",
            background: "var(--bg-surface-3)",
            cursor: "pointer",
          }}>
            {/* Filled progress */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${timelinePosition}%`,
              background: "var(--accent-dim)",
              borderRadius: "2px",
              pointerEvents: "none",
            }} />

            {/* Event tick marks */}
            {ticks.map((t, i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${t.pct}%`,
                top: "-3px", bottom: "-3px",
                width: "2px",
                background: SEV_TICK_COLOR[t.sev] || "var(--fg-4)",
                pointerEvents: "none",
                zIndex: 1,
              }} />
            ))}

            {/* Playhead handle */}
            <div style={{
              position: "absolute",
              left: `${timelinePosition}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "12px", height: "12px",
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 0 3px rgba(184,212,232,.18), 0 0 10px rgba(184,212,232,.45)",
              pointerEvents: "none", zIndex: 2,
              transition: isPlaying ? "left 180ms linear" : "none",
            }} />

            {/* Native range input — invisible, interaction only */}
            <input
              type="range"
              className="tl-range"
              min="0" max="100" step="0.1"
              value={timelinePosition}
              onChange={handleChange}
              aria-label="Drone patrol replay timeline"
            />
          </div>

          {/* End time */}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            color: "var(--fg-3)", minWidth: "36px", flexShrink: 0,
            textAlign: "right", fontVariantNumeric: "tabular-nums",
          }}>
            {endLabel}
          </span>

          {/* Speed button */}
          <button type="button" className="tl-spd" onClick={cycleSpeed} title="Cycle playback speed">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <circle cx="5" cy="5" r="4" />
              <path d="M5 2.5V5l1.5 1.5" />
            </svg>
            {speed}×
          </button>

          {/* Mute / Volume (cosmetic) */}
          <button
            type="button"
            className="tl-btn"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4.5H4L7.5 2V11L4 8.5H2V4.5Z" fill="currentColor" stroke="none" opacity=".45" />
                <line x1="9.5" y1="4.5" x2="12" y2="8.5" />
                <line x1="12" y1="4.5" x2="9.5" y2="8.5" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4.5H4L7.5 2V11L4 8.5H2V4.5Z" fill="currentColor" stroke="none" />
                <path d="M9.5 3.5C10.6 4.6 11.3 5.5 11.3 6.5C11.3 7.5 10.6 8.4 9.5 9.5" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Legend row ───────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: "28px", padding: "0 16px",
          borderTop: "1px solid var(--border-hairline)",
        }}>
          {/* Severity dots */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {SEV_LEGEND.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{
                  width: "7px", height: "7px", borderRadius: "1px",
                  background: s.color, flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 600,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: s.color,
                }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Time range summary */}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--fg-4)", letterSpacing: "0.06em",
            fontVariantNumeric: "tabular-nums",
          }}>
            {startLabel} · {endLabel} · {duration}
          </span>
        </div>

      </div>
    </>
  );
}
