"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SITE_CENTER } from "@/config/constants";

export default function IncidentMiniMap({ incidentId, location }) {
  const mapRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (mapRef.current) {
        try {
          if (mapRef.current._leaflet_id) delete mapRef.current._leaflet_id;
          if (mapRef.current._container) delete mapRef.current._container._leaflet_id;
        } catch (_) {}
      }
    };
  }, []);

  const fallbackIcon = useMemo(() => L.divIcon({
    html: `<div style="width:20px;height:20px;background:var(--sev-serious);border-radius:50%;border:2px solid rgba(255,255,255,0.3);box-shadow:var(--glow-serious)"></div>`,
    className: "",
    iconSize: [20, 20],
  }), []);

  const targetCoords = [SITE_CENTER?.lat ?? 51.505, SITE_CENTER?.lng ?? -0.09];

  if (!mounted) return (
    <div className="w-full h-64 border border-border bg-surface rounded-sm" />
  );

  return (
    <div className="w-full h-64 border border-border bg-surface relative isolation leaflet-dark-override rounded-sm z-10">
      <MapContainer
        key={`minimap-${incidentId}`}
        ref={mapRef}
        center={targetCoords}
        zoom={16}
        zoomControl={false}
        className="w-full h-full"
        dragging={false}
        scrollWheelZoom={false}
      >
         <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
        />

        <Marker position={targetCoords} icon={fallbackIcon}>
           <Popup className="dark-popup"><span className="font-mono text-[10px] text-white tracking-widest uppercase">{typeof location === 'string' ? location : location?.name || "Target Origin"}</span></Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
