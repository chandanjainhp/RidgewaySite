"use client";

import { useState, useEffect, useRef } from "react";

const SECTIONS = [
  { id: "overview",     label: "Platform Overview" },
  { id: "data-flow",    label: "How Data Flows" },
  { id: "getting-started", label: "Getting Started" },
  { id: "drones",       label: "Connecting Drones" },
  { id: "incidents",    label: "Understanding Incidents" },
  { id: "engine",       label: "Investigation Engine" },
  { id: "briefing",     label: "Morning Briefing" },
  { id: "security",     label: "Security & Encryption" },
  { id: "api",          label: "API Reference" },
  { id: "2fa",          label: "2FA Setup" },
  { id: "roles",        label: "Roles & Permissions" },
  { id: "webhooks",     label: "Webhook Integration" },
];

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "var(--fg-3)",
      marginBottom: "16px",
      paddingBottom: "8px",
      borderBottom: "1px solid var(--border-hairline)",
    }}>
      {children}
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre style={{
      background: "var(--bg-terminal)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: "16px",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)",
      color: "var(--term-fg)",
      overflowX: "auto",
      margin: "12px 0",
      lineHeight: "var(--lh-loose)",
    }}>
      <code>{children}</code>
    </pre>
  );
}

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-base)",
      }}>
        <thead>
          <tr style={{ background: "var(--bg-surface-2)" }}>
            {headers.map((h) => (
              <th key={h} style={{
                padding: "8px 12px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--fg-3)",
                borderBottom: "1px solid var(--border-default)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border-hairline)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "8px 12px",
                  color: j === 0 ? "var(--fg-1)" : "var(--fg-2)",
                  fontFamily: j === 0 ? "var(--font-mono)" : "var(--font-sans)",
                  fontSize: "var(--text-base)",
                  verticalAlign: "top",
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SevBadge({ level }) {
  const map = {
    serious:  { bg: "var(--sev-serious-bg)",  color: "var(--sev-serious)",  label: "SERIOUS" },
    minor:    { bg: "var(--sev-minor-bg)",    color: "var(--sev-minor)",    label: "MINOR" },
    harmless: { bg: "var(--sev-harmless-bg)", color: "var(--sev-harmless)", label: "HARMLESS" },
    uncertain:{ bg: "var(--sev-unknown-bg)",  color: "var(--sev-unknown)",  label: "UNCERTAIN" },
  };
  const s = map[level] || map.uncertain;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
      letterSpacing: "0.12em", padding: "2px 8px",
      borderRadius: "var(--radius-pill)", textTransform: "uppercase",
      display: "inline-block",
    }}>{s.label}</span>
  );
}

function StatusBadge({ label, color }) {
  return (
    <span style={{
      background: "var(--bg-surface-2)", color: color || "var(--fg-2)",
      fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
      letterSpacing: "0.1em", padding: "2px 8px",
      border: `1px solid ${color || "var(--border-default)"}`,
      borderRadius: "var(--radius-pill)", textTransform: "uppercase",
      display: "inline-block",
    }}>{label}</span>
  );
}

function FlowStep({ num, title, desc }) {
  return (
    <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%",
        background: "var(--accent-deep)", border: "1px solid var(--accent-dim)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)",
        fontWeight: 700, color: "var(--accent)",
      }}>{num}</div>
      <div>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 500, color: "var(--fg-1)", marginBottom: "4px" }}>{title}</div>
        <div style={{ fontSize: "var(--text-base)", color: "var(--fg-3)", lineHeight: "var(--lh-normal)" }}>{desc}</div>
      </div>
    </div>
  );
}

function DocSection({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: "48px" }}>
      <h2 style={{
        fontSize: "var(--text-xl)", fontWeight: 500, color: "var(--fg-1)",
        margin: "0 0 20px", letterSpacing: "-0.01em",
        paddingBottom: "12px", borderBottom: "1px solid var(--border-default)",
      }}>{title}</h2>
      {children}
    </section>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{
      background: "var(--accent-deep)", border: "1px solid var(--accent-dim)",
      borderRadius: "var(--radius-sm)", padding: "12px 16px",
      fontSize: "var(--text-base)", color: "var(--fg-2)",
      lineHeight: "var(--lh-normal)", margin: "12px 0",
    }}>{children}</div>
  );
}

function WarnBox({ children }) {
  return (
    <div style={{
      background: "var(--sev-minor-bg)", border: "1px solid var(--sev-minor-dim)",
      borderRadius: "var(--radius-sm)", padding: "12px 16px",
      fontSize: "var(--text-base)", color: "var(--sev-minor)",
      lineHeight: "var(--lh-normal)", margin: "12px 0",
    }}>{children}</div>
  );
}

export default function DocPage() {
  const [activeId, setActiveId] = useState("overview");
  const contentRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -75% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex" }}>
      {/* Sidebar */}
      <aside style={{
        width: "220px", flexShrink: 0, position: "sticky", top: "56px",
        height: "calc(100vh - 56px)", overflowY: "auto",
        background: "var(--bg-surface-1)",
        borderRight: "1px solid var(--border-default)",
        padding: "24px 0",
      }}>
        <div style={{
          padding: "0 16px 12px",
          fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-4)",
        }}>Documentation</div>
        {SECTIONS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
              setActiveId(id);
            }}
            style={{
              display: "block",
              padding: "7px 16px",
              fontSize: "var(--text-base)",
              color: activeId === id ? "var(--accent)" : "var(--fg-3)",
              background: activeId === id ? "var(--accent-deep)" : "transparent",
              borderLeft: activeId === id ? "2px solid var(--accent)" : "2px solid transparent",
              textDecoration: "none",
              transition: "all var(--dur-fast) var(--ease-out)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {label}
          </a>
        ))}
      </aside>

      {/* Content */}
      <main
        ref={contentRef}
        style={{
          flex: 1, padding: "40px 48px", overflowY: "auto",
          maxWidth: "820px",
        }}
      >
        {/* Page header */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-dim)",
            marginBottom: "8px",
          }}>RIDGEWAY SITE</div>
          <h1 style={{
            fontSize: "var(--text-2xl)", fontWeight: 500, color: "var(--fg-1)",
            margin: "0 0 8px", letterSpacing: "-0.01em",
          }}>Platform Documentation</h1>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-3)" }}>
            Complete reference for operators, administrators, and integrators.
          </p>
        </div>

        {/* 1 — Platform Overview */}
        <DocSection id="overview" title="Platform Overview">
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)", marginBottom: "20px" }}>
            Ridgeway is an AI-first overnight industrial site intelligence platform. Drones patrol your site through the night; Claude investigates every anomaly; operators review a structured briefing in the morning.
          </p>
          <SectionLabel>The Overnight Cycle</SectionLabel>
          <div style={{
            background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)", padding: "20px",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0", flexWrap: "wrap" }}>
              {[
                { phase: "NIGHT", icon: "◉", color: "var(--fg-4)", desc: "Drones patrol. Sensors capture motion, badges, vehicles, environmental readings." },
                { phase: "OVERNIGHT", icon: "⬡", color: "var(--accent-dim)", desc: "Claude investigates each event — correlates, classifies, writes incident reports." },
                { phase: "MORNING", icon: "◎", color: "var(--accent)", desc: "Operator reviews incidents, approves briefing, escalates where needed." },
              ].map((p, i) => (
                <div key={p.phase} style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: "1 1 220px", minWidth: "200px" }}>
                  {i > 0 && (
                    <div style={{ color: "var(--border-strong)", fontSize: "18px", paddingTop: "2px", flexShrink: 0, display: "none" }}>→</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <span style={{ color: p.color, fontSize: "16px" }}>{p.icon}</span>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "0.12em", color: p.color,
                      }}>{p.phase}</span>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-3)", lineHeight: "var(--lh-normal)" }}>{p.desc}</p>
                  </div>
                  {i < 2 && (
                    <div style={{
                      width: "1px", alignSelf: "stretch", background: "var(--border-hairline)",
                      margin: "0 16px", flexShrink: 0,
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <InfoBox>
            Every UI decision and feature exists to serve one goal: help an operator understand last night&apos;s site activity as fast as possible.
          </InfoBox>
        </DocSection>

        {/* 2 — How Data Flows */}
        <DocSection id="data-flow" title="How Data Flows">
          <FlowStep num="1" title="Drone posts an event"
            desc="Each drone or sensor calls POST /api/v1/events with an org API key. The payload includes event type, location, severity estimate, and raw sensor data." />
          <FlowStep num="2" title="Event queued in BullMQ"
            desc="The server validates the payload, writes it to MongoDB, and enqueues an investigation job. BullMQ manages retry and concurrency." />
          <FlowStep num="3" title="Claude agent investigates"
            desc="A ReAct loop runs tool calls — querying the event graph, checking patrol history, looking up similar past incidents — before classifying severity and writing a structured investigation result." />
          <FlowStep num="4" title="Incident created"
            desc="Each investigated event becomes an Incident record in MongoDB, tagged with severity, classification, evidence chain, and agent reasoning." />
          <FlowStep num="5" title="Morning briefing generated"
            desc="After the patrol window closes, Claude synthesises all incidents into a structured briefing document ready for operator review." />
          <FlowStep num="6" title="Operator reviews and approves"
            desc="The operator reads incidents on /investigate, reviews the briefing on /briefing, approves it, and it is distributed via configured webhooks." />
        </DocSection>

        {/* 3 — Getting Started */}
        <DocSection id="getting-started" title="Getting Started">
          <SectionLabel>First-run setup wizard</SectionLabel>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)", marginBottom: "16px" }}>
            When you first log in, Ridgeway walks you through a four-step setup wizard at <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-surface-2)", padding: "1px 6px", borderRadius: "var(--radius-xs)", fontSize: "var(--text-sm)" }}>/setup</code>.
          </p>
          <Table
            headers={["Step", "What happens"]}
            rows={[
              ["1 — Welcome", "Overview of the overnight cycle. No action required."],
              ["2 — Your Site", "Set organisation name, site name, industry type, timezone, and coordinates."],
              ["3 — Connect Drones", "Generate an API key with events:write scope. Copy the endpoint URL and example payload."],
              ["4 — Ready", "Setup marked complete. Links to invite team members and upload RAG documents."],
            ]}
          />
          <InfoBox>
            You will not see any incident data until the first overnight patrol completes and events are posted to the API.
          </InfoBox>
        </DocSection>

        {/* 4 — Connecting Drones */}
        <DocSection id="drones" title="Connecting Drones">
          <SectionLabel>Endpoint</SectionLabel>
          <CodeBlock>{`POST https://your-domain/api/v1/events
Authorization: Bearer <org-api-key>
Content-Type: application/json`}</CodeBlock>

          <SectionLabel>Payload schema</SectionLabel>
          <CodeBlock>{`{
  "type": "motion_detected" | "badge_swipe_fail" | "vehicle_entry" | "environmental",
  "timestamp": "2026-04-16T02:34:15.000Z",        // ISO 8601, UTC
  "location": {
    "name": "North Gate",
    "zone": "perimeter",
    "coordinates": { "lat": 51.5074, "lng": -0.1278 }
  },
  "severity": "minor" | "serious" | "harmless",    // drone's initial estimate
  "rawData": { /* sensor-specific payload */ }
}`}</CodeBlock>

          <SectionLabel>Example curl</SectionLabel>
          <CodeBlock>{`curl -X POST https://your-domain/api/v1/events \\
  -H "Authorization: Bearer <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "motion_detected",
    "timestamp": "2026-04-16T02:34:15.000Z",
    "location": {
      "name": "North Gate",
      "zone": "perimeter",
      "coordinates": { "lat": 51.5074, "lng": -0.1278 }
    },
    "severity": "minor",
    "rawData": { "confidence": 0.82, "duration_ms": 4200 }
  }'`}</CodeBlock>

          <SectionLabel>API key management</SectionLabel>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)" }}>
            Keys are managed at <strong style={{ color: "var(--fg-1)" }}>Settings → API Keys</strong>. The raw key is shown once at creation — Ridgeway stores only a SHA-256 hash. Rotate keys by deleting and regenerating.
          </p>
        </DocSection>

        {/* 5 — Understanding Incidents */}
        <DocSection id="incidents" title="Understanding Incidents">
          <SectionLabel>Severity levels</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            {[
              { level: "serious", action: "Escalate immediately", desc: "Immediate threat — intruder, fire, breach. Operator must act." },
              { level: "minor", action: "Review", desc: "Needs monitoring — repeated badge fails, unusual vehicle, out-of-hours access." },
              { level: "harmless", action: "Close", desc: "Routine — wildlife, known vehicle, confirmed false positive." },
              { level: "uncertain", action: "Request follow-up", desc: "Insufficient evidence for classification. More context needed." },
            ].map(({ level, action, desc }) => (
              <div key={level} style={{
                display: "flex", alignItems: "flex-start", gap: "16px",
                background: "var(--bg-surface-1)", border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)", padding: "12px 16px",
              }}>
                <div style={{ paddingTop: "2px" }}><SevBadge level={level} /></div>
                <div>
                  <div style={{ fontSize: "var(--text-base)", color: "var(--fg-1)", fontWeight: 500, marginBottom: "2px" }}>{action}</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--fg-3)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <SectionLabel>Incident lifecycle</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {[
              ["open", "var(--fg-3)"],
              ["investigating", "var(--accent)"],
              ["reviewed", "var(--sev-harmless)"],
              ["escalated", "var(--sev-serious)"],
              ["closed", "var(--fg-4)"],
            ].map(([label, color], i) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <StatusBadge label={label} color={color} />
                {i < 4 && <span style={{ color: "var(--border-strong)" }}>→</span>}
              </div>
            ))}
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-3)", lineHeight: "var(--lh-normal)" }}>
            Claude sets status to <em>investigating</em> while the ReAct loop runs. Operators move incidents to <em>reviewed</em>, then either <em>escalated</em> or <em>closed</em>.
          </p>
        </DocSection>

        {/* 6 — Investigation Engine */}
        <DocSection id="engine" title="Investigation Engine">
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)", marginBottom: "16px" }}>
            The investigation engine is a Claude ReAct (Reason + Act) loop running on the server. For each incident it iterates: reason about what to check → call a tool → observe the result → repeat until confident in a classification.
          </p>
          <SectionLabel>Available tools</SectionLabel>
          <Table
            headers={["Tool", "What it does"]}
            rows={[
              ["get_event_details", "Fetch full event payload and sensor raw data"],
              ["query_patrol_history", "Look up drone positions at a given timestamp"],
              ["get_nearby_events", "Find other events in the same zone within a time window"],
              ["check_badge_records", "Look up access control history for a location"],
              ["classify_incident", "Write final classification — severity, summary, evidence chain"],
              ["search_knowledge_base", "Query RAG documents for site-specific context"],
              ["get_site_context", "Retrieve org site facts from Redis memory"],
            ]}
          />
          <SectionLabel>ReAct loop</SectionLabel>
          <CodeBlock>{`Thought: The motion sensor at North Gate fired at 02:34.
         I should check if there were other events nearby.

Action:  get_nearby_events({ zone: "perimeter", time: "02:34", window_min: 15 })

Observation: 3 events — badge swipe fail at 02:31, vehicle entry at 02:38,
             another motion hit at 02:36 (different sector).

Thought: Correlated activity over 7 minutes. Likely a single actor.
         Badge fail suggests unauthorised access attempt.

Action:  classify_incident({ severity: "serious", ... })`}</CodeBlock>
          <InfoBox>
            Tool calls are idempotent — the ReAct loop may retry. Do not add side effects to tool implementations.
          </InfoBox>
        </DocSection>

        {/* 7 — Morning Briefing */}
        <DocSection id="briefing" title="Morning Briefing">
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)", marginBottom: "16px" }}>
            After the patrol window closes, Claude generates a structured briefing document. It appears at <strong style={{ color: "var(--fg-1)" }}>/briefing</strong> in a paper-style document view.
          </p>
          <SectionLabel>Briefing sections</SectionLabel>
          <Table
            headers={["Section", "Content"]}
            rows={[
              ["Executive Summary", "One-paragraph overview of the night's activity for management"],
              ["Serious Incidents", "Each serious incident with location, timeline, evidence, recommended action"],
              ["Minor Incidents", "Grouped by zone — badge failures, unusual vehicles, perimeter hits"],
              ["Harmless / Routine", "Confirmed false positives and expected activity"],
              ["Site Status", "Overall safety rating for the night, open items"],
            ]}
          />
          <SectionLabel>Approving the briefing</SectionLabel>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)" }}>
            Operators can edit individual sections before approving. Clicking <strong style={{ color: "var(--fg-1)" }}>Approve &amp; Distribute</strong> triggers all configured webhooks with the final briefing payload.
          </p>
        </DocSection>

        {/* 8 — Security */}
        <DocSection id="security" title="Security & Encryption">
          <Table
            headers={["What", "How", "Status"]}
            rows={[
              ["Passwords", "bcrypt, rounds=10. Raw password never stored.", "✅ Confirmed"],
              ["API keys", "SHA-256 hash stored. Raw key shown once.", "✅ Confirmed"],
              ["OTPs", "SHA-256 hash stored, 20-minute TTL.", "✅ Confirmed"],
              ["JWTs", "15-minute access tokens, httpOnly cookies, tokenVersion for instant invalidation.", "✅ Confirmed"],
              ["In transit", "HTTPS/TLS via Nginx in production.", "✅ Required"],
              ["MongoDB at rest", "WiredTiger encryption (Atlas: Encrypted Storage Engine).", "⚠️ Configure in cluster"],
              ["Redis payloads", "Job data stored plaintext. Use rediss:// + ACLs in production.", "⚠️ Configure in prod"],
              ["Webhook payloads", "HMAC-SHA256 signing — X-Ridgeway-Signature header.", "⚠️ Pending implementation"],
            ]}
          />
          <SectionLabel>Token storage rules</SectionLabel>
          <CodeBlock>{`Access token  → httpOnly cookie "accessToken"   — never localStorage
Refresh token → httpOnly cookie "refreshToken"  — never localStorage
API key (raw) → shown once at creation          — never stored in DB
OTP (raw)     → emailed to user                 — never stored in DB`}</CodeBlock>
        </DocSection>

        {/* 9 — API Reference */}
        <DocSection id="api" title="API Reference">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--fg-3)", marginBottom: "16px" }}>
            All routes prefixed <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-surface-2)", padding: "1px 6px", borderRadius: "var(--radius-xs)" }}>/api/v1</code>. Auth = JWT cookie or <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-surface-2)", padding: "1px 6px", borderRadius: "var(--radius-xs)" }}>Authorization: Bearer &lt;token&gt;</code>.
          </p>
          <SectionLabel>Auth</SectionLabel>
          <CodeBlock>{`POST   /auth/register              — public
POST   /auth/login                 — public
POST   /auth/verify-email          — public
POST   /auth/refresh-token         — public
POST   /auth/forgot-password       — public
POST   /auth/reset-password        — public
POST   /auth/logout                — JWT
GET    /auth/current-user          — JWT
POST   /auth/change-password       — JWT`}</CodeBlock>

          <SectionLabel>Data</SectionLabel>
          <CodeBlock>{`GET    /events                     — JWT  (query: nightDate)
GET    /events/:id                 — JWT
PATCH  /events/:id/review          — JWT

GET    /incidents                  — JWT  (query: nightDate, status, severity)
GET    /incidents/:id              — JWT
GET    /incidents/:id/graph        — JWT

POST   /investigations/start       — JWT
GET    /investigations/:jobId/stream — JWT (SSE)
GET    /investigations/:id         — JWT

GET    /briefings/latest           — JWT
PATCH  /briefings/:id/sections/:name — JWT
POST   /briefings/:id/approve      — JWT`}</CodeBlock>

          <SectionLabel>Org (org_admin+)</SectionLabel>
          <CodeBlock>{`GET    /org/me                     — JWT (org_admin+)
PATCH  /org/me/config              — JWT (org_admin+)
POST   /org/users/invite           — JWT (org_admin+)
GET    /org/users                  — JWT (org_admin+)
GET    /org/api-keys               — JWT (org_admin+)
POST   /org/api-keys               — JWT (org_admin+)
DELETE /org/api-keys/:keyId        — JWT (org_admin+)`}</CodeBlock>

          <SectionLabel>Rate limits</SectionLabel>
          <Table
            headers={["Scope", "Limit"]}
            rows={[
              ["MCP endpoints", "60 calls/min per session"],
              ["Event ingestion", "No hard limit — governed by BullMQ concurrency"],
              ["Auth endpoints", "Recommend nginx rate limiting in production"],
            ]}
          />
        </DocSection>

        {/* 10 — 2FA */}
        <DocSection id="2fa" title="2FA Setup">
          <WarnBox>
            Two-factor authentication is designed but not yet implemented. The steps below describe the intended flow.
          </WarnBox>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)", margin: "16px 0" }}>
            2FA will be optional, org-admin-enabled, and TOTP-based (compatible with Google Authenticator and Authy).
          </p>
          <SectionLabel>Intended setup flow</SectionLabel>
          <FlowStep num="1" title="Admin enables 2FA for org" desc="Settings → General → Security → Enable 2FA. Applies to all org members." />
          <FlowStep num="2" title="Member opens 2FA setup" desc="POST /auth/2fa/setup returns a QR code URI. Member scans with authenticator app." />
          <FlowStep num="3" title="Member verifies" desc="POST /auth/2fa/verify with a TOTP code enables 2FA and returns one-time backup codes." />
          <FlowStep num="4" title="Login with 2FA active" desc="POST /auth/login returns { requires2FA: true, tempToken }. Client shows TOTP input. POST /auth/login/2fa to complete." />
          <SectionLabel>Backup codes</SectionLabel>
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)" }}>
            Eight single-use backup codes are issued at setup. Each is SHA-256 hashed before storage. Store them securely — they are shown once.
          </p>
        </DocSection>

        {/* 11 — Roles */}
        <DocSection id="roles" title="Roles & Permissions">
          <Table
            headers={["Role", "Can do"]}
            rows={[
              ["super_admin", "Manage all orgs, suspend/unsuspend, view all audit logs, manage all API keys. No orgId."],
              ["org_admin", "Invite members, manage org API keys, configure webhooks and integrations, approve briefings, access all settings."],
              ["operator", "View and review incidents, read briefings, run investigations. Cannot manage org settings."],
            ]}
          />
          <SectionLabel>Middleware chain</SectionLabel>
          <CodeBlock>{`verifyJWT        → validates token, checks user.isActive, checks tokenVersion
  requireRole    → e.g. ['org_admin', 'super_admin']
    scopeToOrg   → attaches req.orgFilter = { orgId: user.orgId }
                   checks org suspended (Redis cache, 5-min TTL)`}</CodeBlock>
          <InfoBox>
            All database queries must use <code style={{ fontFamily: "var(--font-mono)" }}>req.orgFilter</code>. Never trust a client-supplied orgId.
          </InfoBox>
        </DocSection>

        {/* 12 — Webhooks */}
        <DocSection id="webhooks" title="Webhook Integration">
          <p style={{ fontSize: "var(--text-base)", color: "var(--fg-2)", lineHeight: "var(--lh-normal)", marginBottom: "16px" }}>
            Configure webhooks at <strong style={{ color: "var(--fg-1)" }}>Settings → Webhooks</strong>. Ridgeway calls your endpoint when a briefing is approved or a serious incident is escalated.
          </p>
          <SectionLabel>Briefing approved payload</SectionLabel>
          <CodeBlock>{`POST https://your-endpoint/ridgeway
X-Ridgeway-Event: briefing.approved
X-Ridgeway-Signature: sha256=<hmac>      // HMAC-SHA256 of body with webhook secret
Content-Type: application/json

{
  "event":    "briefing.approved",
  "orgId":    "org_abc123",
  "briefingId": "brf_xyz",
  "approvedAt": "2026-04-17T07:12:00.000Z",
  "nightDate": "2026-04-16",
  "summary":  "3 serious incidents, 7 minor, 12 harmless.",
  "url":      "https://your-domain/briefing?id=brf_xyz"
}`}</CodeBlock>

          <SectionLabel>Verifying the signature</SectionLabel>
          <CodeBlock>{`// Node.js example
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</CodeBlock>
          <WarnBox>
            Always verify the signature before processing a webhook payload. Reject requests where the signature does not match.
          </WarnBox>

          <SectionLabel>Retry behaviour</SectionLabel>
          <Table
            headers={["Attempt", "Delay"]}
            rows={[
              ["1 (initial)", "Immediate"],
              ["2", "30 seconds"],
              ["3", "5 minutes"],
              ["4", "30 minutes"],
              ["5 (final)", "2 hours — delivery marked failed after this"],
            ]}
          />
        </DocSection>
      </main>
    </div>
  );
}
