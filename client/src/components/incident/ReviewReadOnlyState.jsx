"use client";

import { Check, Edit3, Flag } from "lucide-react";

const DECISION_STYLE = {
  agreed: {
    border: "var(--sev-harmless)", color: "var(--sev-harmless)",
    background: "var(--sev-harmless-bg)",
  },
  overridden: {
    border: "var(--sev-minor)", color: "var(--sev-minor)",
    background: "var(--sev-minor-bg)",
  },
  flagged: {
    border: "#6366f1", color: "#6366f1",
    background: "rgba(99,102,241,0.06)",
  },
};

export default function ReviewReadOnlyState({ currentReview, onChangeDecision }) {
  const ds = DECISION_STYLE[currentReview.decision] || DECISION_STYLE.agreed;

  return (
    <div style={{
      padding: "16px",
      border: `1px solid ${ds.border}`,
      background: ds.background,
      color: ds.color,
      width: "100%",
      fontFamily: "var(--font-mono)", fontSize: "12px",
      textTransform: "uppercase", letterSpacing: "0.12em",
    }}>
      {currentReview.decision === "agreed" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Check size={14} />
          You agreed with the agent's classification
        </div>
      )}

      {currentReview.decision === "overridden" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Edit3 size={14} />
            You overridden to {currentReview.override?.newSeverity}
          </span>
          {currentReview.override?.reason && (
            <span style={{
              color: "var(--fg-4)", fontSize: "10px",
              fontStyle: "italic", wordBreak: "break-all",
            }}>
              {currentReview.override.reason}
            </span>
          )}
        </div>
      )}

      {currentReview.decision === "flagged" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Flag size={14} />
            Flagged for follow-up
          </span>
          {currentReview.flagDetails?.note && (
            <span style={{
              color: "var(--fg-4)", fontSize: "10px",
              fontStyle: "italic", wordBreak: "break-all",
            }}>
              {currentReview.flagDetails.note}
            </span>
          )}
        </div>
      )}

      <button
        onClick={onChangeDecision}
        style={{
          marginTop: "12px", display: "block",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: "10px",
          textDecoration: "underline", color: "var(--fg-4)",
          textTransform: "uppercase", letterSpacing: "0.10em",
          padding: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--fg-1)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--fg-4)"}
      >
        Change decision
      </button>
    </div>
  );
}
