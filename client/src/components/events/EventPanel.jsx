"use client";

import { useState } from "react";
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
        <div className="flex flex-col gap-4 px-2">
            {events.map(event => (
              <EventCard key={event.id} incident={event} />
            ))}
        </div>
      )}
    </div>
  );
};

export default function EventPanel() {
  // Use yesterday's date to match server seed data (same as investigate/page.js)
  const nightDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  const { data, isLoading, isError, error } = useIncidents({ nightDate });
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

  if (isError) {
    const failureReason = error?.message || "Unknown request error";
    return (
      <div className="p-6 text-center">
        <div className="text-xs text-severity-escalate font-mono tracking-wide uppercase mb-2">
          ERROR LOADING EVENT DATA
        </div>
        <div className="text-[10px] text-text-muted font-mono mb-1">
          PLEASE CHECK YOUR NETWORK OR SESSION
        </div>
        <div className="text-[10px] text-amber-300 font-mono wrap-break-word">
          {failureReason}
        </div>
      </div>
    );
  }

  const allIncidents = data?.incidents || [];
  const filteredEvents = allIncidents.filter(inc => activeSeverityFilters.includes(inc.severity || "unknown"));

  return (
    <div className="flex flex-col h-full overflow-hidden shrink-0 w-full bg-surface-2">
      {/* Panel Header */}
      <div className="px-4 py-4 border-b border-border flex justify-between items-center shrink-0">
        <span className="font-display uppercase text-[11px] tracking-[0.12em] text-text-secondary">
          OVERNIGHT EVENTS
        </span>
        <div className="font-mono bg-surface text-text-secondary text-[11px] px-2 py-1 rounded-full border border-border">
          {allIncidents?.length || 0} events
        </div>
      </div>

      {/* Severity Filter Pills — ONLY instance - responsive */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-border shrink-0">
        {['harmless', 'monitor', 'escalate', 'uncertain'].map(severity => {
          const isActive = activeSeverityFilters.includes(severity);
          const config = SEVERITY_CONFIG[severity];
          return (
            <button
              key={severity}
              onClick={() => toggleSeverityFilter(severity)}
              className={`font-mono whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border transition-colors ${
                isActive
                  ? `${config.borderClass} ${config.bgClass} ${config.textClass}`
                  : 'border-border text-text-muted bg-surface'
              }`}
            >
              {severity.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Scrollable List container - responsive padding */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar scroll-smooth px-4 py-4">
        {allIncidents.length === 0 && (
          <div className="py-6 text-center">
            <div className="text-xs text-text-muted font-mono tracking-wide uppercase mb-2">
              NO OVERNIGHT EVENTS FOUND
            </div>
            <div className="text-xs text-border font-mono">
              {nightDate}
            </div>
          </div>
        )}

        {allIncidents.length > 0 && filteredEvents.length === 0 && (
          <div className="py-6 text-center">
            <div className="text-xs text-text-muted font-mono tracking-wide uppercase">
              NO EVENTS MATCH FILTERS
            </div>
          </div>
        )}

        {groupings.map(g => {
          const groupData = (data?.[g.dataKey] || []).filter(inc => activeSeverityFilters.includes(inc.severity || "unknown"));
          return <EventGroup key={g.key} title={g.title} severityKey={g.key} events={groupData} count={groupData.length} />;
        })}
      </div>
    </div>
  );
}
