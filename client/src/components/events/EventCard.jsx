"use client";

import React, { memo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMapStore } from "@/store/mapStore";
import { useReviewStore } from "@/store/reviewStore";
import { SEVERITY_CONFIG, EVENT_TYPE_CONFIG } from "@/config/constants";
import { formatTime } from "@/lib/formatters";
import { Loader2, StickyNote, CheckCircle2 } from "lucide-react";

const EventCard = memo(({ incident }) => {
  const router = useRouter();
  const cardRef = useRef(null);

  // Cross store tracking
  const selectPin = useMapStore(state => state.selectPin);
  const selectedPinId = useMapStore(state => state.selectedPinId);
  const isReviewed = useReviewStore(state => state.isReviewed);

  // Extraction logic defaulting gracefully
  const { id, type, location, severity, timestamp, primaryEventId, raghavsNote } = incident;
  
  const isSelected = selectedPinId === primaryEventId || selectedPinId === id;
  const hasReview = isReviewed ? isReviewed(id) : false; // Safe generic fallback for future implementations

  // Configuration mapping securely against constants boundaries
  const severityData = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG['unknown'];
  const eventConfig = EVENT_TYPE_CONFIG[type] || { label: 'Unknown Alert', icon: 'activity' };

  // Sync scroll detection when Map Pins fire dynamically 
  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const handleClick = () => {
    selectPin(primaryEventId || id);
    router.push(`/incident/${id}`);
  };

  const isInvestigating = severity === "unknown";

  return (
    <motion.div
      layout 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      ref={cardRef}
      onClick={handleClick}
      className={`relative p-3 pl-4 border cursor-pointer overflow-hidden rounded-sm transition-all duration-200 group
        ${isSelected ? 'bg-surface-3 border-transparent shadow-lg shadow-black/50' : 'bg-surface-2 border-border hover:bg-surface-3/50'}`}
    >
      {/* Left colored severity band */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: severityData.color }}></div>

      {/* Shimmer animation element strictly restricted to 'investigating' unknowns */}
      {isInvestigating && (
         <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"></div>
      )}

      {/* 1. Header Information Row */}
      <div className="flex justify-between items-start w-full mb-1">
        <div className="flex items-center gap-1.5 text-text-secondary font-mono text-[10px] uppercase tracking-widest">
           {/* Mock icon lookup safely bypassing dynamic requirement */}
           <span>{eventConfig.label}</span>
        </div>
        <span className="font-mono text-text-muted text-[10px]">{formatTime(timestamp)}</span>
      </div>

      {/* 2. Primary Geographic Title Component */}
      <h4 className="text-white font-bold text-sm tracking-tight mb-3">
        {location || "Detection Zone"}
      </h4>

      {/* 3. Footer Operations Overlays */}
      <div className="flex justify-between items-end w-full">
         <div className="flex flex-col gap-2">
            
            {/* Status Overlays */}
            {isInvestigating ? (
               <div className="flex items-center gap-1.5 text-text-muted font-mono uppercase text-[10px] tracking-widest">
                 <Loader2 className="w-3 h-3 animate-spin"/> Investigating
               </div>
            ) : (
               <div className={`inline-flex w-max items-center font-mono uppercase text-[10px] tracking-widest px-2 py-0.5 border ${severityData.bgClass} ${severityData.textClass} ${severityData.borderClass}`}>
                  {severityData.label}
               </div>
            )}

            {/* Offline Intelligence Warning Overlay */}
            {raghavsNote && (
               <div className="flex items-center gap-1 text-amber-500 font-mono text-[9px] uppercase tracking-widest mt-1">
                  <StickyNote className="w-3 h-3" /> Raghav flagged
               </div>
            )}
         </div>

         {/* Verification Tag Drop-in securely referencing the isolated cache array */}
         {hasReview && (
            <div className="flex items-center gap-1 text-severity-harmless font-mono text-[9px] uppercase tracking-widest border border-severity-harmless/50 bg-severity-harmless/10 px-1.5 py-0.5">
               <CheckCircle2 className="w-3 h-3" /> Maya reviewed
            </div>
         )}
      </div>
    </motion.div>
  );
});

EventCard.displayName = "EventCard";

export default EventCard;
