"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInvestigationStore } from "@/store/investigationStore";
import { useMapStore } from "@/store/mapStore";
import { useQuery } from "@tanstack/react-query";
import { getStoredToken, clearStoredToken } from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import ConnectionStatusPanel from "@/components/shared/ConnectionStatusPanel";

// Only render in development
export default function ConnectionStatus() {
  // Return null in production
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  // Investigation store
  const jobId = useInvestigationStore((state) => state.jobId);
  const jobStatus = useInvestigationStore((state) => state.jobStatus);
  const feedItemsCount = useInvestigationStore((state) => state.feedItems.length);
  const classifiedCount = Object.keys(
    useInvestigationStore((state) => state.classifiedIncidents)
  ).length;

  // Map store
  const siteMapDataLoaded = useMapStore((state) => !!state.siteMapData);
  const eventPinsCount = useMapStore((state) => state.eventPins.length);

  // Server health
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      try {
        const response = await fetch(
          (process.env.NEXT_PUBLIC_API_URL || "") + "/api/v1/health",
          {
            headers: {
              "Authorization": `Bearer ${getStoredToken()}`,
            },
          }
        );
        return response.ok ? { status: "ok" } : { status: "error" };
      } catch {
        return { status: "error" };
      }
    },
    refetchInterval: 10000,
    });

  // Get query cache info
  const activeQueries = queryClient
    .getQueryCache()
    .getAll()
    .slice(0, 5);

  const handleClearToken = () => {
    clearStoredToken();
    window.location.reload();
  };

  const handleResetStores = () => {
    useInvestigationStore.getState().resetStore();
    window.location.reload();
  };

  const serverHealthOk = healthData?.status === "ok";
  const tokenPresent = !!getStoredToken();
  return (
    <div className="fixed bottom-4 left-4 z-50 font-mono text-xs">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-2 rounded transition ${
          isExpanded
            ? "bg-surface-warm border border-border text-text-primary"
            : "bg-surface border border-border text-text-muted hover:text-text-primary"
        }`}
      >
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <ConnectionStatusPanel
          healthLoading={healthLoading}
          serverHealthOk={serverHealthOk}
          tokenPresent={tokenPresent}
          handleClearToken={handleClearToken}
          jobId={jobId}
          jobStatus={jobStatus}
          feedItemsCount={feedItemsCount}
          classifiedCount={classifiedCount}
          siteMapDataLoaded={siteMapDataLoaded}
          eventPinsCount={eventPinsCount}
          activeQueries={activeQueries}
          handleResetStores={handleResetStores}
        />
      )}
    </div>
  );
}
