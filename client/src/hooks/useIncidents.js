import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getIncidents, getIncidentById, getIncidentEvidenceGraph, applyMayaReview } from "@/lib/api";
import { toast } from "sonner";
import { useReviewStore } from "@/store/reviewStore"; // Safe assumption for upcoming store

export function useIncidents(filters = {}, options = {}) {
  return useQuery({
    queryKey: ["incidents", filters],
    queryFn: () => getIncidents(filters),
    select: (data) => {
      return {
        incidents: data,
        escalations: data.filter((i) => i.severity === "escalate"),
        monitored: data.filter((i) => i.severity === "monitor"),
        harmless: data.filter((i) => i.severity === "harmless"),
        pending: data.filter((i) => i.status !== "resolved")
      };
    },
    staleTime: 15 * 1000,
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
