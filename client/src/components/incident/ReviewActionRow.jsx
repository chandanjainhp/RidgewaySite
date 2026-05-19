"use client";

import { Check, Edit3, Flag, Loader2 } from "lucide-react";

const BTN_BASE = {
  flex: 1, padding: "12px 16px", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
  fontFamily: "var(--font-mono)", fontSize: "11px",
  textTransform: "uppercase", letterSpacing: "0.12em",
  fontWeight: 600, border: "1px solid",
  background: "var(--bg-surface-2)",
  transition: "background 120ms, color 120ms",
};

export default function ReviewActionRow({ isPending, onAgree, onOverride, onFlag }) {
  return (
    <>
      <button
        disabled={isPending}
        onClick={onAgree}
        style={{
          ...BTN_BASE,
          borderColor: "var(--sev-harmless)",
          color: "var(--sev-harmless)",
          opacity: isPending ? 0.5 : 1,
        }}
        onMouseEnter={e => !isPending && (e.currentTarget.style.background = "var(--sev-harmless-bg)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface-2)")}
      >
        {isPending
          ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          : <Check size={14} />
        }
        Agree
      </button>

      <button
        disabled={isPending}
        onClick={onOverride}
        style={{
          ...BTN_BASE,
          borderColor: "var(--sev-minor)",
          color: "var(--sev-minor)",
          opacity: isPending ? 0.5 : 1,
        }}
        onMouseEnter={e => !isPending && (e.currentTarget.style.background = "var(--sev-minor-bg)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface-2)")}
      >
        <Edit3 size={14} /> Override
      </button>

      <button
        disabled={isPending}
        onClick={onFlag}
        style={{
          ...BTN_BASE,
          borderColor: "var(--sev-unknown)",
          color: "var(--sev-unknown)",
          opacity: isPending ? 0.5 : 1,
        }}
        onMouseEnter={e => !isPending && (e.currentTarget.style.background = "rgba(107,118,134,0.08)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-surface-2)")}
      >
        <Flag size={14} /> Flag for Follow-up
      </button>
    </>
  );
}
