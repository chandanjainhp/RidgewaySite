"use client";

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useReviewStore = create(
  devtools(
    persist(
      (set, get) => ({
        // State
        pendingReviews: {},
        submittedReviews: {},
        activeReviewTarget: null,
        reviewPanelOpen: false,
        briefingEditMode: false,
        reviewStats: {
          total: 0,
          reviewed: 0,
          agreed: 0,
          overridden: 0,
          flagged: 0,
        },

        // Actions
        setPendingReview: (incidentId, reviewData) => {
          const { decision, override } = reviewData;
          if (decision === 'overridden' && (!override || !override.reason)) {
            console.error("Override decision requires an override.reason string.");
            return;
          }

          set((state) => ({
            pendingReviews: {
              ...state.pendingReviews,
              [incidentId]: { ...reviewData, reviewedAt: new Date().toISOString() },
            },
          }), false, "setPendingReview");
        },

        confirmReview: (incidentId, serverResponse) => {
          const { pendingReviews, submittedReviews, reviewStats } = get();
          const targetReview = pendingReviews[incidentId];

          if (!targetReview) return; // No pending review matched

          // Calculate offset to stats
          const newStats = { ...reviewStats };
          newStats.reviewed += 1;
          if (targetReview.decision === 'agreed') newStats.agreed += 1;
          if (targetReview.decision === 'overridden') newStats.overridden += 1;
          if (targetReview.flagDetails) newStats.flagged += 1; // Assuming truthy logic binds

          // Shift memory state
          const newPending = { ...pendingReviews };
          delete newPending[incidentId];

          set({
            pendingReviews: newPending,
            submittedReviews: {
              ...submittedReviews,
              [incidentId]: { ...targetReview, serverConfirmation: serverResponse },
            },
            reviewStats: newStats,
          }, false, "confirmReview");
        },

        setActiveReviewTarget: (incidentId) =>
          set({ activeReviewTarget: incidentId, reviewPanelOpen: !!incidentId }, false, "setActiveReviewTarget"),

        openReviewPanel: () => set({ reviewPanelOpen: true }, false, "openReviewPanel"),
        
        closeReviewPanel: () => set({ reviewPanelOpen: false, activeReviewTarget: null }, false, "closeReviewPanel"),
        
        toggleBriefingEditMode: () => set((state) => ({ briefingEditMode: !state.briefingEditMode }), false, "toggleBriefingEditMode"),

        // Getters
        isReviewed: (incidentId) => {
          return !!get().submittedReviews[incidentId];
        },

        getReviewForIncident: (incidentId) => {
          const { pendingReviews, submittedReviews } = get();
          return submittedReviews[incidentId] || pendingReviews[incidentId] || null;
        },
      }),
      {
        name: 'ridgeway-review-storage', // key for localStorage persistence
        partialize: (state) => ({
          pendingReviews: state.pendingReviews,
          submittedReviews: state.submittedReviews,
          // Stats intentionally persist? Yes, Maya offline reloads should track offline completion accurately
          reviewStats: state.reviewStats 
        }),
      }
    ),
    { name: "ReviewStore" }
  )
);
