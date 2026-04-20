"use client";

import { Check, Edit3, Flag } from "lucide-react";

export default function ReviewReadOnlyState({ currentReview, onChangeDecision }) {
  const wrapperClass = currentReview.decision === 'agreed'
    ? 'bg-severity-harmless/10 border-severity-harmless text-green-400'
    : currentReview.decision === 'overridden'
      ? 'bg-amber-500/10 border-amber-500 text-amber-500'
      : 'bg-indigo-500/10 border-indigo-500 text-indigo-400';

  return (
    <div className={`p-4 border rounded-sm w-full font-mono text-sm uppercase tracking-widest ${wrapperClass}`}>
      {currentReview.decision === 'agreed' && (
        <div className="flex items-center gap-2"><Check className="w-4 h-4" /> You agreed with the agent's classification</div>
      )}
      {currentReview.decision === 'overridden' && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2"><Edit3 className="w-4 h-4" /> You overridden to {currentReview.override?.newSeverity}</span>
          <span className="text-text-muted text-[10px] break-all italic">{currentReview.override?.reason}</span>
        </div>
      )}
      {currentReview.decision === 'flagged' && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2"><Flag className="w-4 h-4" /> Flagged for follow-up</span>
          {currentReview.flagDetails?.note && <span className="text-text-muted text-[10px] break-all italic">{currentReview.flagDetails.note}</span>}
        </div>
      )}

      <button onClick={onChangeDecision} className="mt-4 text-[10px] text-text-muted hover:text-white underline">
        Change decision
      </button>
    </div>
  );
}
