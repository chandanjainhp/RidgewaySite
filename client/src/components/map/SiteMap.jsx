"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polygon, ZoomControl } from "react-leaflet";

import DroneRoute from "./DroneRoute";
import EventPin from "./EventPin";

import { useMapStore } from "@/store/mapStore";

export default function SiteMap({
  siteMapData,
  eventPins,
  isLoading,
  isError,
  errorMessage,
}) {
  const mapRef = useRef(null);
  const isMountedRef = useRef(false);
  const selectedPinId = useMapStore((state) => state.selectedPinId);
  const getVisiblePins = useMapStore((state) => state.getVisiblePins);

  // Derive isolated pins instance reliably directly from MapStore filters array dynamically
  const activePins = getVisiblePins();

  // Track mount state to prevent Strict Mode double-mount issues
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Attempt dynamic bounding when selected pin flips
  useEffect(() => {
    if (selectedPinId && mapRef.current) {
      const targetPin = (eventPins || []).find(p => p.id === selectedPinId);
      if (targetPin) {
        mapRef.current.flyTo(targetPin.coordinates, 18, { duration: 0.8 });
      }
    }
  }, [selectedPinId, eventPins]);


  // Show loading overlay only while actively loading.
  const showLoading = Boolean(isLoading && !siteMapData && !isError);

  // Polygon Mapping rules derived from specification
  const polygons = (siteMapData?.boundaries || [])
    .filter(bnd => bnd && Array.isArray(bnd.coordinates) && bnd.coordinates.length > 0)
    .map((bnd, i) => (
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
    <div className="relative isolate h-full w-full bg-surface">
      {showLoading && (
        <div className="absolute inset-0 z-[1000] bg-surface/80 flex items-center justify-center">
          <span className="text-text-muted text-base font-mono">Loading site map...</span>
        </div>
      )}

      {isError && (
        <div className="absolute inset-0 z-[1000] bg-surface/85 flex flex-col items-center justify-center gap-2 text-center p-4">
          <span className="text-red-300 text-sm font-mono uppercase tracking-wide">
            Map data unavailable
          </span>
          <span className="text-text-muted text-xs font-mono">
            {errorMessage || "Failed to load /api/v1/map/geometry"}
          </span>
        </div>
      )}
      <MapContainer
        key="site-map-container"
        center={[51.505, -0.09]}
        zoom={16}
        className="h-full w-full"
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <ZoomControl position="topright" />
        {polygons}
        <DroneRoute siteMapData={siteMapData} />
        {activePins && activePins.map((pin) => (
          <EventPin key={pin.id} pin={pin} />
        ))}
      </MapContainer>
    </div>
  );
}
