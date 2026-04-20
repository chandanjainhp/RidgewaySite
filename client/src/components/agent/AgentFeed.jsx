"use client";

import React, { useEffect, useRef } from "react";
import { useInvestigationStore } from "@/store/investigationStore";
import AgentFeedItem from "./AgentFeedItem";
import AgentStatusBadge from "./AgentStatusBadge";

export default function AgentFeed() {
  const feedItems = useInvestigationStore((state) => state.feedItems);
  const jobStatus = useInvestigationStore((state) => state.jobStatus);
  const investigationStats = useInvestigationStore((state) => state.investigationStats);
  const errorMsg = useInvestigationStore((state) => state.error);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) {
      return;
    }

    const distanceFromBottom =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;

    if (distanceFromBottom <= 50) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [feedItems.length]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-2">
      <div className="h-12 px-4 md:px-5 shrink-0 flex items-center justify-between border-b border-border">
        <h3 className="font-display text-[11px] uppercase tracking-[0.12em] text-text-secondary">
          AGENT ACTIVITY
        </h3>
        <AgentStatusBadge jobStatus={jobStatus} />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-1"
      >
        {jobStatus === "complete" && (
          <div
            className="mb-2 px-4 py-2 rounded-md border font-mono bg-severity-harmless/10 border-severity-harmless/30 text-severity-harmless text-[11px] tracking-[0.08em]"
          >
            INVESTIGATION COMPLETE
          </div>
        )}

        {jobStatus === "idle" && feedItems.length === 0 && (
          <div className="text-center mt-10 font-mono uppercase text-[10px] text-text-muted tracking-wider">
            WAITING FOR INVESTIGATION TO START
          </div>
        )}

        {jobStatus === "connecting" && (
          <div className="text-center mt-10 font-mono uppercase flex items-center justify-center gap-1 text-[10px] text-text-muted tracking-wider">
            CONNECTING
            <span className="dot-pulse">.</span>
            <span className="dot-pulse [animation-delay:0.2s]">.</span>
            <span className="dot-pulse [animation-delay:0.4s]">.</span>
          </div>
        )}

        {jobStatus === "running" && feedItems.length === 0 && (
          <div className="text-center mt-10 font-mono uppercase text-[10px] text-text-muted tracking-wider">
            AGENT IS GATHERING CONTEXT
          </div>
        )}

        {feedItems.map((item) => (
          <AgentFeedItem key={item.id} item={item} />
        ))}

        {jobStatus === "failed" && (
          <div className="mt-2 border border-severity-escalate bg-severity-escalate/10 rounded-sm p-4 text-center">
            <span className="font-mono text-severity-escalate text-xs uppercase font-bold">
              {errorMsg || "Unhandled Agent Exception"}
            </span>
          </div>
        )}

        {jobStatus === "complete" && (
          <div className="font-mono text-xs text-text-primary mt-2 tracking-[0.04em]">
            {investigationStats?.resolvedIncidents || 0} incidents classified
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
