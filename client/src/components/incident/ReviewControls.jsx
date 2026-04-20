"use client";

import { useState } from "react";
import { useReviewStore } from "@/store/reviewStore";
import { useApplyReview } from "@/hooks/useIncidents";
import { useMapStore } from "@/store/mapStore";
import ReviewReadOnlyState from "@/components/incident/ReviewReadOnlyState";
import ReviewActionRow from "@/components/incident/ReviewActionRow";
import ReviewOverrideForm from "@/components/incident/ReviewOverrideForm";
import ReviewFlagForm from "@/components/incident/ReviewFlagForm";
import { toast } from "sonner";

export default function ReviewControls({ incidentId, agentClassification, incidentLocation }) {
  const [activeForm, setActiveForm] = useState(null); // 'override' | 'flag' | null

  // Storage Hooks
  const getReviewForIncident = useReviewStore(state => state.getReviewForIncident);
  const setPendingReview = useReviewStore(state => state.setPendingReview);
  const addFollowUpLocation = useMapStore(state => state.addFollowUpLocation);

  // Mutation Hooks
  const { mutate: applyReview, isPending } = useApplyReview();

  // Load existing decisions
  const currentReview = getReviewForIncident(incidentId);

  // Form State
  const [overrideSeverity, setOverrideSeverity] = useState("monitor");
  const [overrideReason, setOverrideReason] = useState("");
  const [flagNote, setFlagNote] = useState("");

  if (currentReview && currentReview.serverConfirmation) {
    return (
      <ReviewReadOnlyState
        currentReview={currentReview}
        onChangeDecision={() => setActiveForm(null)}
      />
    );
  }

  // --- Handlers ---
  const handleAgree = () => {
    // Stage securely to memory
    const reviewData = { decision: "agreed", flagDetails: null, override: null };
    setPendingReview(incidentId, reviewData);

    // Dispatch
    applyReview({ eventId: incidentId, reviewData });
  };

  const handleOverrideSubmit = () => {
    if (overrideReason.length < 10) return;

    const reviewData = {
      decision: "overridden",
      override: { newSeverity: overrideSeverity, reason: overrideReason },
      flagDetails: null
    };

    setPendingReview(incidentId, reviewData);
    applyReview({ eventId: incidentId, reviewData });
    setActiveForm(null);
  };

  const handleFlagSubmit = () => {
    const reviewData = {
      decision: "flagged",
      override: null,
      flagDetails: { note: flagNote }
    };

    setPendingReview(incidentId, reviewData);

    // Cross-wire map drone state immediately so Maya visualizes her decision
    if (incidentLocation) {
       const locationName = typeof incidentLocation === 'string' ? incidentLocation : incidentLocation?.name || 'Unknown Location';
       addFollowUpLocation({ name: locationName, incidentId });
       toast.success(`Location ${locationName} staged for automated sweep.`);
    }

    applyReview({ eventId: incidentId, reviewData });
    setActiveForm(null);
  };

  // --- Render ---
  return (
    <div className="w-full flex gap-4">
      {!activeForm && (
        <ReviewActionRow
          isPending={isPending}
          onAgree={handleAgree}
          onOverride={() => setActiveForm("override")}
          onFlag={() => setActiveForm("flag")}
        />
      )}

      {activeForm === "override" && (
        <ReviewOverrideForm
          isPending={isPending}
          overrideSeverity={overrideSeverity}
          setOverrideSeverity={setOverrideSeverity}
          overrideReason={overrideReason}
          setOverrideReason={setOverrideReason}
          onCancel={() => setActiveForm(null)}
          onSubmit={handleOverrideSubmit}
        />
      )}

      {activeForm === "flag" && (
        <ReviewFlagForm
          isPending={isPending}
          incidentLocation={incidentLocation}
          flagNote={flagNote}
          setFlagNote={setFlagNote}
          onCancel={() => setActiveForm(null)}
          onSubmit={handleFlagSubmit}
        />
      )}
    </div>
  );
}
