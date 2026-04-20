import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getIncidents, getIncidentById, getIncidentEvidenceGraph, applyMayaReview } from "@/lib/api";
import { toast } from "sonner";
import { useReviewStore } from "@/store/reviewStore"; // Safe assumption for upcoming store

export function useIncidents(filters = {}, options = {}) {
  return useQuery({
    queryKey: ["incidents", filters],
    queryFn: () => getIncidents(filters),
    select: (data) => {
      const incidents = Array.isArray(data) ? data : [];
      return {
        incidents,
        escalations: incidents.filter((i) => i.severity === "escalate"),
        monitored: incidents.filter((i) => i.severity === "monitor"),
        uncertain: incidents.filter((i) => i.severity === "uncertain"),
        harmless: incidents.filter((i) => i.severity === "harmless"),
        unclassified: incidents.filter(
          (i) => !i.severity || i.severity === "unknown"
        ),
        pending: incidents.filter(
          (i) => i.status !== "resolved" && i.status !== "complete"
        ),
      };
    },
    staleTime: 15 * 1000,
    retry: (failureCount, error) => {
      // Fail fast on auth/permission errors so the UI can show actionable state.
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        return false;
      }

      if (!error?.statusCode) {
        return failureCount < 2;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options
  });
}

export function useIncidentById(id, options = {}) {
  return useQuery({
    queryKey: ["incidents", id],
    queryFn: () => getIncidentById(id),
    enabled: !!id,
    staleTime: 0,
    ...options
  });
}

export function useIncidentEvidenceGraph(id, options = {}) {
  return useQuery({
    queryKey: ["incidents", id, "evidence-graph"],
    queryFn: () => getIncidentEvidenceGraph(id),
    enabled: !!id,
    ...options
  });
}

export function useApplyReview(options = {}) {
  const queryClient = useQueryClient();
  const confirmReview = useReviewStore ? useReviewStore.getState?.().confirmReview : () => {};

  return useMutation({
    mutationFn: ({ eventId, reviewData }) => applyMayaReview(eventId, reviewData),
    onSuccess: (result, variables, context) => {
      if (confirmReview) confirmReview(variables.eventId, variables.reviewData);

      // Enforce cross-store synchronization across queries
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["briefing"] });

      toast.success("Review saved");
      if (options.onSuccess) options.onSuccess(result, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(`Review dispatch failed: ${error.message}`);
      if (options.onError) options.onError(error, variables, context);
    },
    ...options
  });
}
