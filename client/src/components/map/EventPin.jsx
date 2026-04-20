"use client";

import React, { memo } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { SEVERITY_CONFIG, EVENT_TYPE_CONFIG } from "@/config/constants";
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
  const severityData = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG['unknown'];
  const eventData = EVENT_TYPE_CONFIG[type] || { label: 'Unknown Event', icon: 'zap' };

  // Building dynamic HTML string map icons for CartoDB Leaflet bindings
  const size = isSelected ? 28 : 20;
  const sizeClass = isSelected ? 'w-7 h-7' : 'w-5 h-5';

  // Animations and pulse are expressed via utility classes inside icon HTML
  const spinClass = severity === 'unknown' ? 'animate-spin' : '';
  const pulseHtml = severity === 'escalate'
    ? `<div class="absolute inset-0 border-2 border-severity-escalate rounded-full animate-ping"></div>`
    : '';

  // Minimal SVG for generic placement internally
  const iconHtml = `<div class="relative ${sizeClass} flex items-center justify-center border-2 border-white rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${spinClass} ${severityData.bgClass}">
     ${pulseHtml}
  </div>`;

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
             {severity === 'unknown' ? (
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-text-secondary font-mono bg-surface p-1 border border-border">
                  <Loader2 className="w-3 h-3 animate-spin"/> Investigating
                </span>
             ) : (
                <span className={`text-[10px] uppercase font-mono tracking-widest px-2 py-1 ${severityData.textClass} ${severityData.bgClass} border ${severityData.borderClass}`}>
                  {severityData.label}
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
