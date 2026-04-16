"use client";

import { useState } from "react";
import { useReviewStore } from "@/store/reviewStore";
import { useApplyReview } from "@/hooks/useIncidents";
import { useMapStore } from "@/store/mapStore";
import { SEVERITY_CONFIG } from "@/config/constants";
import { Check, Edit3, Flag, Loader2 } from "lucide-react";
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
    // Readonly State for previously submitted reviews
    return (
      <div className={`p-4 border rounded-sm w-full font-mono text-sm uppercase tracking-widest
        ${currentReview.decision === 'agreed' ? 'bg-severity-harmless/10 border-severity-harmless text-green-400' :
          currentReview.decision === 'overridden' ? 'bg-amber-500/10 border-amber-500 text-amber-500' :
          'bg-indigo-500/10 border-indigo-500 text-indigo-400'}`}
      >
        {currentReview.decision === 'agreed' && (
          <div className="flex items-center gap-2"><Check className="w-4 h-4"/> You agreed with the agent's classification</div>
        )}
        {currentReview.decision === 'overridden' && (
          <div className="flex flex-col gap-2">
             <span className="flex items-center gap-2"><Edit3 className="w-4 h-4"/> You overridden to {currentReview.override?.newSeverity}</span>
             <span className="text-text-muted text-[10px] break-all italic">{currentReview.override?.reason}</span>
          </div>
        )}
        {currentReview.decision === 'flagged' && (
          <div className="flex flex-col gap-2">
             <span className="flex items-center gap-2"><Flag className="w-4 h-4"/> Flagged for follow-up</span>
             {currentReview.flagDetails?.note && <span className="text-text-muted text-[10px] break-all italic">{currentReview.flagDetails.note}</span>}
          </div>
        )}

        <button onClick={() => setActiveForm(null)} className="mt-4 text-[10px] text-text-muted hover:text-white underline">
           Change decision
        </button>
      </div>
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
       addFollowUpLocation({ name: incidentLocation, incidentId });
       toast.success(`Location ${incidentLocation} staged for automated sweep.`);
    }

    applyReview({ eventId: incidentId, reviewData });
    setActiveForm(null);
  };

  // --- Render ---
  return (
    <div className="w-full flex gap-4">
      
      {/* BASE ACTION ROW (if no form is active) */}
      {!activeForm && (
        <>
          <button 
            disabled={isPending}
            onClick={handleAgree}
            className="flex-1 bg-surface-2 hover:bg-severity-harmless/10 border border-severity-harmless text-green-400 py-3 rounded-sm flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />} Agree
          </button>

          <button 
            disabled={isPending}
            onClick={() => setActiveForm("override")}
            className="flex-1 bg-surface-2 hover:bg-amber-500/10 border border-amber-500 text-amber-500 py-3 rounded-sm flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            <Edit3 className="w-4 h-4" /> Override
          </button>

          <button 
            disabled={isPending}
            onClick={() => setActiveForm("flag")}
            className="flex-1 bg-surface-2 hover:bg-indigo-500/10 border border-indigo-500 text-indigo-400 py-3 rounded-sm flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            <Flag className="w-4 h-4" /> Flag for Follow-up
          </button>
        </>
      )}

      {/* OVERRIDE FORM */}
      {activeForm === "override" && (
        <div className="w-full border border-amber-500/50 bg-amber-500/5 p-5 rounded-sm">
           <h4 className="font-mono text-amber-500 text-xs font-bold uppercase mb-4 flex items-center gap-2"><Edit3 className="w-4 h-4"/> System Override Configuration</h4>
           
           <div className="flex gap-4 mb-4">
             <label className="font-mono text-[10px] text-text-muted uppercase self-center w-24">Set Severity</label>
             <select 
                value={overrideSeverity} 
                onChange={(e) => setOverrideSeverity(e.target.value)}
                className="flex-1 bg-surface-3 border border-border text-white text-sm p-2 font-mono"
             >
                <option value="harmless">Harmless (Green)</option>
                <option value="monitor">Monitor (Amber)</option>
                <option value="escalate">Escalate (Red)</option>
                <option value="uncertain">Uncertain (Indigo)</option>
             </select>
           </div>

           <div className="flex gap-4 mb-4">
             <label className="font-mono text-[10px] text-text-muted uppercase pt-2 w-24">Reason</label>
             <textarea 
               value={overrideReason}
               onChange={(e) => setOverrideReason(e.target.value)}
               placeholder="Why are you overriding the system classification? (Min 10 characters)"
               className="flex-1 bg-surface-3 border border-border text-white text-sm p-3 font-mono min-h-[80px] resize-none"
             />
           </div>

           <div className="flex justify-end gap-4 mt-6">
             <button disabled={isPending} onClick={() => setActiveForm(null)} className="text-text-muted hover:text-white font-mono text-[10px] uppercase tracking-widest px-4">Cancel</button>
             <button 
               disabled={isPending || overrideReason.length < 10} 
               onClick={handleOverrideSubmit}
               className="bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:hover:bg-amber-500 text-white font-mono text-xs font-bold tracking-widest uppercase px-6 py-2 rounded-sm flex items-center gap-2 transition-colors border border-amber-400"
             >
               {isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : null} Submit Override
             </button>
           </div>
        </div>
      )}

      {/* FLAG FORM */}
      {activeForm === "flag" && (
        <div className="w-full border border-indigo-500/50 bg-indigo-500/5 p-5 rounded-sm">
           <h4 className="font-mono text-indigo-400 text-xs font-bold uppercase mb-4 flex items-center gap-2"><Flag className="w-4 h-4"/> Schedule Automated Follow-up</h4>
           <p className="text-sm text-text-secondary mb-4 leading-relaxed tracking-wide">
             This will queue <strong className="text-indigo-400 font-mono tracking-widest">{incidentLocation || 'this location'}</strong> into the pending drone flight path for standard operating hours validation.
           </p>
           
           <div className="flex flex-col gap-2 mb-4">
             <label className="font-mono text-[10px] text-text-muted uppercase">Investigation Note (Optional)</label>
             <textarea 
               value={flagNote}
               onChange={(e) => setFlagNote(e.target.value)}
               placeholder="Context parameters for the incoming shift..."
               className="w-full bg-surface-3 border border-border text-white text-sm p-3 font-mono min-h-[80px] resize-none"
             />
           </div>

           <div className="flex justify-end gap-4 mt-6">
             <button disabled={isPending} onClick={() => setActiveForm(null)} className="text-text-muted hover:text-white font-mono text-[10px] uppercase tracking-widest px-4">Cancel</button>
             <button 
               disabled={isPending} 
               onClick={handleFlagSubmit}
               className="bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-xs font-bold tracking-widest uppercase px-6 py-2 rounded-sm flex items-center gap-2 transition-colors border border-indigo-400"
             >
               {isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : null} Add to Follow-up List
             </button>
           </div>
        </div>
      )}
    </div>
  );
}
