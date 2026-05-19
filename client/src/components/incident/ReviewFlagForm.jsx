"use client";

import { Flag, Loader2 } from "lucide-react";

export default function ReviewFlagForm({
  isPending,
  incidentLocation,
  flagNote,
  setFlagNote,
  onCancel,
  onSubmit,
}) {
  const locationName = typeof incidentLocation === "string"
    ? incidentLocation
    : incidentLocation?.name || "this location";

  return (
    <div style={{
      width: "100%",
      border: "1px solid rgba(107,118,134,0.4)",
      background: "rgba(107,118,134,0.04)",
      padding: "24px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "16px",
        fontFamily: "var(--font-mono)", fontSize: "10px",
        fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.14em", color: "var(--sev-unknown)",
      }}>
        <Flag size={14} />
        Schedule Automated Follow-up
      </div>

      <p style={{
        fontSize: "13px", lineHeight: "var(--lh-loose)",
        color: "var(--fg-2)", marginBottom: "16px",
      }}>
        This will queue{" "}
        <strong style={{
          fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
          color: "var(--sev-unknown)",
        }}>
          {locationName}
        </strong>{" "}
        into the pending drone flight path for standard operating hours validation.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        <label style={{
          fontFamily: "var(--font-mono)", fontSize: "10px",
          textTransform: "uppercase", letterSpacing: "0.12em",
          color: "var(--fg-4)",
        }}>
          Investigation Note (Optional)
        </label>
        <textarea
          value={flagNote}
          onChange={e => setFlagNote(e.target.value)}
          placeholder="Context parameters for the incoming shift..."
          style={{
            width: "100%", minHeight: "80px", resize: "none",
            background: "var(--bg-surface-3)",
            border: "1px solid var(--border-strong)",
            color: "var(--fg-1)",
            fontFamily: "var(--font-mono)", fontSize: "12px",
            padding: "12px", lineHeight: "var(--lh-snug)",
            boxSizing: "border-box",
          }}
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
          disabled={isPending}
          onClick={onSubmit}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 24px",
            background: "var(--sev-unknown)",
            border: "1px solid #818cf8",
            color: "#ffffff",
            fontFamily: "var(--font-mono)", fontSize: "11px",
            fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.12em",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {isPending && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          Add to Follow-up List
        </button>
      </div>
    </div>
  );
}
