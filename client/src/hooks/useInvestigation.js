import { useMutation, useQuery } from "@tanstack/react-query";
import { startInvestigation, getInvestigation, getIncidents } from "@/lib/api";
import { useInvestigationStore } from "@/store/investigationStore";
import { toast } from "sonner";

export function useStartInvestigation(options = {}) {
  const setJobId = useInvestigationStore((state) => state.setJobId);
  const setInvestigationStats = useInvestigationStore((state) => state.setInvestigationStats);

  return useMutation({
    mutationFn: (nightDate) => startInvestigation(nightDate),
    onSuccess: (result, variables, context) => {
      if (result.jobIds && result.jobIds.length > 0) {
        setJobId(result.jobIds[0]);
      }
      if (result.totalJobs !== undefined) {
         setInvestigationStats({ totalIncidents: result.totalJobs });
      }
      toast.success("Investigation protocol initiated.");
      if (options.onSuccess) options.onSuccess(result, variables, context);
    },
    onError: (error, variables, context) => {
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
      // Group incidents preemptively for radar views
      const groups = {
        escalations: data.filter(i => i.severity === 'escalate'),
        monitored: data.filter(i => i.severity === 'monitor'),
        harmless: data.filter(i => i.severity === 'harmless'),
        uncertain: data.filter(i => i.severity === 'uncertain'),
        unclassified: data.filter(i => !i.severity || i.severity === 'unknown'),
      };
      return { incidents: data, ...groups };
    },
    staleTime: 10 * 1000, // 10s generic refresh cache bounds
    ...options,
  });
}
