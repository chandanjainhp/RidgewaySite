"use client";

import { Check, Edit3, Flag, Loader2 } from "lucide-react";

export default function ReviewActionRow({ isPending, onAgree, onOverride, onFlag }) {
  return (
    <>
      <button
        disabled={isPending}
        onClick={onAgree}
        className="flex-1 bg-surface-2 hover:bg-severity-harmless/10 border border-severity-harmless text-green-400 py-3 rounded-sm flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Agree
      </button>

      <button
        disabled={isPending}
        onClick={onOverride}
        className="flex-1 bg-surface-2 hover:bg-amber-500/10 border border-amber-500 text-amber-500 py-3 rounded-sm flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
      >
        <Edit3 className="w-4 h-4" /> Override
      </button>

      <button
        disabled={isPending}
        onClick={onFlag}
        className="flex-1 bg-surface-2 hover:bg-indigo-500/10 border border-indigo-500 text-indigo-400 py-3 rounded-sm flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
      >
        <Flag className="w-4 h-4" /> Flag for Follow-up
      </button>
    </>
  );
}
