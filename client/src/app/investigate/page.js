"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useInvestigationStore } from "@/store/investigationStore";
import { useIncidents, useStartInvestigation } from "@/hooks/useIncidents"; // We'll adapt from our hooks
import { useAgentStream } from "@/hooks/useAgentStream";
import AppShell from "@/components/layout/AppShell";
import AgentFeed from "@/components/agent/AgentFeed";

// Dynamic import Leaflet to explicitly dodge Next JS server-side layout issues
const SiteMap = dynamic(() => import("@/components/map/SiteMap"), { ssr: false });

// Import newly constructed layout panels and timelines
import DroneTimeline from "@/components/map/DroneTimeline";
import EventPanel from "@/components/events/EventPanel";

// We adapt the hook imports locally based on what was provided/planned
import { useQuery } from "@tanstack/react-query";
import { getEventPins, startInvestigation } from "@/lib/api";

export default function InvestigationView() {
  const nightDate = new Date().toISOString().split('T')[0]; // Simplify dynamic night targeting

  const { data: incidentsData } = useIncidents({ nightDate });
  const jobId = useInvestigationStore(state => state.jobId);
  const jobStatus = useInvestigationStore(state => state.jobStatus);
  const setJobId = useInvestigationStore(state => state.setJobId);
  
  // Custom execution bridging startInvestigation
  useEffect(() => {
    let active = true;
    if (jobStatus === "idle" && incidentsData?.pending?.length > 0 && !jobId) {
       startInvestigation(nightDate).then(res => {
         if (active && res.jobIds?.[0]) setJobId(res.jobIds[0]);
       }).catch(console.error);
    }
    return () => { active = false; };
  }, [jobStatus, incidentsData, jobId, nightDate, setJobId]);

  // Handle SSE hook dispatch conditionally relying on state overrides internally
  useAgentStream(jobId);

  // Hook resolutions bypassing custom hooks until explicitly mapped
  const { data: siteMapData } = useQuery({ queryKey: ["map", "geometry"], queryFn: () => ({ boundaries: [] }), staleTime: Infinity });
  const { data: eventPins } = useQuery({ queryKey: ["map", "events", nightDate], queryFn: () => getEventPins(nightDate), enabled: false });

  return (
    <AppShell variant="investigate">
      {/* 1. Left Sidebar: Agent Context Log */}
      <div className="w-[320px] h-full overflow-hidden border-r border-border bg-surface-2 flex flex-col">
        <AgentFeed />
      </div>

      {/* 2. Central Component: Operational Layout & Drone tracking */}
      <div className="flex-1 relative h-full flex flex-col bg-surface z-0 isolate">
        <SiteMap siteMapData={siteMapData} eventPins={eventPins} />
        <DroneTimeline />
      </div>

      {/* 3. Right Sidebar: Individual Events Filter List */}
      <div className="w-[360px] h-full overflow-hidden border-l border-border bg-surface-2 flex flex-col pt-4">
        <div className="px-6 pb-4 border-b border-border shrink-0">
          <h2 className="font-mono text-ms text-white tracking-widest uppercase mb-4">OVERNIGHT EVENTS</h2>
          <div className="flex gap-2">
            {/* Filter pills stubbed out */}
            <div className="h-6 w-12 bg-severity-escalate rounded-full opacity-50 cursor-pointer hover:opacity-100 transition-opacity"></div>
            <div className="h-6 w-12 bg-severity-monitor rounded-full opacity-50 cursor-pointer hover:opacity-100 transition-opacity"></div>
          </div>
        </div>
        <EventPanel />
      </div>
    </AppShell>
  );
}
