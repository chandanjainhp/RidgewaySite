"use client";

import { BrainCircuit, AlertTriangle } from "lucide-react";

export default function AgentReasoning({ reasoning, uncertainties }) {
  const hasUncertainties = uncertainties && uncertainties.length > 0;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Primary Logistical Deductions Block */}
      <div className="bg-agent-blue-dim border border-agent-blue/30 rounded-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit className="w-4 h-4 text-agent-blue" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-agent-blue">Agent Reasoning</h3>
        </div>
        <p className="text-text-primary text-[15px] leading-relaxed tracking-wide opacity-90">
          {reasoning}
        </p>
      </div>

      {/* Uncertainty Identification Matrix */}
      {hasUncertainties ? (
        <div className="border border-border/80 rounded-sm p-6 bg-surface">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-500">Uncertainties Detected</h3>
          </div>

          <ul className="flex flex-col gap-4">
             {uncertainties.map((unc, idx) => {
               const isDroneGap = unc.startsWith("Drone did not cover");
               return (
                 <li key={idx} className="flex items-start gap-4">
                   <div className="w-[6px] h-[6px] rounded-full bg-indigo-500 mt-2 shrink-0"></div>
                   <span className={`text-sm leading-relaxed ${isDroneGap ? 'text-amber-500 font-medium' : 'text-text-secondary'}`}>
                     {unc}
                   </span>
                 </li>
               );
             })}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 border border-green-500/30 bg-green-500/10 px-4 py-3 rounded-sm w-max">
           <div className="w-2 h-2 rounded-full bg-green-500"></div>
           <span className="font-mono text-[10px] text-green-500 uppercase tracking-widest">No uncertainties — high confidence classification</span>
        </div>
      )}
    </div>
  );
}
