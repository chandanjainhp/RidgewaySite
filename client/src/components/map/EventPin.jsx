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

  // Animations strictly built as inline styles or recognized CSS
  const spinHtml = severity === 'unknown' ? `animation: spin 2s linear infinite;` : '';
  const pulseHtml = severity === 'escalate' 
    ? `<div style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: 2px solid ${severityData.color}; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` 
    : '';

  // Minimal SVG for generic placement internally
  const iconHtml = `<div style="position:relative; width:${size}px; height:${size}px; display:flex; justify-content:center; align-items:center; background-color:${severityData.color}; border:2px solid #fff; border-radius:50%; box-shadow:0 0 10px rgba(0,0,0,0.5); ${spinHtml} transition:all 0.2s ease;">
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
        <div className="p-3 bg-surface-2 min-w-[200px] border border-border">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-xs uppercase tracking-widest text-text-muted">{eventData.label}</span>
            <span className="font-mono text-[10px] text-text-secondary">{formatTime(timestamp)}</span>
          </div>
          
          <h3 className="text-white text-sm font-bold mb-3">{location}</h3>
          
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
