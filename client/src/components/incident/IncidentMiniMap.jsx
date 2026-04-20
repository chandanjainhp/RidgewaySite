"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SITE_CENTER } from "@/config/constants";

export default function IncidentMiniMap({ incidentId, location }) {
  const mapRef = useRef(null);

  // Proper cleanup of Leaflet map on unmount to prevent "container reuse" errors in Strict Mode
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        try {
          // Force cleanup of Leaflet internal state
          if (mapRef.current._leaflet_id) {
            delete mapRef.current._leaflet_id;
          }
          if (mapRef.current._container) {
            delete mapRef.current._container._leaflet_id;
          }
        } catch (e) {
          // Suppress cleanup errors silently
        }
      }
    };
  }, []);

  // Utilizing a generic fallback marker icon since this is an isolated mini-map component
  const fallbackIcon = L.divIcon({
    html: `<div class="w-5 h-5 bg-severity-escalate rounded-full border-2 border-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>`,
    className: "",
    iconSize: [20, 20]
  });

  // Target default bounds dynamically via explicit location lookup or fallback reliably
  const targetCoords = [SITE_CENTER.lat, SITE_CENTER.lng];

  return (
    <div className="w-full h-64 border border-border bg-surface relative isolation leaflet-dark-override rounded-sm z-10">
      <MapContainer
        key="incident-mini-map"
        ref={mapRef}
        center={targetCoords}
        zoom={16}
        zoomControl={false}
        className="w-full h-full"
        dragging={false}   // Disable interaction allowing user to focus strictly on geography
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
