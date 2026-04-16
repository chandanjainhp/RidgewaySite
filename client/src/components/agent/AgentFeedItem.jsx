"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";
import { Wrench, CheckCircle2, AlertTriangle, ShieldX } from "lucide-react";
import { formatToolName, truncateText, formatTimeWithSeconds } from "@/lib/formatters";
import { SEVERITY_CONFIG } from "@/config/constants";

// The component requires memo to gracefully duck React DOM updates since lists grow endlessly over large timespans.
const AgentFeedItem = memo(({ item }) => {
  const { type, data, timestamp } = item;
  const timeStr = formatTimeWithSeconds(timestamp);

  // Extract variables locally
  let ContentComponent;
  let accentClass = "border-transparent";

  if (type === "tool_called") {
    accentClass = "border-agent-blue";
    ContentComponent = (
      <>
        <div className="flex gap-3">
          <Wrench className="w-4 h-4 text-agent-blue mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="text-text-primary text-sm block">{formatToolName(data?.toolName)}</span>
            <span className="text-text-secondary text-xs block mt-0.5">Tool called</span>
          </div>
          <span className="text-text-muted font-mono text-[10px] shrink-0 mt-0.5">{timeStr}</span>
        </div>
      </>
    );
  } else if (type === "tool_result") {
    accentClass = "border-agent-blue-dim";
    ContentComponent = (
      <div className="flex gap-3 pl-4 opacity-90">
        <CheckCircle2 className="w-4 h-4 text-agent-blue-dim mt-0.5 shrink-0" />
        <div className="flex-1">
          <span className="text-text-primary text-sm block">{truncateText(item.summary, 80)}</span>
        </div>
        <span className="text-text-muted font-mono text-[10px] shrink-0 mt-0.5">{timeStr}</span>
      </div>
    );
  } else if (type === "reasoning") {
    ContentComponent = (
      <div className="flex gap-3 pl-4">
        <div className="flex-1 text-text-secondary italic text-xs leading-relaxed border-l-2 border-border pl-3 ml-2">
          {item.summary}
        </div>
      </div>
    );
  } else if (type === "classification") {
    // Determine dynamic severity overrides
    const severityConfig = SEVERITY_CONFIG[data?.severity] || SEVERITY_CONFIG["unknown"];
    accentClass = `border-[${severityConfig.color}]`;

    ContentComponent = (
      <div className="flex gap-3 mt-2 bg-surface-3 border border-border p-3 rounded-sm relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1 h-full ${severityConfig.bgClass}`}></div>
        <div className="pl-2 w-full flex-1">
          <div className="flex justify-between items-start mb-2">
             <div className="flex items-center gap-2">
                <ShieldX className={`w-4 h-4 ${severityConfig.textClass}`} strokeWidth={2.5}/>
                <span className={`text-xs uppercase font-bold tracking-widest font-mono ${severityConfig.textClass}`}>Classified: {severityConfig.label}</span>
             </div>
             <span className="text-text-muted font-mono text-[10px] shrink-0">{timeStr}</span>
          </div>
          <span className="text-text-secondary text-xs block italic mt-1 leading-snug">
            {truncateText(data?.reasoning || item.summary, 100)}
          </span>
        </div>
      </div>
    );
  } else if (type === "error") {
     accentClass = "border-severity-escalate";
     ContentComponent = (
       <div className="flex gap-3 text-severity-escalate bg-severity-escalate/10 p-2 border border-severity-escalate/30 rounded-sm">
         <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
         <div className="flex-1 text-xs">
           <span className="font-bold uppercase tracking-wider block mb-1">Runtime Fault</span>
           {item.summary}
         </div>
       </div>
     );
  } else {
    // Default system trace fallback logic
    ContentComponent = (
      <div className="text-text-muted text-[10px] font-mono tracking-widest">[{item.type}] - {truncateText(item.summary, 50)}</div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`border-l-2 pl-3 py-1 ${accentClass} relative`}
    >
      {ContentComponent}
    </motion.div>
  );
});

AgentFeedItem.displayName = "AgentFeedItem";

export default AgentFeedItem;
