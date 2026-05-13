"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";

const SECTIONS = [
  { id: "what-is",       label: "What is Ridgeway?" },
  { id: "how-it-works",  label: "How it works" },
  { id: "getting-started", label: "Getting started" },
  { id: "drones",        label: "Connecting your drones" },
  { id: "incidents",     label: "Understanding incidents" },
  { id: "briefing",      label: "Morning briefing" },
  { id: "security",      label: "Security & encryption" },
  { id: "mcp",           label: "MCP integration" },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        background: "none",
        border: "1px solid var(--border-strong)",
        borderRadius: "2px",
        padding: "4px 8px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        color: copied ? "var(--sev-harmless)" : "var(--fg-3)",
        transition: "color 120ms ease",
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ children, copyable }) {
  return (
    <div style={{ position: "relative", margin: "12px 0" }}>
      <pre style={{
        background: "var(--bg-surface-2)",
        border: "1px solid var(--border-default)",
        borderRadius: "2px",
        padding: "14px 16px",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: "var(--fg-2)",
        overflowX: "auto",
        lineHeight: 1.6,
        margin: 0,
      }}>
        {children}
      </pre>
      {copyable && (
        <div style={{ position: "absolute", top: "8px", right: "8px" }}>
          <CopyButton text={typeof children === "string" ? children : String(children)} />
        </div>
      )}
    </div>
  );
}

function SectionWrapper({ id, children }) {
  return (
    <section id={id} style={{
      background: "var(--bg-surface-1)",
      border: "1px solid var(--border-default)",
      borderRadius: "2px",
      overflow: "hidden",
      marginBottom: "24px",
      scrollMarginTop: "32px",
    }}>
      {children}
    </section>
  );
}

function SectionHead({ children }) {
  return (
    <div style={{
      padding: "10px 20px",
      borderBottom: "1px solid var(--border-hairline)",
      background: "var(--bg-surface-2)",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--fg-3)",
      }}>
        {children}
      </span>
    </div>
  );
}

function SectionBody({ children }) {
  return (
    <div style={{ padding: "20px" }}>
      {children}
    </div>
  );
}

function Body({ children, style }) {
  return (
    <p style={{
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      color: "var(--fg-2)",
      lineHeight: 1.65,
      margin: "0 0 12px",
      ...style,
    }}>
      {children}
    </p>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "var(--fg-3)",
      margin: "20px 0 8px",
    }}>
      {children}
    </div>
  );
}

const EXAMPLE_PAYLOAD = `{
  "type": "motion_detected",
  "timestamp": "2026-04-16T02:34:15.000Z",
  "location": {
    "name": "North Gate",
    "zone": "perimeter",
    "coordinates": { "lat": 51.5074, "lng": -0.1278 }
  },
  "severity": "minor",
  "rawData": {}
}`;

const MCP_SNIPPET = `// Claude.ai → Settings → Connectors → Add MCP server
// Server URL:  https://your-ridgeway-host/api/v1/mcp
// Auth header: Authorization: Bearer <api-key-with-mcp-scope>

// Cursor / VS Code: ~/.cursor/mcp.json
{
  "mcpServers": {
    "ridgeway": {
      "url": "https://your-ridgeway-host/api/v1/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}`;

const MCP_TOOLS = [
  ["get_site_status",      "Current site overview — sensor health, active alerts"],
  ["list_incidents",       "List incidents with optional date / severity / status filters"],
  ["get_incident",         "Full detail for one incident including evidence chain"],
  ["list_events",          "Raw overnight events for a given date"],
  ["get_investigation",    "Investigation results and agent reasoning for an incident"],
  ["start_investigation",  "Kick off a new AI investigation job"],
  ["get_latest_briefing",  "Returns the morning briefing for the given date"],
  ["get_map_geometry",     "Site boundary polygons and drone route geometry"],
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("what-is");
  const contentRef = useRef(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { root: content, threshold: 0.2 }
    );

    SECTIONS.forEach(({ id }) => {
      const el = content.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "var(--bg-base)",
    }}>
      {/* Sidebar */}
      <div style={{
        width: "220px",
        flexShrink: 0,
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        background: "var(--bg-surface-1)",
        borderRight: "1px solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--border-hairline)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: "var(--accent)", flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--fg-1)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}>
              Ridgeway
            </span>
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--fg-4)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            paddingLeft: "15px",
          }}>
            Documentation
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {SECTIONS.map(({ id, label }) => {
            const active = activeSection === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveSection(id);
                }}
                style={{
                  display: "block",
                  padding: "6px 10px",
                  marginBottom: "2px",
                  borderRadius: "2px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: active ? "var(--fg-1)" : "var(--fg-3)",
                  background: active ? "var(--bg-surface-3)" : "transparent",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  textDecoration: "none",
                  transition: "color 120ms ease, background 120ms ease",
                }}
              >
                {label}
              </a>
            );
          })}
        </nav>

        {/* Bottom CTAs */}
        <div style={{
          padding: "12px 8px 16px",
          borderTop: "1px solid var(--border-hairline)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}>
          <Link href="/login" style={{
            display: "block",
            padding: "7px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--fg-2)",
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-default)",
            borderRadius: "2px",
            textDecoration: "none",
            textAlign: "center",
          }}>
            Sign in →
          </Link>
          <Link href="/register" style={{
            display: "block",
            padding: "7px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--bg-base)",
            background: "var(--accent)",
            borderRadius: "2px",
            textDecoration: "none",
            textAlign: "center",
          }}>
            Get started →
          </Link>
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        style={{
          marginLeft: "220px",
          flex: 1,
          padding: "32px 48px 80px",
          maxWidth: "860px",
          overflowY: "auto",
        }}
      >
        {/* Section 1 */}
        <SectionWrapper id="what-is">
          <SectionHead>What is Ridgeway?</SectionHead>
          <SectionBody>
            <Body>
              Ridgeway is an AI-first overnight industrial site intelligence platform. Drone patrols run automatically at night — capturing motion events, badge-swipe failures, vehicle movements, and environmental readings. By morning, Claude has investigated every incident, classified each by severity, and generated a structured briefing ready for your team.
            </Body>
            <Body>
              Operators log in each morning to one place: a prioritised list of everything that happened overnight, with AI reasoning attached to every incident. Review, escalate, or close in minutes — then approve the briefing to notify day shift.
            </Body>
            <div style={{
              display: "flex",
              gap: "12px",
              marginTop: "16px",
              flexWrap: "wrap",
            }}>
              {[
                ["Automated patrol", "Drones POST events via API key — no manual input"],
                ["AI investigation", "Claude classifies each incident end-to-end overnight"],
                ["Morning briefing", "One-click approval distributes the briefing via webhook"],
              ].map(([title, desc]) => (
                <div key={title} style={{
                  flex: "1",
                  minWidth: "180px",
                  padding: "12px",
                  background: "var(--bg-surface-2)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "2px",
                }}>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--accent)",
                    marginBottom: "6px",
                  }}>
                    {title}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--fg-3)",
                    lineHeight: 1.5,
                  }}>
                    {desc}
                  </div>
                </div>
              ))}
            </div>
          </SectionBody>
        </SectionWrapper>

        {/* Section 2 */}
        <SectionWrapper id="how-it-works">
          <SectionHead>How it works</SectionHead>
          <SectionBody>
            <Body>Every night Ridgeway runs a four-stage automated cycle:</Body>
            {/* Flow diagram */}
            <div style={{
              display: "flex",
              alignItems: "stretch",
              gap: "0",
              margin: "20px 0",
              overflowX: "auto",
            }}>
              {[
                { step: "01", label: "PATROL", desc: "Drones move through the site. Sensors fire events to the API.", color: "var(--fg-3)" },
                { step: "02", label: "EVENTS", desc: "Events are ingested, validated, and grouped into incidents.", color: "var(--accent-dim)" },
                { step: "03", label: "INVESTIGATE", desc: "Claude agent runs the ReAct loop — tools, evidence, classification.", color: "var(--accent)" },
                { step: "04", label: "BRIEFING", desc: "A structured morning briefing is generated, ready for approval.", color: "var(--sev-harmless)" },
              ].map(({ step, label, desc, color }, i) => (
                <div key={step} style={{ display: "flex", alignItems: "stretch" }}>
                  <div style={{
                    padding: "16px",
                    background: "var(--bg-surface-2)",
                    border: "1px solid var(--border-default)",
                    borderRight: i < 3 ? "none" : "1px solid var(--border-default)",
                    width: "152px",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      color: "var(--fg-4)",
                      letterSpacing: "0.1em",
                      marginBottom: "4px",
                    }}>
                      {step}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color,
                      marginBottom: "8px",
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "var(--fg-3)",
                      lineHeight: 1.5,
                    }}>
                      {desc}
                    </div>
                  </div>
                  {i < 3 && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0 4px",
                      background: "var(--bg-surface-2)",
                      border: "1px solid var(--border-default)",
                      borderLeft: "none",
                      borderRight: "none",
                    }}>
                      <span style={{ color: "var(--accent)", fontSize: "12px" }}>→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Body>
              If an incident cannot be fully classified — due to insufficient sensor data or conflicting signals — it is marked <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--sev-unknown)" }}>UNCERTAIN</span> for human review. The operator always has final say.
            </Body>
          </SectionBody>
        </SectionWrapper>

        {/* Section 3 */}
        <SectionWrapper id="getting-started">
          <SectionHead>Getting started</SectionHead>
          <SectionBody>
            {[
              ["Register", "Create an account at /register. The first user in an org becomes org_admin."],
              ["Setup wizard", "Complete the setup wizard: enter your site details and timezone, then generate an API key for your drone."],
              ["Connect your drone", "Configure your drone patrol system to POST events to the Ridgeway events endpoint using the generated API key."],
              ["Wait for patrol", "Events recorded overnight will be processed automatically. Your first investigation and briefing will be ready the following morning."],
            ].map(([title, desc], i) => (
              <div key={i} style={{
                display: "flex",
                gap: "16px",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}>
                <div style={{
                  flexShrink: 0,
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "var(--bg-surface-2)",
                  border: "1px solid var(--border-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--accent)",
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--fg-1)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}>
                    {title}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--fg-2)",
                    lineHeight: 1.5,
                  }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </SectionBody>
        </SectionWrapper>

        {/* Section 4 */}
        <SectionWrapper id="drones">
          <SectionHead>Connecting your drones</SectionHead>
          <SectionBody>
            <Body>
              Your drone or sensor system sends events by POSTing JSON to the events endpoint using an API key scoped to <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent)" }}>events:write</span>.
            </Body>
            <Label>Endpoint</Label>
            <CodeBlock copyable>{"POST /api/v1/events\nAuthorization: Bearer <your-api-key>\nContent-Type: application/json"}</CodeBlock>

            <Label>Example payload</Label>
            <div style={{ position: "relative" }}>
              <CodeBlock copyable={false}>{EXAMPLE_PAYLOAD}</CodeBlock>
              <div style={{ position: "absolute", top: "8px", right: "8px" }}>
                <CopyButton text={EXAMPLE_PAYLOAD} />
              </div>
            </div>

            <Label>Supported event types</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
              {["motion_detected", "badge_swipe_fail", "vehicle_entry", "fence_alert", "environmental"].map((t) => (
                <span key={t} style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--accent)",
                  background: "rgba(184,212,232,0.08)",
                  border: "1px solid rgba(184,212,232,0.2)",
                  borderRadius: "2px",
                  padding: "3px 8px",
                }}>
                  {t}
                </span>
              ))}
            </div>
            <Body style={{ fontSize: "13px", color: "var(--fg-3)" }}>
              Severity must be one of: <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>serious</code>, <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>minor</code>, <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>harmless</code>. Events with a missing or invalid severity are rejected with HTTP 400.
            </Body>
          </SectionBody>
        </SectionWrapper>

        {/* Section 5 */}
        <SectionWrapper id="incidents">
          <SectionHead>Understanding incidents</SectionHead>
          <SectionBody>
            <Body>
              Ridgeway groups correlated events into incidents automatically. Claude then classifies each incident by severity:
            </Body>

            <div style={{ marginBottom: "20px" }}>
              {[
                { sev: "SERIOUS", color: "var(--sev-serious)", bg: "rgba(255,56,56,0.07)", desc: "Immediate threat — intruder, fire, perimeter breach. Escalate immediately." },
                { sev: "MINOR",   color: "var(--sev-minor)",   bg: "rgba(232,154,43,0.07)", desc: "Needs monitoring — repeated badge failures, unknown vehicle, unusual activity." },
                { sev: "HARMLESS",color: "var(--sev-harmless)",bg: "rgba(125,138,106,0.1)",  desc: "Routine — known vehicle, wildlife, false positive. Close and move on." },
                { sev: "UNCERTAIN",color:"var(--sev-unknown)", bg: "var(--bg-surface-2)",    desc: "Insufficient data to classify. Operator must decide with available evidence." },
              ].map(({ sev, color, bg, desc }) => (
                <div key={sev} style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  background: bg,
                  border: "1px solid var(--border-hairline)",
                  borderBottom: "none",
                  "&:lastChild": { borderBottom: "1px solid var(--border-hairline)" },
                }}>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color,
                    minWidth: "72px",
                    paddingTop: "1px",
                  }}>
                    {sev}
                  </span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-2)", lineHeight: 1.5 }}>
                    {desc}
                  </span>
                </div>
              ))}
            </div>

            <Label>Incident lifecycle</Label>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--fg-3)",
            }}>
              {["OPEN", "→", "INVESTIGATING", "→", "REVIEWED", "→", "ESCALATED / CLOSED"].map((s, i) => (
                <span key={i} style={{ color: s === "→" ? "var(--accent)" : "var(--fg-2)" }}>{s}</span>
              ))}
            </div>
          </SectionBody>
        </SectionWrapper>

        {/* Section 6 */}
        <SectionWrapper id="briefing">
          <SectionHead>Morning briefing</SectionHead>
          <SectionBody>
            <Body>
              After all overnight investigations complete, Ridgeway generates a structured morning briefing. The briefing contains: an executive summary, a prioritised incident list, recommended actions, and a site health assessment.
            </Body>
            <Body>
              The briefing lives at <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--fg-1)" }}>/briefing</span> and is presented as a formatted document ready for day-shift handover. Operators can edit individual sections before approving.
            </Body>
            <Body>
              Approving the briefing triggers a webhook POST to your configured endpoint — typically a Slack channel, PagerDuty, or a custom integration. The webhook includes an HMAC-SHA256 signature for verification.
            </Body>
          </SectionBody>
        </SectionWrapper>

        {/* Section 7 */}
        <SectionWrapper id="security">
          <SectionHead>Security & encryption</SectionHead>
          <SectionBody>
            {[
              ["Passwords", "bcrypt-hashed with 10 rounds. Raw passwords are never stored."],
              ["API keys", "SHA-256 hashed. The raw key is shown once at creation — never stored. Treat it like a password."],
              ["OTPs", "SHA-256 hashed, 20-minute TTL. Raw OTP is only sent by email."],
              ["JWTs", "Short-lived (15 minutes), stored as httpOnly cookies. Instant invalidation via token version tracking."],
              ["Webhook signatures", "All outgoing webhooks carry an X-Ridgeway-Signature: sha256=<hmac> header computed with your webhook secret."],
              ["In transit", "All external traffic should use HTTPS/TLS in production (terminate at your reverse proxy)."],
            ].map(([title, desc]) => (
              <div key={title} style={{
                display: "flex",
                gap: "16px",
                padding: "10px 0",
                borderBottom: "1px solid var(--border-hairline)",
              }}>
                <div style={{
                  flexShrink: 0,
                  width: "140px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--fg-2)",
                  paddingTop: "1px",
                }}>
                  {title}
                </div>
                <div style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "var(--fg-3)",
                  lineHeight: 1.5,
                }}>
                  {desc}
                </div>
              </div>
            ))}
          </SectionBody>
        </SectionWrapper>

        {/* Section 8 */}
        <SectionWrapper id="mcp">
          <SectionHead>MCP integration</SectionHead>
          <SectionBody>
            <Body>
              Ridgeway exposes a Model Context Protocol (MCP) server, letting any MCP-compatible AI agent — Claude.ai, Cursor, VS Code — query your site data directly in conversation.
            </Body>
            <Label>Available tools</Label>
            <div style={{ marginBottom: "16px" }}>
              {MCP_TOOLS.map(([tool, desc]) => (
                <div key={tool} style={{
                  display: "flex",
                  gap: "12px",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border-hairline)",
                  alignItems: "flex-start",
                }}>
                  <code style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--accent)",
                    flexShrink: 0,
                    width: "180px",
                    paddingTop: "1px",
                  }}>
                    {tool}
                  </code>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--fg-3)", lineHeight: 1.5 }}>
                    {desc}
                  </span>
                </div>
              ))}
            </div>
            <Label>Connection snippet</Label>
            <CodeBlock copyable>{MCP_SNIPPET}</CodeBlock>
            <Body style={{ fontSize: "13px", color: "var(--fg-3)", marginTop: "12px" }}>
              Generate an API key with the <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent)" }}>mcp</span> scope from Settings → API Keys. Rate limit: 60 tool calls per minute per key.
            </Body>
          </SectionBody>
        </SectionWrapper>
      </div>
    </div>
  );
}
