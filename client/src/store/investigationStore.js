"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { formatAgentFeedSummary } from "@/lib/formatters"; // Extrapolating the dependency from standard structure

/**
 * Utility for generating lightweight IDs for the feed.
 */
const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Initial state object for reset capability
const initialState = {
  jobId: null,
  jobStatus: "idle", // 'idle' | 'connecting' | 'running' | 'complete' | 'failed'
  
  feedItems: [],
  classifiedIncidents: {},
  
  investigationStats: {
    totalIncidents: 0,
    resolvedIncidents: 0,
    escalationCount: 0,
    overallConfidence: null,
  },
  
  error: null,
  connectedAt: null,
};

export const useInvestigationStore = create(
  devtools(
    (set, get) => ({
      ...initialState,

      setJobId: (jobId) => set({ jobId }, false, "setJobId"),
      
      setJobStatus: (status) => set({ 
        jobStatus: status,
        connectedAt: status === "connecting" || status === "running" ? new Date() : get().connectedAt 
      }, false, "setJobStatus"),

      addFeedItem: (progressEvent) =>
        set((state) => {
          const newItem = {
            id: generateId(),
            type: progressEvent.type,
            timestamp: progressEvent.timestamp || new Date().toISOString(),
            // Summary parsing hook defined previously, can be applied here or at the component level.
            summary: formatAgentFeedSummary(progressEvent) || progressEvent.summary,
            data: progressEvent.payload || progressEvent.data || progressEvent,
            isNew: true,
          };

          const newFeedItems = [...state.feedItems, newItem];

          // Memory Management -> trim up to 150 items remaining after passing 200 elements.
          if (newFeedItems.length > 200) {
            newFeedItems.splice(0, 50);
          }

          return { feedItems: newFeedItems };
        }, false, "addFeedItem"),

      markFeedItemRead: (itemId) =>
        set((state) => ({
          feedItems: state.feedItems.map((item) =>
            item.id === itemId ? { ...item, isNew: false } : item
          ),
        }), false, "markFeedItemRead"),

      addClassification: (incidentId, classificationData) =>
        set((state) => {
          const { severity, confidence, reasoning } = classificationData;
          const isEscalation = severity === "escalate";

          return {
            classifiedIncidents: {
              ...state.classifiedIncidents,
              [incidentId]: {
                severity,
                confidence,
                reasoning,
                classifiedAt: new Date().toISOString(),
              },
            },
            investigationStats: {
              ...state.investigationStats,
              resolvedIncidents: state.investigationStats.resolvedIncidents + 1,
              escalationCount: state.investigationStats.escalationCount + (isEscalation ? 1 : 0),
            },
          };
        }, false, "addClassification"),

      setInvestigationStats: (stats) =>
        set((state) => ({
          investigationStats: { ...state.investigationStats, ...stats },
        }), false, "setInvestigationStats"),

      updateProgress: (resolved, total) =>
        set((state) => ({
          investigationStats: {
            ...state.investigationStats,
            resolvedIncidents: resolved,
            totalIncidents: total,
          },
        }), false, "updateProgress"),

      setError: (error) => set({ error }, false, "setError"),

      resetStore: () => set(initialState, false, "resetStore"),
    }),
    { name: "InvestigationStore" }
  )
);

// Derived Selectors
export const useIsInvestigating = () => 
  useInvestigationStore((state) => state.jobStatus === "running" || state.jobStatus === "connecting");

export const useProgressPercent = () => 
  useInvestigationStore((state) => {
    const { resolvedIncidents, totalIncidents } = state.investigationStats;
    if (totalIncidents === 0) return 0;
    return (resolvedIncidents / totalIncidents) * 100;
  });

export const useEscalationCount = () => 
  useInvestigationStore((state) => state.investigationStats.escalationCount);

export const useNewFeedCount = () => 
  useInvestigationStore((state) => state.feedItems.filter((i) => i.isNew).length);
