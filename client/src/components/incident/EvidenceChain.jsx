"use client";

import { motion } from "framer-motion";
import { formatToolName } from "@/lib/formatters";
import { SEVERITY_CONFIG } from "@/config/constants";

export default function EvidenceChain({ steps, finalClassification }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="text-text-muted font-mono text-xs uppercase tracking-widest p-4 border border-border/50 border-dashed text-center">
        Evidence chain not yet available
      </div>
    );
  }

  const getConfidenceColor = (conf) => {
    switch(conf) {
      case 'high': return '#22c55e'; // Green
      case 'medium': return '#f59e0b'; // Amber
      case 'low': return '#f97316'; // Orange
      case 'uncertain': return '#6366f1'; // Indigo
      default: return '#8892a4'; // Gray
    }
  };

  return (
    <div className="flex flex-col w-full font-sans relative">
      {steps.map((stepInfo, idx) => {
        const { step, finding, source, confidence } = stepInfo;
        const clr = getConfidenceColor(confidence);
        const isUncertain = confidence === 'uncertain';

        return (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.3 }}
            className="flex w-full group relative"
          >
            {/* Thread line and Timeline node visually drawn natively via borders */}
            <div className="flex flex-col items-center mr-6">
              <div className="w-8 h-8 rounded-full border-[2px] flex items-center justify-center font-bold text-xs shrink-0 z-10 bg-surface text-white shadow-sm transition-all group-hover:scale-110" style={{ borderColor: clr }}>
                {step || idx + 1}
              </div>
              
              {/* Vertical connector natively spanning height of individual loop block */}
              <div 
                className={`w-[2px] flex-1 min-h-[30px] my-1 transition-colors ${isUncertain ? 'border-l-2 border-dashed border-border' : 'bg-border'}`}
              ></div>
            </div>
            
            {/* Content Context Block */}
            <div className="pb-8 flex-1">
              <div className="font-mono text-[10px] text-text-muted uppercase tracking-widest mb-1.5 flex items-center gap-2">
                 <span>Source: {formatToolName(source)}</span>
                 <span className="w-1 h-1 rounded-full bg-border"></span>
                 <span style={{ color: clr }}>{confidence} confidence</span>
              </div>
              <p className="text-text-primary text-sm leading-relaxed">{finding}</p>
            </div>
          </motion.div>
        );
      })}

      {/* FINAL NODE: Resolution classification anchor */}
      {finalClassification && (
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: steps.length * 0.1, duration: 0.4 }} 
           className="flex w-full relative group"
        >
           <div className="flex flex-col items-center mr-6">
             {/* Target the severity specific colors */}
             {(() => {
                const sConf = SEVERITY_CONFIG[finalClassification.severity || 'unknown'];
                return (
                  <div className="w-8 h-8 rounded-full border-[3px] flex items-center justify-center shrink-0 z-10 bg-surface shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all" style={{ borderColor: sConf.color, boxShadow: `0 0 10px ${sConf.color}40` }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sConf.color }}></div>
                  </div>
                );
             })()}
           </div>
           
           <div className="pb-4 flex-1 mt-1">
              <div className="font-mono text-[10px] text-text-muted uppercase tracking-widest mb-1.5">
                 Source: Classification
              </div>
              <p className="text-white text-base leading-relaxed tracking-tight bg-surface-3 p-4 rounded-sm border border-border inline-block">
                Assessed as <strong className="uppercase">{finalClassification.severity}</strong> with {Math.round((finalClassification.confidence||0)*100)}% confidence
              </p>
           </div>
        </motion.div>
      )}
    </div>
  );
}
