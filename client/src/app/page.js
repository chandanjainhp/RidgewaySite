"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plane, Radar, Search, FileText, Shield, Settings, Server } from "lucide-react";

/* ── helpers ─────────────────────────────────────────── */
const SEV = {
  serious: {
    dot: "var(--sev-serious)",
    bg: "var(--sev-serious-bg)",
    border: "var(--sev-serious-dim)",
    text: "var(--sev-serious)",
    glow: "var(--glow-serious)",
  },
  minor: {
    dot: "var(--sev-minor)",
    bg: "var(--sev-minor-bg)",
    border: "var(--sev-minor-dim)",
    text: "var(--sev-minor)",
    glow: "var(--glow-minor)",
  },
  harmless: {
    dot: "var(--sev-harmless)",
    bg: "var(--sev-harmless-bg)",
    border: "var(--sev-harmless-dim)",
    text: "var(--sev-harmless)",
    glow: "var(--glow-harmless)",
  },
};

const TERM_COLOR = {
  tool: "var(--term-tool)",
  result: "var(--term-result)",
  classify: "var(--term-classify)",
  uncertain: "var(--term-uncertain)",
  dim: "var(--term-dim)",
};

/* ── demo preview data — illustrative only, shown on public landing page ── */
const DEMO_EVENTS = [
  { time: "04:17", sev: "serious", desc: "North Fence — unexplained motion", meta: "zone 3 · cam 7 offline", label: "ESCALATED" },
  { time: "03:42", sev: "harmless", desc: "North Fence — motion (wind)", meta: "zone 3 · 14 m/s gust", label: "RESOLVED" },
  { time: "02:58", sev: "minor", desc: "Loading Bay — door cycled", meta: "bay 2 · unscheduled", label: "MONITORING" },
  { time: "02:11", sev: "harmless", desc: "Perimeter Gate — access attempt", meta: "gate 4 · badge matched", label: "RESOLVED" },
  { time: "01:33", sev: "minor", desc: "East Compound — heat signature", meta: "zone 5 · anomaly flagged", label: "REVIEW" },
];

const DEMO_AGENT = [
  { type: "tool", text: "→ query_sensor_log(zone=3, window=\"03:00–05:00\")" },
  { type: "result", text: "← 3 anomalies. cam_7 offline at 04:12 UTC." },
  { type: "classify", text: "■ SERIOUS · confidence 0.81" },
  { type: "tool", text: "→ fetch_drone_path(patrol=\"RWY-03\")" },
  { type: "result", text: "← waypoints loaded. closest pass: 04:09 UTC." },
  { type: "uncertain", text: "? motion source unconfirmed — no access log match" },
  { type: "tool", text: "→ cross_reference_badge_log(zone=3, t=\"04:05–04:25\")" },
  { type: "result", text: "← 0 authorized entries. Coverage gap confirmed." },
  { type: "classify", text: "■ escalating to OPS LEAD" },
];

const FEATURES = [
  {
    sev: "serious",
    label: "AI Investigation",
    stat: "81% avg confidence",
    desc: "The 6:10 Assistant triages overnight signals, correlates evidence, and proposes traceable root causes. Teams arrive to findings, not a raw alert stream.",
  },
  {
    sev: "minor",
    label: "Live Streaming",
    stat: "<200ms latency",
    desc: "SSE-driven updates push event status, agent reasoning, and evidence changes in real time — no polling, no stale dashboards.",
  },
  {
    sev: "harmless",
    label: "Morning Briefing",
    stat: "ready by 06:10",
    desc: "By shift handoff the system compiles incidents, timelines, and confidence-backed recommendations. Approve and publish in minutes.",
  },
];

const STEPS = [
  { n: "01", label: "Events Detected", desc: "Sensors, cameras, and telemetry flag overnight anomalies across the site." },
  { n: "02", label: "Agent Investigates", desc: "6:10 Assistant correlates evidence, runs tools, and drafts causal hypotheses." },
  { n: "03", label: "Ops Lead Reviews", desc: "Operations lead validates findings, adjusts narrative, and confirms confidence." },
  { n: "04", label: "Briefing Approved", desc: "A final morning report is shared with all stakeholders before shift start." },
];

const STAGES = [
  { Icon: Plane, label: "Patrol", desc: "Drones move through your site overnight, capturing sensor events." },
  { Icon: Radar, label: "Events", desc: "Motion, badge swipes, vehicle movement — all ingested and grouped." },
  { Icon: Search, label: "Investigate", desc: "Argus runs a ReAct loop with RAG and Claude to classify each incident." },
  { Icon: FileText, label: "Briefing", desc: "A structured morning briefing, ready for your approval." },
];

function StageCard({ Icon, label, desc }) {
  return (
    <div style={{
      background: "var(--bg-surface-1)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm, 4px)",
      padding: "20px",
      display: "flex", flexDirection: "column", gap: "12px",
      transition: "background var(--dur-fast, 120ms)",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface-1)"; }}
    >
      <Icon size={24} color="var(--accent)" aria-hidden="true" />
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--fg-1)",
      }}>{label}</div>
      <p style={{
        fontFamily: "var(--font-sans)", fontSize: "13px",
        color: "var(--fg-3)", lineHeight: 1.55, margin: 0,
      }}>{desc}</p>
    </div>
  );
}

function StageRow() {
  return (
    <div className="stage-row" style={{
      display: "grid",
      gridTemplateColumns: "1fr 24px 1fr 24px 1fr 24px 1fr",
      alignItems: "stretch",
      gap: "0",
    }}>
      {STAGES.map((s, i) => (
        <React.Fragment key={s.label}>
          <StageCard {...s} />
          {i < STAGES.length - 1 && (
            <div aria-hidden="true" className="stage-arrow" style={{
              color: "var(--accent)",
              fontFamily: "var(--font-mono)",
              fontSize: "22px",
              textAlign: "center",
              alignSelf: "center",
            }}>→</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function RoleCard({ Icon, iconColor, labelColor, label, title, desc, ctaLabel, ctaHref, ctaColor }) {
  return (
    <div style={{
      background: "var(--bg-surface-1)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm, 4px)",
      padding: "24px",
      display: "flex", flexDirection: "column", gap: "10px",
      transition: "background var(--dur-fast, 120ms)",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface-1)"; }}
    >
      <Icon size={28} color={iconColor} aria-hidden="true" />
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: labelColor,
      }}>{label}</div>
      <h3 style={{
        fontFamily: "var(--font-sans)", fontSize: "18px",
        fontWeight: 500, color: "var(--fg-1)", margin: 0,
      }}>{title}</h3>
      <p style={{
        fontFamily: "var(--font-sans)", fontSize: "13px",
        color: "var(--fg-3)", lineHeight: 1.55, margin: 0, flex: 1,
      }}>{desc}</p>
      <Link href={ctaHref} style={{
        marginTop: "10px", fontSize: "14px", fontWeight: 500,
        color: ctaColor, textDecoration: "none",
      }}>{ctaLabel}</Link>
    </div>
  );
}

function StepCard({ n, title, desc, ctaLabel, ctaHref }) {
  return (
    <div style={{
      background: "var(--bg-surface-2)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm, 4px)",
      padding: "24px",
      display: "flex", flexDirection: "column", gap: "10px",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "32px",
        fontWeight: 700, color: "var(--fg-4)",
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>{n}</div>
      <h3 style={{
        fontFamily: "var(--font-sans)", fontSize: "17px",
        fontWeight: 500, color: "var(--fg-1)", margin: 0,
      }}>{title}</h3>
      <p style={{
        fontFamily: "var(--font-sans)", fontSize: "13px",
        color: "var(--fg-3)", lineHeight: 1.55, margin: 0, flex: 1,
      }}>{desc}</p>
      <Link href={ctaHref} style={{
        marginTop: "8px", fontSize: "14px", fontWeight: 500,
        color: "var(--accent)", textDecoration: "none",
      }}>{ctaLabel}</Link>
    </div>
  );
}

function LandingFooter() {
  return (
    <footer style={{
      background: "var(--bg-surface-1)",
      borderTop: "1px solid var(--border-hairline)",
      padding: "48px 24px",
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "32px",
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "16px",
              fontWeight: 700, letterSpacing: "0.15em",
              textTransform: "uppercase", color: "var(--fg-1)",
            }}>Sentinel</div>
            <div style={{
              marginTop: "6px",
              fontSize: "12px", color: "var(--fg-4)",
            }}>Night Watch design system</div>
          </div>
          <FooterCol heading="Product" links={[
            ["How it works", "/docs#how-it-works"],
            ["Security", "/docs#security"],
            ["MCP integration", "/docs#mcp"],
            ["API reference", "/docs#api"],
          ]} />
          <FooterCol heading="Resources" links={[
            ["Documentation", "/docs"],
            ["Sign in", "/login"],
            ["Create account", "/register"],
            ["Admin sign in", "/admin/login"],
          ]} />
          <div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--fg-3)", marginBottom: "12px",
            }}>Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "var(--sev-harmless)",
              }} />
              <span style={{ fontSize: "13px", color: "var(--fg-2)" }}>All systems operational</span>
            </div>
            <div style={{
              marginTop: "6px",
              fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-4)",
            }}>Last updated: 2026-04-18 06:00 UTC</div>
          </div>
        </div>

        <div style={{
          marginTop: "32px", paddingTop: "16px",
          borderTop: "1px solid var(--border-hairline)",
          textAlign: "center", fontSize: "12px", color: "var(--fg-4)",
        }}>
          © 2026 Sentinel — Built for industrial site operators
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ heading, links }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--fg-3)", marginBottom: "12px",
      }}>{heading}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} style={{
              fontSize: "14px", color: "var(--fg-2)", textDecoration: "none",
              transition: "color var(--dur-fast, 120ms)",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--fg-1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-2)"; }}
            >{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingPage() {
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh", color: "var(--fg-1)" }}>

      {/* Skip-to-content */}
      <a
        href="#main"
        style={{
          position: "absolute", left: "-9999px", top: "8px",
          background: "var(--bg-surface-2)", color: "var(--fg-1)",
          padding: "8px 14px", zIndex: 200,
          fontFamily: "var(--font-mono)", fontSize: "11px",
          textDecoration: "none", border: "1px solid var(--accent)",
        }}
        onFocus={(e) => { e.currentTarget.style.left = "8px"; }}
        onBlur={(e) => { e.currentTarget.style.left = "-9999px"; }}
      >
        Skip to content
      </a>

      {/* ══ NAV ══════════════════════════════════════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "48px",
        background: "rgba(7,9,12,0.94)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border-default)",
        display: "flex", alignItems: "center", padding: "0 32px",
        gap: "20px", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: "var(--sev-serious)", boxShadow: "var(--glow-serious)",
            animation: "status-pulse 2s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-1)",
          }}>Sentinel</span>
          <span style={{ color: "var(--border-strong)", fontSize: "16px", lineHeight: 1, userSelect: "none" }}>·</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--fg-4)", letterSpacing: "0.1em", textTransform: "uppercase",
          }}>6:10 Assistant</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Live clock */}
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "12px",
          color: "var(--accent)", letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
        }}>{time}</span>

        {/* Nav links — hidden on very small screens via media query below */}
        <nav className="landing-nav" style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <Link href="#features" style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none", color: "var(--fg-3)",
          }}>Features</Link>
          <Link href="#how-it-works" style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none", color: "var(--fg-3)",
          }}>Workflow</Link>
        </nav>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Link href="/login" style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none",
            color: "var(--fg-3)", padding: "6px 14px",
            border: "1px solid var(--border-default)",
          }}>Login</Link>
          <Link href="/register" style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none",
            color: "var(--bg-base)", background: "var(--accent)", padding: "6px 14px",
          }}>Get Access</Link>
        </div>
      </header>

      {/* ══ HERO ═════════════════════════════════════════ */}
      <section id="main" style={{
        minHeight: "100vh", paddingTop: "48px",
        display: "grid", gridTemplateColumns: "1fr 1fr",
        position: "relative", overflow: "hidden",
      }} className="hero-grid">

        {/* Dot grid background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(35,43,56,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }} />

        {/* Radar sweep */}
        <div className="radar-sweep" style={{
          position: "absolute", left: 0, right: 0, height: "1px",
          background: "linear-gradient(90deg, transparent 0%, var(--accent) 40%, var(--accent) 60%, transparent 100%)",
          opacity: 0.25, pointerEvents: "none",
        }} />

        {/* Ambient glow behind left content */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 55% 75% at 25% 55%, rgba(21,34,43,0.65) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* ── LEFT: proposition ── */}
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "clamp(48px,8vw,96px) clamp(24px,5vw,64px) clamp(48px,8vw,96px) clamp(32px,6vw,80px)",
          position: "relative", zIndex: 1,
        }}>

          {/* Live badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "36px", alignSelf: "flex-start" }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--sev-serious)", boxShadow: "var(--glow-serious)",
              animation: "status-pulse 1.6s ease-in-out infinite",
            }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sev-serious)",
            }}>Live — overnight intelligence active</span>
          </div>

          {/* Giant clock */}
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(52px, 9vw, 104px)",
            fontWeight: 700, lineHeight: 1,
            color: "var(--accent)",
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            marginBottom: "20px",
            textShadow: "0 0 60px rgba(184,212,232,0.18)",
          }}>
            {time.slice(0, 5)}
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(28px, 4vw, 52px)",
            fontWeight: 500, lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: "var(--fg-1)", marginBottom: "20px",
          }}>
            Investigations<br />
            <span style={{ color: "var(--fg-3)" }}>Before Sunrise</span>
          </h1>

          <p style={{
            fontFamily: "var(--font-sans)", fontSize: "14px",
            color: "var(--fg-2)", lineHeight: "var(--lh-loose)",
            maxWidth: "420px", marginBottom: "44px",
          }}>
            6:10 Assistant monitors overnight events, runs autonomous investigations, and prepares a morning-ready briefing — so your team starts the day with clarity, not chaos.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/register" style={{
              fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none",
              color: "var(--bg-base)", background: "var(--accent)",
              padding: "12px 24px",
              display: "inline-flex", alignItems: "center", gap: "8px",
            }}>
              Get started <span>→</span>
            </Link>
            <Link href="/login" style={{
              fontFamily: "var(--font-mono)", fontSize: "11px",
              letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none",
              color: "var(--fg-3)", padding: "12px 24px",
              border: "1px solid var(--border-default)",
            }}>
              Sign in
            </Link>
            <Link href="/docs" style={{
              fontFamily: "var(--font-mono)", fontSize: "11px",
              letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none",
              color: "var(--fg-4)", padding: "12px 24px",
            }}>
              Read the docs
            </Link>
          </div>

          {/* Admin sign-in — small */}
          <div style={{ marginTop: "12px" }}>
            <Link href="/admin/login" style={{
              fontFamily: "var(--font-mono)", fontSize: "11px",
              color: "var(--sev-serious)", textDecoration: "none",
              letterSpacing: "0.08em",
            }}>
              Admin sign in →
            </Link>
          </div>

          {/* Stats strip */}
          <div style={{
            marginTop: "56px", paddingTop: "24px",
            borderTop: "1px solid var(--border-hairline)",
            display: "flex", gap: "36px", flexWrap: "wrap",
          }}>
            {[
              { val: "6:10", label: "briefing ready" },
              { val: "81%", label: "avg confidence" },
              { val: "<2 h", label: "mean resolution" },
            ].map(({ val, label }) => (
              <div key={label}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "clamp(18px,2.5vw,26px)",
                  fontWeight: 700, color: "var(--fg-1)",
                  letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums",
                }}>{val}</div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "10px",
                  color: "var(--fg-4)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginTop: "4px",
                }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: live ops panel preview ── */}
        <div className="hero-right" style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "clamp(48px,8vw,96px) clamp(32px,6vw,80px) clamp(48px,8vw,96px) clamp(16px,3vw,32px)",
          position: "relative", zIndex: 1, gap: "12px",
        }}>

          {/* Agent terminal panel */}
          <div style={{
            background: "var(--bg-terminal)",
            border: "1px solid var(--border-default)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "9px 14px",
              background: "var(--bg-surface-1)",
              borderBottom: "1px solid var(--border-hairline)",
            }}>
              <span style={{
                width: "7px", height: "7px", borderRadius: "50%",
                background: "var(--accent)", boxShadow: "var(--glow-accent)",
                animation: "status-pulse 1.6s ease-in-out infinite",
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
                letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-1)",
              }}>Argus Activity</span>
              <span style={{
                marginLeft: "auto", fontFamily: "var(--font-mono)",
                fontSize: "10px", color: "var(--fg-4)",
              }}>9 tool calls · running</span>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {DEMO_AGENT.map((line, i) => (
                <div key={i} style={{
                  fontFamily: "var(--font-mono)", fontSize: "11px",
                  color: TERM_COLOR[line.type] || "var(--term-fg)",
                  lineHeight: 1.5,
                  opacity: i < DEMO_AGENT.length - 3 ? 0.55 : 1,
                }}>{line.text}</div>
              ))}
              {/* Blinking cursor */}
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "11px",
                color: "var(--accent)", marginTop: "3px",
                animation: "status-pulse 1s ease-in-out infinite",
              }}>▋</div>
            </div>
          </div>

          {/* Events panel */}
          <div style={{
            background: "var(--bg-surface-1)",
            border: "1px solid var(--border-default)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "9px 14px",
              borderBottom: "1px solid var(--border-hairline)",
            }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
                letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-1)",
              }}>Events</span>
              <span style={{
                marginLeft: "auto", fontFamily: "var(--font-mono)",
                fontSize: "10px", color: "var(--fg-4)",
              }}>5 logged · 1 escalated</span>
            </div>
            {DEMO_EVENTS.map((evt, i) => {
              const s = SEV[evt.sev];
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "44px 1fr auto",
                  padding: "8px 14px", gap: "10px", alignItems: "center",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-hairline)",
                  borderLeft: evt.sev === "serious" ? "2px solid var(--sev-serious)" : "2px solid transparent",
                }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-4)",
                  }}>{evt.time}</span>
                  <div>
                    <div style={{
                      fontSize: "12px", color: "var(--fg-1)", fontWeight: 500,
                      marginBottom: "2px", letterSpacing: "-0.005em",
                    }}>{evt.desc}</div>
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--fg-4)",
                    }}>{evt.meta}</div>
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 600,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "2px 7px",
                    background: s.bg, color: s.text, border: `1px solid ${s.border}`,
                    borderRadius: "2px", whiteSpace: "nowrap",
                  }}>{evt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ SECTION 2 — HOW IT WORKS (4 stages) ══════════ */}
      <section id="how-it-works" style={{
        background: "var(--bg-surface-1)",
        borderTop: "1px solid var(--border-default)",
        padding: "clamp(48px,8vw,80px) clamp(24px,6vw,80px)",
        scrollMarginTop: "48px",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--fg-3)", marginBottom: "14px",
          }}>How it works</div>
          <h2 style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(22px, 3vw, 36px)",
            fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.015em",
            color: "var(--fg-1)", marginBottom: "48px",
          }}>From patrol to briefing in four stages.</h2>

          <StageRow />
        </div>
      </section>

      {/* ══ SECTION 3 — ROLES ════════════════════════════ */}
      <section style={{
        background: "var(--bg-base)",
        padding: "clamp(48px,8vw,80px) clamp(24px,6vw,80px)",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--fg-3)", marginBottom: "14px",
          }}>Access levels</div>
          <h2 style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(22px, 3vw, 36px)",
            fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.015em",
            color: "var(--fg-1)", marginBottom: "8px",
          }}>Three roles. One platform.</h2>
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: "14px",
            color: "var(--fg-3)", marginBottom: "40px",
          }}>Sentinel&apos;s permission model maps to real-world site operations.</p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}>
            <RoleCard
              Icon={Shield} iconColor="var(--accent)" labelColor="var(--accent)"
              label="Operator" title="Site Operator"
              desc="Reviews overnight events, approves the morning briefing, escalates serious incidents."
              ctaLabel="Sign in →" ctaHref="/login" ctaColor="var(--accent)"
            />
            <RoleCard
              Icon={Settings} iconColor="var(--accent)" labelColor="var(--accent)"
              label="Site Manager" title="Site Manager"
              desc="Configures site zones, invites operators, manages drone API keys and webhook integrations."
              ctaLabel="Sign in →" ctaHref="/login" ctaColor="var(--accent)"
            />
            <RoleCard
              Icon={Server} iconColor="var(--sev-serious)" labelColor="var(--sev-serious)"
              label="Platform Admin" title="Platform Admin"
              desc="Sentinel platform team. Manages all customer organisations, monitors system health, handles support and audits."
              ctaLabel="Admin sign in →" ctaHref="/admin/login" ctaColor="var(--sev-serious)"
            />
          </div>
        </div>
      </section>

      {/* ══ SECTION 4 — GETTING STARTED ══════════════════ */}
      <section style={{
        background: "var(--bg-surface-1)",
        borderTop: "1px solid var(--border-default)",
        padding: "clamp(48px,8vw,80px) clamp(24px,6vw,80px)",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--fg-3)", marginBottom: "14px",
          }}>First time?</div>
          <h2 style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(22px, 3vw, 36px)",
            fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.015em",
            color: "var(--fg-1)", marginBottom: "40px",
          }}>From zero to your first briefing in 5 minutes.</h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}>
            <StepCard n="01" title="Create your site"
              desc="Sign up with your work email. You become the site administrator automatically."
              ctaLabel="Create account →" ctaHref="/register" />
            <StepCard n="02" title="Run the setup wizard"
              desc="Four guided steps: confirm your details, configure your site, set up drone integration, invite your team."
              ctaLabel="See what's in the wizard →" ctaHref="/docs#getting-started" />
            <StepCard n="03" title="Connect your drones"
              desc="POST your first sensor events to the Sentinel API. Argus will investigate them tonight. You'll see your first briefing tomorrow morning."
              ctaLabel="API reference →" ctaHref="/docs#api" />
          </div>

          <div style={{
            textAlign: "center", marginTop: "40px",
            fontFamily: "var(--font-sans)", fontSize: "15px",
            color: "var(--fg-3)",
          }}>
            Just exploring?{" "}
            <Link href="/docs" style={{ color: "var(--accent)", textDecoration: "none" }}>
              Read the full documentation →
            </Link>
          </div>
        </div>
      </section>

      {/* ══ SECTION 5 — FOOTER ═══════════════════════════ */}
      <LandingFooter />


      {/* ══ GLOBAL STYLES for this page ══════════════════ */}
      <style>{`
        @keyframes radar-sweep {
          0%   { top: -1px; opacity: 0; }
          5%   { opacity: 0.25; }
          95%  { opacity: 0.15; }
          100% { top: 100vh; opacity: 0; }
        }

        .radar-sweep {
          animation: radar-sweep 10s linear infinite;
        }

        @media (max-width: 768px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-right {
            display: none !important;
          }
          .landing-nav {
            display: none !important;
          }
          .stage-row {
            grid-template-columns: 1fr !important;
          }
          .stage-arrow {
            transform: rotate(90deg);
            padding: 8px 0;
          }
        }
        html { scroll-behavior: smooth; }
        button, a { cursor: pointer; }
      `}</style>
    </div>
  );
}
