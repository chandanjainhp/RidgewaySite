"use client";

import { Edit3, Loader2 } from "lucide-react";

export default function ReviewOverrideForm({
  isPending,
  overrideSeverity,
  setOverrideSeverity,
  overrideReason,
  setOverrideReason,
  onCancel,
  onSubmit,
}) {
  return (
    <div className="w-full border border-amber-500/50 bg-amber-500/5 p-6 rounded-sm">
      <h4 className="font-mono text-amber-500 text-xs font-bold uppercase mb-4 flex items-center gap-2"><Edit3 className="w-4 h-4" /> System Override Configuration</h4>

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
          className="flex-1 bg-surface-3 border border-border text-white text-sm p-4 font-mono min-h-20 resize-none"
        />
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <button disabled={isPending} onClick={onCancel} className="text-text-muted hover:text-white font-mono text-[10px] uppercase tracking-widest px-4">Cancel</button>
        <button
          disabled={isPending || overrideReason.length < 10}
          onClick={onSubmit}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:hover:bg-amber-500 text-white font-mono text-xs font-bold tracking-widest uppercase px-6 py-2 rounded-sm flex items-center gap-2 transition-colors border border-amber-400"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Submit Override
        </button>
      </div>
    </div>
  );
}
