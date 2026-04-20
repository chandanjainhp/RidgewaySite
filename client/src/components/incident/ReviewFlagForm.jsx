"use client";

import { Flag, Loader2 } from "lucide-react";

export default function ReviewFlagForm({
  isPending,
  incidentLocation,
  flagNote,
  setFlagNote,
  onCancel,
  onSubmit,
}) {
  const locationName = typeof incidentLocation === 'string'
    ? incidentLocation
    : incidentLocation?.name || 'this location';

  return (
    <div className="w-full border border-indigo-500/50 bg-indigo-500/5 p-6 rounded-sm">
      <h4 className="font-mono text-indigo-400 text-xs font-bold uppercase mb-4 flex items-center gap-2"><Flag className="w-4 h-4" /> Schedule Automated Follow-up</h4>
      <p className="text-sm text-text-secondary mb-4 leading-relaxed tracking-wide">
        This will queue <strong className="text-indigo-400 font-mono tracking-widest">{locationName}</strong> into the pending drone flight path for standard operating hours validation.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        <label className="font-mono text-[10px] text-text-muted uppercase">Investigation Note (Optional)</label>
        <textarea
          value={flagNote}
          onChange={(e) => setFlagNote(e.target.value)}
          placeholder="Context parameters for the incoming shift..."
          className="w-full bg-surface-3 border border-border text-white text-sm p-4 font-mono min-h-20 resize-none"
        />
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <button disabled={isPending} onClick={onCancel} className="text-text-muted hover:text-white font-mono text-[10px] uppercase tracking-widest px-4">Cancel</button>
        <button
          disabled={isPending}
          onClick={onSubmit}
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-xs font-bold tracking-widest uppercase px-6 py-2 rounded-sm flex items-center gap-2 transition-colors border border-indigo-400"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add to Follow-up List
        </button>
      </div>
    </div>
  );
}
