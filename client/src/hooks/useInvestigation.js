import { useMutation, useQuery } from "@tanstack/react-query";
import { startInvestigation, getInvestigation, getIncidents } from "@/lib/api";
import { useInvestigationStore } from "@/store/investigationStore";
import { toast } from "sonner";

export function useStartInvestigation(options = {}) {
  const setJobId = useInvestigationStore((state) => state.setJobId);
  const setJobIds = useInvestigationStore((state) => state.setJobIds);
  const setInvestigationStats = useInvestigationStore((state) => state.setInvestigationStats);

  return useMutation({
    mutationFn: (input) => {
      const nightDate =
        typeof input === "string"
          ? input
          : input?.nightDate || (() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            })();

      console.log('[MUTATION] Starting investigation for', nightDate);
      return startInvestigation(nightDate);
    },
    onSuccess: (result, variables, context) => {
      console.log('[MUTATION] SUCCESS - Got result:', result);
      if (result.jobIds && result.jobIds.length > 0) {
        console.log('[MUTATION] Setting jobId:', result.jobIds[0]);
        setJobIds(result.jobIds);
        setJobId(result.jobIds[0]);
      } else {
        setJobIds([]);
        setJobId(null);
      }
      if (result.totalJobs !== undefined) {
        console.log('[MUTATION] Setting stats - totalJobs:', result.totalJobs);
        setInvestigationStats({ totalIncidents: result.totalJobs });
      }
      toast.success("Investigation protocol initiated.");
      if (options.onSuccess) options.onSuccess(result, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[MUTATION] ERROR:', {
        message: error?.message,
        type: error?.type,
        statusCode: error?.statusCode,
        variables,
      });
      toast.error(`Investigation failed to initialize: ${error.message}`);
      if (options.onError) options.onError(error, variables, context);
    },
    ...options,
  });
}

export function useInvestigationData(id, options = {}) {
  return useQuery({
    queryKey: ["investigation", id],
    queryFn: () => getInvestigation(id),
    enabled: !!id,
    staleTime: 0, // Rapidly changing agent states should never cache
    ...options,
  });
}

export function useNightSummary(nightDate, options = {}) {
  return useQuery({
    queryKey: ["investigation", "summary", nightDate],
    queryFn: () => getIncidents({ nightDate }),
    select: (data) => {
      const incidents = Array.isArray(data) ? data : [];
      // Group incidents preemptively for radar views
      const groups = {
        escalations: incidents.filter(i => i.severity === 'escalate'),
        monitored: incidents.filter(i => i.severity === 'monitor'),
        harmless: incidents.filter(i => i.severity === 'harmless'),
        uncertain: incidents.filter(i => i.severity === 'uncertain'),
        unclassified: incidents.filter(i => !i.severity || i.severity === 'unknown'),
      };
      return { incidents, ...groups };
    },
    staleTime: 10 * 1000, // 10s generic refresh cache bounds
    ...options,
  });
}
