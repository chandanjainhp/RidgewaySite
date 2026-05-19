"use client";

import React, { memo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMapStore } from "@/store/mapStore";
import { useReviewStore } from "@/store/reviewStore";
import { formatNightLabel, formatTime } from "@/lib/formatters";
import { getSeverity } from "@/lib/severity";

const TYPE_LABELS = {
  spatial:    "SPATIAL CLUSTER",
  temporal:   "TEMPORAL PATTERN",
  entity:     "ENTITY MATCH",
  cross_type: "MULTI SIGNAL",
};

const EventCard = memo(({ incident }) => {
  const router   = useRouter();
  const cardRef  = useRef(null);

  const selectPin     = useMapStore((s) => s.selectPin);
  const selectedPinId = useMapStore((s) => s.selectedPinId);
  const isReviewed    = useReviewStore((s) => s.isReviewed);

  const id       = incident?._id || incident?.id || incident?.incidentId;
  const severity = incident.severity || "uncertain";
  const s        = getSeverity(severity);
  const tok      = { text: s.token, bg: s.bg, border: s.dim, label: s.label.toUpperCase() };

  const isSelected = selectedPinId === id;
  const reviewed   = isReviewed ? isReviewed(id) : false;

  const typeLabel = TYPE_LABELS[incident.correlation?.type] || "INCIDENT";
  const location  = incident.location?.name || incident.title || "Unknown Location";
  const nightDate = incident.nightDate;
  const timeLabel = nightDate
    ? formatNightLabel(nightDate)
    : incident?.firstEventTime
    ? formatTime(incident.firstEventTime)
    : "Night";

  useEffect(() => {
    if (isSelected) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isSelected]);

  return (
    <div
      ref={cardRef}
      onClick={() => { selectPin(id); router.push(`/incident/${id}`); }}
      style={{
        display: "grid", gridTemplateColumns: "54px 1fr auto",
        alignItems: "center", padding: "10px 16px", gap: "10px",
        borderTop: "1px solid var(--border-hairline)",
        borderLeft: isSelected ? `2px solid var(--accent)` : "2px solid transparent",
        paddingLeft: isSelected ? "14px" : "16px",
        background: isSelected ? "var(--bg-surface-1)" : "transparent",
        cursor: "pointer",
        transition: "background var(--dur-fast)",
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-surface-1)"; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* timestamp */}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fg-3)" }}>
        {timeLabel}
      </span>

      {/* name + meta */}
      <div>
        <div style={{ fontSize: "12.5px", color: "var(--fg-1)", fontWeight: 500, lineHeight: 1.3, marginBottom: "2px" }}>
          {location}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--fg-3)", lineHeight: 1.3 }}>
          {typeLabel}
          {reviewed && (
            <span style={{ marginLeft: "8px", color: "var(--sev-harmless)" }}>· REVIEWED</span>
          )}
        </div>
      </div>

      {/* severity badge */}
      <span style={{
        fontFamily: "var(--font-sans)", fontSize: "9px", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.1em",
        padding: "2px 7px", borderRadius: "2px",
        background: tok.bg, color: tok.text, border: `1px solid ${tok.border}`,
        flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "4px",
      }}>
        <s.icon size={10} aria-hidden="true" />
        {tok.label}
      </span>
    </div>
  );
});

EventCard.displayName = "EventCard";
export default EventCard;
