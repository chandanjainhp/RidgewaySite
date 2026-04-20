"use client";

import React, { memo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMapStore } from "@/store/mapStore";
import { useReviewStore } from "@/store/reviewStore";
import { SEVERITY_CONFIG } from "@/config/constants";
import { formatNightLabel, formatTime } from "@/lib/formatters";
import { CheckCircle2 } from "lucide-react";

const EventCard = memo(({ incident }) => {
  const router = useRouter();
  const cardRef = useRef(null);

  // Cross store tracking
  const selectPin = useMapStore(state => state.selectPin);
  const selectedPinId = useMapStore(state => state.selectedPinId);
  const isReviewed = useReviewStore(state => state.isReviewed);

  // Correct field extraction from incident object
  const incidentId = incident?._id || incident?.id || incident?.incidentId;
  const correlationType = incident.correlationType;
  const primaryLocation = incident.primaryLocation || incident.location;
  const severity = incident.finalSeverity || incident.agentClassification?.severity || incident.severity || 'unknown';
  const nightDate = incident.nightDate;
  const raghavsNote = incident.raghavsNote;

  const isSelected = selectedPinId === incidentId;
  const hasReview = isReviewed ? isReviewed(incidentId) : false;

  // Type labels mapping from correlationType
  const typeLabels = {
    spatial: 'SPATIAL CLUSTER',
    temporal: 'TEMPORAL PATTERN',
    entity: 'ENTITY MATCH',
    cross_type: 'MULTI SIGNAL',
  };
  const typeLabel = typeLabels[correlationType] || 'INCIDENT';

  // Configuration mapping
  const severityData = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG['unknown'];

  // Sync scroll detection when Map Pins fire dynamically
  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const handleClick = () => {
    selectPin(incidentId);
    router.push(`/incident/${incidentId}`);
  };

  const locationLabel = primaryLocation?.name || incident.title || 'Unknown Location';
  const timeLabel = nightDate
    ? formatNightLabel(nightDate)
    : incident?.firstEventTime
    ? formatTime(incident.firstEventTime)
    : "Night";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      ref={cardRef}
      onClick={handleClick}
      className={`p-4 rounded-md border border-border border-l-[3px] cursor-pointer mb-2 ${
        isSelected ? 'bg-surface-3' : 'bg-surface-2'
      } ${severityData.borderClass}`}
    >
      {/* Header: Type and Date */}
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] text-text-muted font-mono tracking-[0.05em]">
          {typeLabel}
        </span>
        <span className="text-[10px] text-text-muted font-mono">
          {timeLabel}
        </span>
      </div>

      {/* Primary Location Title */}
      <div className="text-[13px] font-medium text-text-primary mb-2">
        {locationLabel}
      </div>

      {/* Footer: Severity badge and indicators */}
      <div className="flex items-center justify-between">
        <div className={`text-[10px] font-mono px-2 py-1 rounded uppercase font-semibold tracking-[0.05em] border ${severityData.bgClass} ${severityData.textClass} ${severityData.borderClass}`}>
          {severityData.label}
        </div>

        <div className="flex gap-2 items-center">
          {raghavsNote && (
            <span className="text-[10px] text-severity-monitor font-mono uppercase font-semibold">
              RAGHAV FLAGGED
            </span>
          )}

          {hasReview && (
            <div className="flex items-center gap-1 text-[9px] text-severity-harmless font-mono uppercase font-semibold border border-severity-harmless/50 bg-severity-harmless/10 px-2 py-1 rounded">
              <CheckCircle2 className="w-3 h-3" /> Reviewed
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

EventCard.displayName = "EventCard";

export default EventCard;
