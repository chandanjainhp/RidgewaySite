"use client";

import { useEffect, useRef, useState } from "react";
import { useIncidents } from "@/hooks/useIncidents";
import { useMapStore } from "@/store/mapStore";
import { SEVERITY_CONFIG } from "@/config/constants";
import EventCard from "./EventCard";
import { ChevronDown, ChevronRight } from "lucide-react";

const EventGroup = ({ title, severityKey, events, count }) => {
  const [isExpanded, setIsExpanded] = useState(true); // Default open as specified
  const severityData = SEVERITY_CONFIG[severityKey];

  if (!events || events.length === 0) return null;

  return (
    <div className="mb-4">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 border-b border-border/50 hover:bg-surface/50 transition-colors px-2 mb-2"
      >
        <div className="flex items-center gap-2">
           {isExpanded ? <ChevronDown className="w-4 h-4 text-text-muted"/> : <ChevronRight className="w-4 h-4 text-text-muted"/>}
           <span className={`font-mono text-xs uppercase font-bold tracking-widest ${severityData?.textClass || 'text-white'}`}>{title}</span>
        </div>
        <span className="font-mono text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded-sm border border-border">
          {count}
        </span>
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-3 px-2">
            {events.map(event => (
              <EventCard key={event.id} incident={event} />
            ))}
        </div>
      )}
    </div>
  );
};

export default function EventPanel() {
  // Grab raw dates/context efficiently tracking the current night
  const nightDate = new Date().toISOString().split('T')[0];
  const { data, isLoading } = useIncidents({ nightDate });

  const activeSeverityFilters = useMapStore(state => state.activeSeverityFilters);
  const toggleSeverityFilter = useMapStore(state => state.toggleSeverityFilter);

  // Group sorting definitions
  const groupings = [
    { title: "Require Escalation", key: "escalate", dataKey: "escalations" },
    { title: "Target Monitored", key: "monitor", dataKey: "monitored" },
    { title: "Uncertain Events", key: "uncertain", dataKey: "uncertain" },
    { title: "Harmless/Cleared", key: "harmless", dataKey: "harmless" },
    { title: "Unknown / Pending", key: "unknown", dataKey: "unclassified" }
  ];

  if (isLoading) {
    return <div className="p-6 font-mono text-xs text-text-muted uppercase text-center animate-pulse">Loading Event Matrix...</div>;
  }

  const allIncidents = data?.incidents || [];
  const filteredEvents = allIncidents.filter(inc => activeSeverityFilters.includes(inc.severity || "unknown"));

  return (
    <div className="flex flex-col h-full overflow-hidden shrink-0 w-full relative group">
      {/* Scrollable List container */}
      <div className="flex-1 overflow-y-auto w-full p-4 custom-scrollbar scroll-smooth">
         {allIncidents.length === 0 && (
            <div className="border border-border/50 border-dashed rounded-sm p-8 text-center text-text-muted font-mono text-xs uppercase mt-4">
              No overnight events found
            </div>
         )}
         
         {allIncidents.length > 0 && filteredEvents.length === 0 && (
            <div className="border border-border/50 border-dashed rounded-sm p-8 text-center text-text-muted font-mono text-xs uppercase mt-4">
              No events match the active filters
            </div>
         )}

         {groupings.map(g => {
            // Bind group data ensuring we only map locally visible filters
            const groupData = (data?.[g.dataKey] || []).filter(inc => activeSeverityFilters.includes(inc.severity || "unknown"));
            return <EventGroup key={g.key} title={g.title} severityKey={g.key} events={groupData} count={groupData.length} />;
         })}
      </div>
      
      {/* Filter Overlay attached to Header area seamlessly */}
      <div className="absolute top-[-73px] right-6 flex gap-1 z-[50]">
         {Object.keys(SEVERITY_CONFIG).map(sKey => {
            const isActive = activeSeverityFilters.includes(sKey);
            const conf = SEVERITY_CONFIG[sKey];
            return (
              <div 
                key={sKey}
                onClick={() => toggleSeverityFilter(sKey)}
                className={`w-6 h-6 rounded-full border cursor-pointer transition-all flex items-center justify-center opacity-${isActive ? '100' : '40 hover:opacity-80 scale-90'} shadow-sm`}
                style={{ backgroundColor: conf.color, borderColor: '#fff' }}
                title={`Toggle ${conf.label}`}
              ></div>
            );
         })}
      </div>
    </div>
  );
}
