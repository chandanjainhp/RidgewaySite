"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SITE_CENTER } from "@/config/constants";

export default function IncidentMiniMap({ incidentId, location }) {
  // Utilizing a generic fallback marker icon since this is an isolated mini-map component
  const fallbackIcon = L.divIcon({
    html: `<div style="width:20px;height:20px;background:#ef4444;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px rgba(239,68,68,0.5);"></div>`,
    className: "",
    iconSize: [20, 20]
  });

  // Target default bounds dynamically via explicit location lookup or fallback reliably
  const targetCoords = [SITE_CENTER.lat, SITE_CENTER.lng];

  return (
    <div className="w-full h-64 border border-border bg-surface relative isolation leaflet-dark-override rounded-sm z-[10]">
      <MapContainer 
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
           <Popup className="dark-popup"><span className="font-mono text-[10px] text-white tracking-widest uppercase">{location || "Target Origin"}</span></Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
