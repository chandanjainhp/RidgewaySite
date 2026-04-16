"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polygon, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import DroneRoute from "./DroneRoute";
import EventPin from "./EventPin";

import { useMapStore } from "@/store/mapStore";
import { DEFAULT_MAP_ZOOM, SITE_CENTER } from "@/config/constants";

export default function SiteMap({ siteMapData, eventPins }) {
  const mapRef = useRef(null);
  const droneRoute = useMapStore((state) => state.droneRoute);
  const selectedPinId = useMapStore((state) => state.selectedPinId);
  const getVisiblePins = useMapStore((state) => state.getVisiblePins);

  // Derive isolated pins instance reliably directly from MapStore filters array dynamically
  const activePins = getVisiblePins();

  // Attempt dynamic bounding when selected pin flips
  useEffect(() => {
    if (selectedPinId && mapRef.current) {
      const targetPin = (eventPins || []).find(p => p.id === selectedPinId);
      if (targetPin) {
        mapRef.current.flyTo(targetPin.coordinates, DEFAULT_MAP_ZOOM + 2, { duration: 0.8 });
      }
    }
  }, [selectedPinId, eventPins]);

  if (!siteMapData && !eventPins) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-2 text-agent-blue animate-pulse font-mono tracking-widest text-xs uppercase z-[400] relative">
         <div className="mb-4 w-12 h-12 border-4 border-agent-blue/30 border-t-agent-blue rounded-full animate-spin"></div>
         Calibrating Spatial Overlays...
      </div>
    );
  }

  // Polygon Mapping rules derived from specification
  const polygons = (siteMapData?.boundaries || []).map((bnd, i) => (
    <Polygon
      key={i}
      positions={bnd.coordinates}
      pathOptions={{
        color: bnd.type === "perimeter" ? "#ffffff" : bnd.color || "#8892a4",
        weight: bnd.type === "perimeter" ? 2 : 1,
        dashArray: bnd.type === "perimeter" ? "5 5" : undefined,
        fillColor: bnd.color || "#8892a4",
        fillOpacity: bnd.type === "perimeter" ? 0 : 0.1,
      }}
    />
  ));

  return (
    <div className="w-full h-full relative z-[100] isolate leaflet-dark-override bg-surface">
      <MapContainer
        center={[SITE_CENTER.lat, SITE_CENTER.lng]}
        zoom={DEFAULT_MAP_ZOOM}
        className="w-full h-full bg-surface"
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        />

        {/* Custom generic zoom repositioned away from operational UI */}
        <ZoomControl position="topright" />

        {/* Map Boundaries */}
        {polygons}

        {/* Drone Dynamic Route (Dashed blue polyline & live interpolations via Replay hooks) */}
        <DroneRoute siteMapData={siteMapData} />
        
        {/* Active Pins rendering eventPins via external store mapped states accurately bypassing standard props */}
        {activePins && activePins.map((pin) => (
           <EventPin key={pin.id} pin={pin} />
        ))}
        
      </MapContainer>
    </div>
  );
}
