"use client";

import React, { memo } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { getSeverity } from "@/lib/severity";
import { EVENT_TYPE_CONFIG } from "@/config/constants";
import { useMapStore } from "@/store/mapStore";
import { formatTime } from "@/lib/formatters";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

const EventPin = memo(({ pin }) => {
  const router = useRouter();
  const selectPin = useMapStore((state) => state.selectPin);
  const selectedPinId = useMapStore((state) => state.selectedPinId);

  const { id, type, coordinates, severity, incidentId, timestamp, location } = pin;

  const isSelected = selectedPinId === id;
  const sev = getSeverity(severity);
  const eventData = EVENT_TYPE_CONFIG[type] || { label: 'Unknown Event', icon: 'zap' };

  const size = isSelected ? 28 : 20;
  const isSerious = severity === 'serious' || severity === 'escalate';
  const isUnknown = !severity || severity === 'unknown' || severity === 'uncertain';

  const pulseHtml = isSerious
    ? `<div style="position:absolute;inset:0;border:2px solid var(--sev-serious);border-radius:50%;animation:ping 1s cubic-bezier(0,0,0.2,1) infinite"></div>`
    : '';

  const iconHtml = `<div style="
    position:relative;width:${size}px;height:${size}px;
    display:flex;align-items:center;justify-content:center;
    border:2px solid rgba(255,255,255,0.3);border-radius:50%;
    box-shadow:0 0 10px rgba(0,0,0,0.5);
    background:${sev.bg};
    ${isUnknown ? 'animation:spin 2s linear infinite' : ''}
  ">${pulseHtml}</div>`;

  const customIcon = L.divIcon({
    html: iconHtml,
    className: "", // Purge Leaflet's default box wrapper
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });

  const handlePopupClick = (e) => {
    e.preventDefault();
    selectPin(id);
    router.push(`/incident/${incidentId || id}`);
  };

  return (
    <Marker
      position={coordinates}
      icon={customIcon}
      eventHandlers={{
        click: () => {
          selectPin(id);
        }
      }}
    >
      <Popup className="dark-popup font-sans rounded-none border-border bg-surface-2 text-text-primary p-0">
        <div className="p-4 bg-surface-2 min-w-50 border border-border">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-xs uppercase tracking-widest text-text-muted">{eventData.label}</span>
            <span className="font-mono text-[10px] text-text-secondary">{formatTime(timestamp)}</span>
          </div>

          <h3 className="text-white text-sm font-bold mb-3">{typeof location === 'string' ? location : location?.name || 'Unknown Location'}</h3>

          <div className="flex items-center gap-2 mb-4">
             {isUnknown ? (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-text-secondary font-mono bg-surface p-1 border border-border">
                  <Loader2 className="w-3 h-3 animate-spin"/> Investigating
                </span>
             ) : (
                <span style={{
                  fontSize: "10px", textTransform: "uppercase",
                  fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
                  padding: "3px 8px",
                  color: sev.token,
                  background: sev.bg,
                  border: `1px solid ${sev.dim}`,
                }}>
                  {sev.label}
                </span>
             )}
          </div>

          <button
            onClick={handlePopupClick}
            className="w-full bg-agent-blue/20 hover:bg-agent-blue text-agent-blue hover:text-white transition-colors py-2 font-mono text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 border border-agent-blue/50"
          >
            View Details <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </Popup>
    </Marker>
  );
});

EventPin.displayName = "EventPin";

export default EventPin;
