"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useInvestigationStore } from "@/store/investigationStore";
import { useMapStore } from "@/store/mapStore";
import { useDroneReplay } from "@/hooks/useDroneReplay";
import { useIncidents } from "@/hooks/useIncidents";
import { useStartInvestigation } from "@/hooks/useInvestigation";
import { useAgentStream } from "@/hooks/useAgentStream";
import AgentFeed from "@/components/agent/AgentFeed";
import StatusBar from "@/components/layout/StatusBar";
const DroneTimeline = dynamic(
  () => import("@/components/map/DroneTimeline"),
  { ssr: false }
);
import EventPanel from "@/components/events/EventPanel";
import { useQuery } from "@tanstack/react-query";
import { getEventPins } from "@/lib/api";
import useSiteMap from "@/hooks/useSiteMap";
import { toast } from "sonner";

// Dynamic import to avoid SSR issues with Leaflet
const SiteMap = dynamic(
  () => import("@/components/map/SiteMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-surface flex items-center justify-center text-text-muted font-mono text-xs">
        Loading map...
      </div>
    )
  }
);

export default function InvestigationView() {
  const router = useRouter();
  const nightDate = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SEED_NIGHT_DATE) {
      return process.env.NEXT_PUBLIC_SEED_NIGHT_DATE;
    }
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  const hasStartedRef = useRef(false);

  // Investigation store state
  const jobId = useInvestigationStore((state) => state.jobId);
  const jobStatus = useInvestigationStore((state) => state.jobStatus);
  const investigationStats = useInvestigationStore(
    (state) => state.investigationStats
  );

  // Map store actions
  const setSiteMapData = useMapStore((state) => state.setSiteMapData);
  const setEventPins = useMapStore((state) => state.setEventPins);

  // Data fetching hooks
  const {
    data: incidentsData,
    isError: isIncidentsError,
    error: incidentsError,
  } = useIncidents({ nightDate });

  const { mutate: startInvestigation, isPending: isStarting } = useStartInvestigation();

  // SSH stream connection
  useAgentStream(jobId);
  useDroneReplay('PATROL-2026-04-15-N01');

  // Fetch site map and event pins
  const {
    data: siteMapData,
    isLoading: isMapLoading,
    isError: isMapError,
    error: mapError,
  } = useSiteMap();

  const { data: eventPins, isError: isPinsError, error: pinsError } = useQuery({
    queryKey: ['eventPins', nightDate],
    queryFn: () => getEventPins(nightDate),
    enabled: !!nightDate,
    staleTime: 30000,
    retry: (failureCount, error) => {
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        return false;
      }
      if (!error?.statusCode) {
        return failureCount < 2;
      }
      return failureCount < 1;
    },
    refetchInterval: jobStatus === 'running' ? 5000 : false
  });

  // Auto-start: fires once when the store confirms no job is running.
  // Query state (incidents, errors) is intentionally excluded — the server handles the
  // case where there is nothing to investigate and returns an appropriate response.
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (jobId) return;
    if (jobStatus !== "idle") return;
    if (isStarting) return;

    hasStartedRef.current = true;
    console.log("AUTO START FIRING", nightDate);
    startInvestigation({ nightDate });
  }, [jobId, jobStatus, isStarting]);

  // Display error toast if critical data fails
  useEffect(() => {
    if (isIncidentsError || isMapError || isPinsError) {
      const reason =
        incidentsError?.message || mapError?.message || pinsError?.message || "Unknown error";
      toast.error(`Failed to load investigation data: ${reason}`);

      console.error("[Investigate] query failure", {
        nightDate,
        incidentsError: {
          message: incidentsError?.message,
          type: incidentsError?.type,
          statusCode: incidentsError?.statusCode,
        },
        mapError: {
          message: mapError?.message,
          type: mapError?.type,
          statusCode: mapError?.statusCode,
        },
        pinsError: {
          message: pinsError?.message,
          type: pinsError?.type,
          statusCode: pinsError?.statusCode,
        },
      });
    }
  }, [isIncidentsError, isMapError, isPinsError, incidentsError, mapError, pinsError, nightDate]);

  // Populate map data when available
  useEffect(() => {
    if (siteMapData) {
      setSiteMapData(siteMapData);
    }
  }, [siteMapData, setSiteMapData]);

  // Populate event pins when available
  useEffect(() => {
    if (eventPins?.length > 0) {
      setEventPins(eventPins);
    }
  }, [eventPins, setEventPins]);

  return (
    <div
      style={{
        position: "fixed",
        top: "56px",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "#0f1117",
      }}
    >
      {/* STATUS BAR — using StatusBar component */}
      <StatusBar
        jobStatus={jobStatus}
        resolvedIncidents={investigationStats.resolvedIncidents}
        totalIncidents={investigationStats.totalIncidents}
        escalationCount={investigationStats.escalationCount}
        diagnosticMessage={
          incidentsError?.message || mapError?.message || pinsError?.message || null
        }
        onReviewBriefing={() => router.push('/briefing')}
      />

      {(isIncidentsError || isMapError || isPinsError) && (
        <div className="px-4 py-2 border-b border-red-500/30 bg-red-500/10 font-mono text-[11px] text-red-300">
          Investigation data unavailable: {incidentsError?.message || mapError?.message || pinsError?.message}
        </div>
      )}

      {/* THREE COLUMN ROW — critical flex layout - responsive */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT — Agent Feed */}
        <div className="order-3 lg:order-1 w-full lg:w-70 xl:w-80 shrink-0 h-52 sm:h-56 md:h-64 lg:h-full overflow-y-auto overflow-x-hidden border-t lg:border-t-0 lg:border-r border-border bg-surface-2">
          <AgentFeed />
        </div>

        {/* CENTER — Map column */}
        <div className="order-1 lg:order-2 flex-1 min-w-0 min-h-80 sm:min-h-90 lg:h-full flex flex-col overflow-y-auto overflow-x-hidden bg-surface">
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <SiteMap
              siteMapData={siteMapData}
              eventPins={eventPins}
              isLoading={isMapLoading}
              isError={isMapError}
              errorMessage={mapError?.message}
            />
          </div>
          <div className="h-20 shrink-0 border-t border-border overflow-x-hidden">
            <DroneTimeline />
          </div>
        </div>

        {/* RIGHT — Event Panel */}
        <div className="order-2 lg:order-3 w-full lg:w-90 xl:w-[24rem] shrink-0 h-72 sm:h-80 md:h-96 lg:h-full overflow-y-auto overflow-x-hidden border-t lg:border-t-0 lg:border-l border-border bg-surface-2">
          <EventPanel nightDate={nightDate} />
        </div>
      </div>

      <button
        type="button"
        className="fixed bottom-4 right-4 z-9999 px-5 py-2 rounded-full border border-border bg-surface text-text-primary font-mono text-[11px] uppercase tracking-widest"
        onClick={() => {
          console.log("DEBUG manual start", nightDate);
          startInvestigation({ nightDate });
        }}
      >
        DEBUG START
      </button>

    </div>
  );
}
