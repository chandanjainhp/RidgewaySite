import { useQuery } from "@tanstack/react-query";
import {
  getIncidents,
  getIncidentById,
  getIncidentEvidenceGraph,
} from "@/lib/api";
import { toast } from "sonner";

export function useIncidents(filters = {}, options = {}) {
  return useQuery({
    queryKey: ["incidents", filters],
    queryFn: () => getIncidents(filters),
    select: (data) => {
      const incidents = Array.isArray(data) ? data : [];
      return {
        incidents,
        serious: incidents.filter((i) => i.severity === "serious"),
        minor: incidents.filter((i) => i.severity === "minor"),
        uncertain: incidents.filter((i) => i.severity === "uncertain"),
        harmless: incidents.filter((i) => i.severity === "harmless"),
        unclassified: incidents.filter((i) => !i.severity),
        pending: incidents.filter(
          (i) => i.status !== "resolved" && i.status !== "complete",
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
    ...options,
  });
}

export function useIncidentById(id, options = {}) {
  return useQuery({
    queryKey: ["incidents", id],
    queryFn: () => getIncidentById(id),
    enabled: !!id,
    staleTime: 0,
    ...options,
  });
}

export function useIncidentEvidenceGraph(id, options = {}) {
  return useQuery({
    queryKey: ["incidents", id, "evidence-graph"],
    queryFn: () => getIncidentEvidenceGraph(id),
    enabled: !!id,
    ...options,
  });
}
