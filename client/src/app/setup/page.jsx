"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateOrgConfig, createOrgApiKey, completeSetup } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Copy, Check, ChevronRight } from "lucide-react";

const STEPS = [
  { title: "Welcome to Sentinel", description: "AI-powered overnight site intelligence" },
  { title: "Configure your site", description: "Tell us about your site so the AI can investigate accurately" },
  { title: "Connect your drones", description: "Generate an API key for your drone patrol system" },
  { title: "You're ready", description: "Your platform is configured and waiting for tonight's patrol" },
];

const INDUSTRY_OPTIONS = [
  "Manufacturing", "Logistics & Warehousing", "Energy & Utilities",
  "Construction", "Mining", "Port / Harbour", "Data Centre", "Other",
];

const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf("timeZone")
  : ["UTC", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];

const primaryBtn = {
  background: "var(--accent)", color: "var(--bg-base)",
  border: "none", borderRadius: "4px",
  padding: "9px 22px", fontSize: "13px",
  fontFamily: "var(--font-sans)", fontWeight: 600,
  cursor: "pointer", letterSpacing: "0.02em",
};

const ghostBtn = {
  background: "transparent", color: "var(--fg-3)",
  border: "1px solid var(--border-default)", borderRadius: "4px",
  padding: "9px 22px", fontSize: "13px",
  fontFamily: "var(--font-sans)", cursor: "pointer",
};

const inputStyle = {
  width: "100%", background: "var(--bg-surface-2)", color: "var(--fg-1)",
  border: "1px solid var(--border-strong)", borderRadius: "4px",
  padding: "8px 12px", fontSize: "14px",
  fontFamily: "var(--font-sans)",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block", fontFamily: "var(--font-mono)", fontSize: "11px",
  fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em",
  color: "var(--fg-3)", marginBottom: "6px",
};

function OpsInput({ label, ...props }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} {...props} />
    </div>
  );
}

function OpsSelect({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={labelStyle}>{label}</label>
      <select style={{ ...inputStyle, cursor: "pointer" }} {...props}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

/* ── Step 1: Welcome ────────────────────────────────────── */
function StepWelcome() {
  return (
    <div>
      <div style={{
        background: "var(--bg-surface-2)",
        border: "1px solid var(--border-default)",
        borderRadius: "6px",
        padding: "20px",
        marginBottom: "24px",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: "var(--fg-3)",
        lineHeight: "1.8",
      }}>
        <div style={{ color: "var(--fg-2)", fontWeight: 600, marginBottom: "12px", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          The overnight cycle
        </div>
        {[
          ["NIGHT", "Drones patrol your site. Sensors capture motion, badge swipes, vehicles, environment."],
          ["OVERNIGHT", "AI agent investigates every event, correlates incidents, classifies risk."],
          ["MORNING", "You review last night's work. Approve the briefing. Act on what matters."],
        ].map(([phase, desc]) => (
          <div key={phase} style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
            <span style={{
              color: "var(--accent)", minWidth: "80px", fontWeight: 700,
              fontSize: "10px", paddingTop: "2px",
            }}>{phase}</span>
            <span style={{ color: "var(--fg-2)" }}>{desc}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "13px", color: "var(--fg-3)", margin: 0 }}>
        You won't see any investigation data until tonight's patrol completes. Let's get your site configured first.
      </p>
    </div>
  );
}

/* ── Step 2: Site config ────────────────────────────────── */
function StepSite({ form, setForm, onSave, isSaving }) {
  return (
    <div>
      <OpsInput
        label="Organisation name"
        value={form.orgName}
        onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
        placeholder="Sentinel Industrial Ltd"
      />
      <OpsInput
        label="Site name"
        value={form.siteName}
        onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
        placeholder="North Depot"
      />
      <OpsSelect
        label="Industry"
        options={INDUSTRY_OPTIONS}
        value={form.industry}
        onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
      />
      <OpsSelect
        label="Site timezone"
        options={TIMEZONES}
        value={form.timezone}
        onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
      />
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Coordinates (lat, lng)</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <input
            style={inputStyle}
            type="number"
            step="any"
            placeholder="51.5074"
            value={form.lat}
            onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
          />
          <input
            style={inputStyle}
            type="number"
            step="any"
            placeholder="-0.1278"
            value={form.lng}
            onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Drone connection ───────────────────────────── */
function StepDrones({ generatedKey, onGenerate, isGenerating, acknowledged, setAcknowledged }) {
  const [copied, setCopied] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const endpoint = `${typeof window !== "undefined" ? window.location.origin.replace("3000", "8000") : "http://localhost:8000"}/api/v1/events`;

  const copy = (text, setter) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  return (
    <div>
      <p style={{ fontSize: "13px", color: "var(--fg-3)", marginBottom: "20px" }}>
        Your drones POST events to the endpoint below using an API key with <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>events:write</code> scope.
      </p>

      {/* Endpoint */}
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Event ingestion endpoint</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            style={{ ...inputStyle, flex: 1, color: "var(--fg-2)" }}
            readOnly
            value={endpoint}
          />
          <button
            onClick={() => copy(endpoint, setCopiedEndpoint)}
            style={{ ...ghostBtn, padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            {copiedEndpoint ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Generate key */}
      {!generatedKey ? (
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          style={{ ...primaryBtn, opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? "not-allowed" : "pointer" }}
        >
          {isGenerating ? "Generating…" : "Generate API key"}
        </button>
      ) : (
        <div>
          <div style={{
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: "4px",
            padding: "12px",
            marginBottom: "12px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                API key — shown once
              </span>
              <button
                onClick={() => copy(generatedKey, setCopied)}
                style={{ ...ghostBtn, padding: "4px 10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <code style={{
              fontFamily: "var(--font-mono)", fontSize: "12px",
              color: "var(--accent)", wordBreak: "break-all", display: "block",
            }}>
              {generatedKey}
            </code>
          </div>

          {/* Example payload */}
          <details style={{ marginBottom: "16px" }}>
            <summary style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-3)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Example curl
            </summary>
            <pre style={{
              fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-2)",
              background: "var(--bg-surface-2)", borderRadius: "4px",
              padding: "12px", marginTop: "8px", overflowX: "auto",
              border: "1px solid var(--border-hairline)",
            }}>{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${generatedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "motion_detected",
    "timestamp": "2026-05-11T02:34:15.000Z",
    "location": {
      "name": "North Gate",
      "zone": "perimeter",
      "coordinates": { "lat": 51.5074, "lng": -0.1278 }
    },
    "severity": "minor",
    "rawData": {}
  }'`}</pre>
          </details>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ marginTop: "2px", flexShrink: 0 }}
            />
            <span style={{ fontSize: "13px", color: "var(--fg-2)" }}>
              I have copied the API key and understand it will not be shown again.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

/* ── Step 4: Done ───────────────────────────────────────── */
function StepDone() {
  const router = useRouter();
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "48px", height: "48px", borderRadius: "50%",
        background: "rgba(184,212,232,0.1)",
        border: "1px solid var(--accent)",
        marginBottom: "20px",
      }}>
        <Check size={22} color="var(--accent)" />
      </div>
      <p style={{ fontSize: "14px", color: "var(--fg-2)", marginBottom: "20px" }}>
        Tonight's drone patrol will populate your dashboard tomorrow morning. In the meantime:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[
          { label: "Invite your team", href: "/settings/members" },
          { label: "Upload site documents for RAG context", href: "/settings/documents" },
          { label: "Configure webhooks", href: "/settings/webhooks" },
        ].map(({ label, href }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            style={{
              ...ghostBtn, display: "flex", alignItems: "center",
              justifyContent: "space-between", width: "100%", textAlign: "left",
            }}
          >
            <span style={{ color: "var(--fg-2)" }}>{label}</span>
            <ChevronRight size={14} color="var(--fg-4)" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main wizard ────────────────────────────────────────── */
export default function SetupPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState(0);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [form, setForm] = useState({
    orgName: user?.orgName || "",
    siteName: "",
    industry: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    lat: "",
    lng: "",
  });

  const saveSiteConfig = useMutation({
    mutationFn: () => updateOrgConfig({
      siteName: form.siteName,
      industry: form.industry,
      timezone: form.timezone,
      ...(form.lat && form.lng ? {
        siteCoordinates: { lat: parseFloat(form.lat), lng: parseFloat(form.lng) },
      } : {}),
    }),
    onError: () => toast.error("Failed to save site config"),
  });

  const generateKey = useMutation({
    mutationFn: () => createOrgApiKey({ name: "Drone patrol key", scopes: ["events:write"] }),
    onSuccess: (data) => setGeneratedKey(data?.key),
    onError: () => toast.error("Failed to generate API key"),
  });

  const finishSetup = useMutation({
    mutationFn: () => completeSetup(),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        document.cookie = `ridgeway_setup=1; path=/; max-age=86400; SameSite=Lax`;
      }
      router.replace("/overview");
    },
    onError: () => toast.error("Failed to complete setup"),
  });

  const canAdvance = () => {
    if (step === 2) return !!generatedKey && acknowledged;
    return true;
  };

  const handleNext = async () => {
    if (step === 1) {
      await saveSiteConfig.mutateAsync().catch(() => null);
    }
    if (step === 3) {
      finishSetup.mutate();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-base)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      {/* ponytail: Hides layout elements during static rendering. Ceiling: breaks if layout structure/ids change. Upgrade path: use a Next.js Router Group/Layout structure (e.g. (app-shell)) to omit TopBar. */}
      <style dangerouslySetInnerHTML={{ __html: `
        header { display: none !important; }
        a.skip-to-content { display: none !important; }
        #main { padding-top: 0 !important; }
      ` }} />
      <div style={{
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        width: "100%", maxWidth: "560px",
        padding: "36px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>

        {/* Step progress bar */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "28px" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: "2px", flex: 1,
              background: i <= step ? "var(--accent)" : "var(--border-default)",
              borderRadius: "2px",
              transition: "background 220ms cubic-bezier(0.2,0.7,0.3,1)",
            }} />
          ))}
        </div>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            color: "var(--fg-4)", textTransform: "uppercase",
            letterSpacing: "0.1em", marginBottom: "6px",
          }}>
            Step {step + 1} of {STEPS.length}
          </div>
          <h1 style={{
            fontFamily: "var(--font-sans)", fontSize: "20px",
            fontWeight: 500, color: "var(--fg-1)", margin: "0 0 4px",
          }}>
            {STEPS[step].title}
          </h1>
          <p style={{ fontSize: "13px", color: "var(--fg-3)", margin: 0 }}>
            {STEPS[step].description}
          </p>
        </div>

        {/* Step content */}
        {step === 0 && <StepWelcome />}
        {step === 1 && <StepSite form={form} setForm={setForm} isSaving={saveSiteConfig.isPending} />}
        {step === 2 && (
          <StepDrones
            generatedKey={generatedKey}
            onGenerate={() => generateKey.mutate()}
            isGenerating={generateKey.isPending}
            acknowledged={acknowledged}
            setAcknowledged={setAcknowledged}
          />
        )}
        {step === 3 && <StepDone />}

        {/* Navigation */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginTop: "32px",
          paddingTop: "20px", borderTop: "1px solid var(--border-hairline)",
        }}>
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            style={{ ...ghostBtn, opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? "none" : "auto" }}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canAdvance() || saveSiteConfig.isPending || finishSetup.isPending}
            style={{
              ...primaryBtn,
              opacity: (!canAdvance() || saveSiteConfig.isPending || finishSetup.isPending) ? 0.5 : 1,
              cursor: (!canAdvance() || saveSiteConfig.isPending || finishSetup.isPending) ? "not-allowed" : "pointer",
            }}
          >
            {step === 3
              ? (finishSetup.isPending ? "Finishing…" : "Go to dashboard")
              : step === 1 && saveSiteConfig.isPending
              ? "Saving…"
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
