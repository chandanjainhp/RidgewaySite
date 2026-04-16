"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInvestigationStore } from "@/store/investigationStore";
import AgentFeedItem from "./AgentFeedItem";

export default function AgentFeed() {
  const feedItems = useInvestigationStore((state) => state.feedItems);
  const jobStatus = useInvestigationStore((state) => state.jobStatus);
  const investigationStats = useInvestigationStore((state) => state.investigationStats);
  const errorMsg = useInvestigationStore((state) => state.error);

  const scrollRef = useRef(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  // Scroll handler detaches auto-lock if user explores back in time
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // 20px threshold margin
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setIsAutoScrolling(isAtBottom);
  };

  useEffect(() => {
    if (isAutoScrolling && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feedItems, isAutoScrolling]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Feed Header */}
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <h3 className="font-mono text-sm text-text-primary uppercase tracking-widest font-bold">AGENT ACTIVITY</h3>
        
        {/* Dynamic Mock of AgentStatusBadge */}
        {jobStatus === "running" && <div className="w-2 h-2 rounded-full bg-agent-blue animate-pulse"></div>}
        {jobStatus === "complete" && <div className="w-2 h-2 rounded-full bg-severity-harmless"></div>}
      </div>

      {/* Feed Scroll Container */}
      <div 
        ref={scrollRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scroll-smooth"
      >
        {/* State Empty Displays */}
        {jobStatus === "idle" && feedItems.length === 0 && (
          <div className="text-center p-8 text-text-muted font-mono text-xs uppercase opacity-70">
            Waiting for investigation<br/>to start...
          </div>
        )}

        {jobStatus === "connecting" && (
          <div className="text-center p-8 text-agent-blue font-mono text-xs uppercase animate-pulse">
            Connecting to agent...
          </div>
        )}

        {jobStatus === "running" && feedItems.length === 0 && (
          <div className="text-center p-8 text-agent-blue font-mono text-xs uppercase pb-4">
            Agent is gathering context<span className="animate-pulse">...</span>
          </div>
        )}
        
        {/* Live List Stream */}
        {feedItems.map((item) => (
          <AgentFeedItem key={item.id} item={item} />
        ))}

        {/* State Overlays */}
        {jobStatus === "complete" && (
          <div className="mt-4 border border-severity-harmless/50 bg-severity-harmless/10 rounded-sm p-4 text-center">
            <span className="font-mono text-severity-harmless text-xs block uppercase">Investigation complete</span>
            <span className="font-mono text-text-primary text-xs block mt-1">{investigationStats?.resolvedIncidents || 0} incidents classified</span>
          </div>
        )}

        {jobStatus === "failed" && (
          <div className="mt-4 border border-severity-escalate bg-severity-escalate/10 rounded-sm p-4 text-center">
             <span className="font-mono text-severity-escalate text-xs uppercase font-bold">{errorMsg || "Unhandled Agent Exception"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
