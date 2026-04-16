import { useEffect, useRef } from "react";
import { createSSEConnection } from "@/lib/sse";
import { useInvestigationStore } from "@/store/investigationStore";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Mocking useMapStore import temporarily since Phase 4 covers state. This assumes mapStore exports the Zustand object.
import { useMapStore } from "@/store/mapStore";

export function useAgentStream(jobId) {
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  // Directly hook Zustand store actions instead of full state object to prevent re-renders
  const setJobStatus = useInvestigationStore((state) => state.setJobStatus);
  const addFeedItem = useInvestigationStore((state) => state.addFeedItem);
  const addClassification = useInvestigationStore((state) => state.addClassification);
  const updateProgress = useInvestigationStore((state) => state.updateProgress);
  const setError = useInvestigationStore((state) => state.setError);
  
  const connectedAt = useInvestigationStore((state) => state.connectedAt);
  const jobStatus = useInvestigationStore((state) => state.jobStatus);
  const feedItems = useInvestigationStore((state) => state.feedItems);
  const error = useInvestigationStore((state) => state.error);

  // Safely import Map Actions
  const updatePinSeverity = useMapStore ? useMapStore.getState?.().updatePinSeverity : () => {};

  useEffect(() => {
    isMounted.current = true;
    let disconnect = () => {};

    if (jobId) {
      disconnect = createSSEConnection(jobId, {
        onConnected: () => {
          if (!isMounted.current) return;
          setJobStatus("running");
        },
        onMessage: (progressEvent) => {
          if (!isMounted.current) return;
          
          // Append natively parsed log line to feed
          addFeedItem(progressEvent);

          if (progressEvent.type === "classification") {
            const { incidentId, severity, confidence, reasoning } = progressEvent.payload;
            addClassification(incidentId, { severity, confidence, reasoning });
            if (updatePinSeverity) updatePinSeverity(incidentId, severity);
          }

          if (progressEvent.type === "tool_called") {
             const { resolvedIncidents, totalIncidents } = progressEvent.payload || {};
             if (resolvedIncidents !== undefined && totalIncidents !== undefined) {
               updateProgress(resolvedIncidents, totalIncidents);
             }
          }
        },
        onComplete: (data) => {
          if (!isMounted.current) return;
          setJobStatus("complete");
          queryClient.invalidateQueries({ queryKey: ["incidents"] });
          queryClient.invalidateQueries({ queryKey: ["briefing"] });
          toast.success("Agent evaluation complete.");
        },
        onFailed: (data) => {
          if (!isMounted.current) return;
          setJobStatus("failed");
          setError(data.message || "Unknown Failure");
          toast.error("Agent encountered a critical failure.");
        },
        onError: (err) => {
          if (!isMounted.current) return;
          toast("Attempting to reconnect Agent stream...");
        }
      });
    }

    return () => {
      isMounted.current = false;
      disconnect();
    };
  }, [jobId, setJobStatus, addFeedItem, addClassification, updateProgress, setError, queryClient, updatePinSeverity]);

  return {
    isConnected: jobStatus === "running",
    feedItems,
    jobStatus,
    error
  };
}
