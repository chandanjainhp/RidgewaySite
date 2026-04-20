"use client";

import { Polyline, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { useMapStore } from "@/store/mapStore";

export default function DroneRoute({ siteMapData }) {
  const droneCurrentPosition = useMapStore(
    (state) => state.droneCurrentPosition
  );
  const droneRoute = useMapStore(
    (state) => state.droneRoute
  );

  if (!droneRoute || droneRoute.length === 0) return null;

  // Render Waypoint Markers
  const waypoints = droneRoute.filter(pt => pt.isWaypoint).map((pt, idx) => {
    const hasFinding = pt.findingAttached === true;

    return (
      <CircleMarker
        key={idx}
        center={[pt.lat, pt.lng]}
        radius={hasFinding ? 6 : 4}
        pathOptions={{
          color: hasFinding ? "#60a5fa" : "#1e3a5f",
          fillColor: hasFinding ? "#ffffff" : "#60a5fa",
          fillOpacity: 1,
          weight: 2
        }}
      >
        <Popup className="dark-popup font-mono text-xs rounded-sm border border-border">
          <div className="bg-surface-2 text-text-primary p-2">
            <div className="text-white font-bold mb-1">{typeof pt.location === 'string' ? pt.location : pt.location?.name || "Waypoint"}</div>
            {pt.observation && <div className="text-text-secondary">{pt.observation}</div>}
          </div>
        </Popup>
      </CircleMarker>
    );
  });

  // Render Current Position Pulse Hex
  let activeMarker = null;
  if (
    droneCurrentPosition?.currentPosition &&
    typeof droneCurrentPosition.currentPosition.lat === "number" &&
    typeof droneCurrentPosition.currentPosition.lng === "number"
  ) {
    const pulseHtml = `
      <div class="relative w-6 h-6 bg-agent-blue border-2 border-white rounded-sm flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 11h2v2h-2z"/><path d="M12 7v4"/><path d="M12 13v4"/><path d="m15 15 3 3"/><path d="m15 9 3-3"/><path d="m6 6 3 3"/><path d="m6 18 3-3"/></svg>
        <div class="absolute -inset-2 border-2 border-agent-blue rounded-full animate-ping"></div>
      </div>
    `;

    const droneIcon = L.divIcon({
      html: pulseHtml,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });

    activeMarker = (
      <Marker
        position={[
          droneCurrentPosition.currentPosition.lat,
          droneCurrentPosition.currentPosition.lng,
        ]}
        icon={droneIcon}
        zIndexOffset={1000}
      >
        <Popup className="dark-popup border border-border">
          <div className="p-2 font-mono text-[10px] bg-agent-blue text-white tracking-widest uppercase text-center">
            Drone at {typeof droneCurrentPosition.lastWaypoint?.location === 'string' ? droneCurrentPosition.lastWaypoint.location : droneCurrentPosition.lastWaypoint?.location?.name || "Active Coordinates"}
            <span className="block opacity-70 mt-1">{droneCurrentPosition.targetTime || "--:--"}</span>
          </div>
        </Popup>
      </Marker>
    );
  }

  // Draw the dashed blue polyline
  const polylineCoords = droneRoute
    .filter(pt => pt && typeof pt.lat === 'number' && typeof pt.lng === 'number')
    .map(pt => [pt.lat, pt.lng]);

  return (
    <>
      {polylineCoords.length > 0 && (
        <Polyline positions={polylineCoords} pathOptions={{ color: "#60a5fa", weight: 2, dashArray: "5 5", opacity: 0.6 }} />
      )}
      {waypoints}
      {activeMarker}
    </>
  );
}
