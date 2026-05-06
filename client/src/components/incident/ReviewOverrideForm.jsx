"use client";

import { Edit3, Loader2 } from "lucide-react";

const INPUT_STYLE = {
  background: "var(--bg-surface-3)",
  border: "1px solid var(--border-strong)",
  color: "var(--fg-1)",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  padding: "8px 12px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function ReviewOverrideForm({
  isPending,
  overrideSeverity,
  setOverrideSeverity,
  overrideReason,
  setOverrideReason,
  onCancel,
  onSubmit,
}) {
  const canSubmit = !isPending && overrideReason.length >= 10;

  return (
    <div style={{
      width: "100%",
      border: "1px solid rgba(232,154,43,0.4)",
      background: "rgba(232,154,43,0.04)",
      padding: "24px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "20px",
        fontFamily: "var(--font-mono)", fontSize: "10px",
        fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.14em", color: "var(--sev-minor)",
      }}>
        <Edit3 size={14} />
        System Override Configuration
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "16px", alignItems: "center" }}>
        <label style={{
          fontFamily: "var(--font-mono)", fontSize: "10px",
          textTransform: "uppercase", letterSpacing: "0.12em",
          color: "var(--fg-4)", width: "96px", flexShrink: 0,
        }}>
          Set Severity
        </label>
        <select
          value={overrideSeverity}
          onChange={e => setOverrideSeverity(e.target.value)}
          style={{ ...INPUT_STYLE, flex: 1, cursor: "pointer" }}
        >
          <option value="harmless">Harmless</option>
          <option value="monitor">Monitor</option>
          <option value="escalate">Escalate</option>
          <option value="uncertain">Uncertain</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "16px", alignItems: "flex-start" }}>
        <label style={{
          fontFamily: "var(--font-mono)", fontSize: "10px",
          textTransform: "uppercase", letterSpacing: "0.12em",
          color: "var(--fg-4)", width: "96px", flexShrink: 0,
          paddingTop: "8px",
        }}>
          Reason
        </label>
        <textarea
          value={overrideReason}
          onChange={e => setOverrideReason(e.target.value)}
          placeholder="Why are you overriding the system classification? (Min 10 characters)"
          style={{ ...INPUT_STYLE, flex: 1, minHeight: "80px", resize: "none", lineHeight: "var(--lh-snug)" }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", marginTop: "24px" }}>
        <button
          disabled={isPending}
          onClick={onCancel}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: "10px",
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--fg-4)", padding: "0 16px",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--fg-1)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--fg-4)"}
        >
          Cancel
        </button>
        <button
          disabled={!canSubmit}
          onClick={onSubmit}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 24px",
            background: canSubmit ? "var(--sev-minor)" : "var(--sev-minor-dim)",
            border: "1px solid var(--sev-minor)",
            color: "var(--bg-base)",
            fontFamily: "var(--font-mono)", fontSize: "11px",
            fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.12em", cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.4,
          }}
        >
          {isPending && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          Submit Override
        </button>
      </div>
    </div>
  );
}
