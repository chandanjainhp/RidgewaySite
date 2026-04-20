import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLatestBriefing, updateBriefingSection, approveBriefing } from "@/lib/api";
import { toast } from "sonner";

const normalizeBriefing = (data) => {
  if (!data) {
    return null;
  }

  return data;
};

export function useBriefing(nightDate, options = {}) {
  return useQuery({
    queryKey: ["briefing", nightDate],
    queryFn: () => getLatestBriefing(nightDate),
    refetchInterval: (query) => {
      const data = query?.state?.data;
      if (data?.briefing?.status === 'approved') return false;
      return 30 * 1000; // 30s refetch
    },
    select: (data) => {
      const briefing = normalizeBriefing(data);
      if (!briefing) {
        return { briefing: null, isApproved: false, canApprove: false };
      }

      // Dynamic resolution to test if Maya can push final Briefing
      const canApprove =
        briefing.status === "maya_reviewing" ||
        briefing.status === "pending_review";

      return {
        briefing,
        isApproved: briefing.status === 'approved',
        canApprove
      };
    },
    retry: (failureCount, error) => {
      // Do not retry auth failures; session will be refreshed or redirected by interceptor.
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        return false;
      }

      // Retry transient network errors.
      if (!error?.statusCode) {
        return failureCount < 3;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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
        return {
          ...old,
          briefing: {
            ...old.briefing,
            sections: {
              ...old.briefing?.sections,
              [sectionName]: {
                ...(old.briefing?.sections?.[sectionName] || {}),
                mayaVersion: content,
                isEdited: true,
              },
            },
          },
        };
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
