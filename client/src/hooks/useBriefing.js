import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLatestBriefing, updateBriefingSection, approveBriefing } from "@/lib/api";
import { toast } from "sonner";

export function useBriefing(nightDate, options = {}) {
  return useQuery({
    queryKey: ["briefing", nightDate],
    queryFn: () => getLatestBriefing(nightDate),
    refetchInterval: (query) => {
      const data = query?.state?.data;
      if (data && data.status === 'approved') return false; 
      return 30 * 1000; // 30s refetch
    },
    select: (data) => {
      // Dynamic resolution to test if Maya can push final Briefing
      const canApprove = (data.status === 'agent_complete' || data.status === 'maya_reviewing') 
                         && data.escalationsPending === 0;
                         
      return { 
        briefing: data, 
        isApproved: data.status === 'approved', 
        canApprove 
      };
    },
    ...options
  });
}

export function useUpdateBriefingSection(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ briefingId, sectionName, content }) => 
      updateBriefingSection(briefingId, { sectionName, content }),
    
    onMutate: async ({ briefingId, sectionName, content }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["briefing"] });
      
      const previousBriefings = queryClient.getQueriesData({ queryKey: ["briefing"] });
      
      queryClient.setQueriesData({ queryKey: ["briefing"] }, (old) => {
        if (!old) return old;
        const updatedSections = [...(old.sections || [])];
        const sectionIndex = updatedSections.findIndex(s => s.name === sectionName);
        if (sectionIndex >= 0) {
          updatedSections[sectionIndex] = { ...updatedSections[sectionIndex], content };
        }
        return { ...old, sections: updatedSections };
      });

      return { previousBriefings };
    },
    onError: (err, variables, context) => {
      // Rollback
      if (context?.previousBriefings) {
        context.previousBriefings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(`Briefing update failed: ${err.message}`);
      if (options.onError) options.onError(err, variables, context);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["briefing"] });
    },
    ...options
  });
}

export function useApproveBriefing(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (briefingId) => approveBriefing(briefingId),
    onSuccess: (result, variables, context) => {
      toast.success("Briefing approved — ready for 8:00 AM review", { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["briefing"] });
      if (options.onSuccess) options.onSuccess(result, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(`Approval dispatch failed: ${error.message}`);
      if (options.onError) options.onError(error, variables, context);
    },
    ...options
  });
}
