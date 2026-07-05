"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
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
  nightDate,
}) {
  const mapRef = useRef(null);
  const isMountedRef = useRef(false);
  const selectedPinId = useMapStore((state) => state.selectedPinId);
  const getVisiblePins = useMapStore((state) => state.getVisiblePins);

  const activePins = getVisiblePins();

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (selectedPinId && mapRef.current) {
      const targetPin = (eventPins || []).find((p) => p.id === selectedPinId);
      if (targetPin) {
        mapRef.current.flyTo(targetPin.coordinates, 18, { duration: 0.8 });
      }
    }
  }, [selectedPinId, eventPins]);

  const coords = siteMapData?.coordinates;
  const hasCoords =
    coords && typeof coords.lat === "number" && typeof coords.lng === "number";
  const hasZones = (siteMapData?.locations?.length ?? 0) > 0;
  const hasEvents = (activePins?.length ?? 0) > 0;
  const showLoading = Boolean(isLoading && !siteMapData && !isError);

  // STATE A — no coordinates configured. Blank surface, overlay card.
  if (!showLoading && !isError && !hasCoords) {
    return (
      <div className="relative isolate h-full w-full" style={{ background: "var(--bg-surface-1)" }}>
        <EmptyOverlay
          title="Site coordinates not configured."
          ctaLabel="Configure site →"
          ctaHref="/settings/general"
        />
      </div>
    );
  }

  const polygons = (siteMapData?.boundaries || [])
    .filter((bnd) => bnd && Array.isArray(bnd.coordinates) && bnd.coordinates.length > 0)
    .map((bnd, i) => (
      <Polygon
        key={i}
        positions={bnd.coordinates}
        pathOptions={{
          color: bnd.type === "perimeter" ? "var(--border-default)" : bnd.color || "#8892a4",
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

      {hasCoords && (
        <MapContainer
          key={`map-${coords.lat}-${coords.lng}`}
          center={[coords.lat, coords.lng]}
          zoom={15}
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
          {hasZones && <DroneRoute siteMapData={siteMapData} />}
          {hasZones && activePins && activePins.map((pin) => (
            <EventPin key={pin.id} pin={pin} />
          ))}
        </MapContainer>
      )}

      {/* STATE B — coords but no zones */}
      {hasCoords && !hasZones && !isError && (
        <EmptyOverlay
          title="No zones defined yet."
          subtitle="Argus will use a single default zone until you add site geometry."
          ctaLabel="Configure site →"
          ctaHref="/settings/general"
        />
      )}

      {/* STATE C — zones, no events */}
      {hasCoords && hasZones && !hasEvents && !isError && (
        <div
          style={{
            position: "absolute",
            top: "30%", left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            background: "rgba(7,9,12,0.7)",
            border: "1px solid var(--border-default)",
            borderRadius: 0,
            padding: "12px 20px",
            zIndex: 500,
            textAlign: "center",
            maxWidth: "360px",
          }}
        >
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: "12px",
            color: "var(--fg-2)", margin: 0,
          }}>
            No events recorded{nightDate ? ` for ${nightDate}` : ""}.
          </p>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 400,
            color: "var(--fg-4)", margin: "6px 0 0 0",
          }}>
            Patrol either did not run or did not detect anything reportable.
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyOverlay({ title, subtitle, ctaLabel, ctaHref }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "30%", left: "50%",
        transform: "translateX(-50%)",
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: 0,
        padding: "24px 28px",
        zIndex: 600,
        textAlign: "center",
        maxWidth: "380px",
      }}
    >
      <p style={{
        fontFamily: "var(--font-mono)", fontSize: "12px",
        color: "var(--fg-2)", margin: 0, fontWeight: 400,
      }}>
        {title}
      </p>
      {subtitle && (
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 400,
          color: "var(--fg-3)", margin: "6px 0 0 0",
        }}>
          {subtitle}
        </p>
      )}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          style={{
            display: "inline-block",
            marginTop: "14px",
            padding: "8px 14px",
            background: "transparent",
            color: "var(--accent)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            textDecoration: "none",
            borderRadius: 0,
            border: "1px solid var(--accent)",
            transition: "background 120ms ease, color 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.color = "var(--bg-base)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--accent)";
          }}
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
