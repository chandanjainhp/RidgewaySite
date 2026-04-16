"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import BriefingDocument from "@/components/briefing/BriefingDocument";
import ApproveButton from "@/components/briefing/ApproveButton";
import { useBriefing } from "@/hooks/useBriefing";
import { useProgressPercent } from "@/store/investigationStore";
import { formatNightLabel } from "@/lib/formatters";

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState("normal"); // 'normal' | 'warn' | 'urgent'

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(8, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);

      const diff = Math.max(0, target - now);
      const totalMins = Math.floor(diff / 60000);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const s = Math.floor((diff % 60000) / 1000);

      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
      setUrgency(totalMins < 30 ? "urgent" : totalMins < 60 ? "warn" : "normal");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { timeLeft, urgency };
}

export default function BriefingPage() {
  const nightDate = new Date().toISOString().split("T")[0];
  const { data, isLoading } = useBriefing(nightDate);
  const progressPercent = useProgressPercent();
  const { timeLeft, urgency } = useCountdown();

  const briefing = data?.briefing || null;
  const isApproved = data?.isApproved || false;
  const canApprove = data?.canApprove || false;

  const urgencyClass = {
    normal: "text-text-secondary",
    warn: "text-severity-monitor",
    urgent: "text-severity-escalate animate-pulse",
  }[urgency];

  const renderStatusBanner = () => {
    if (!briefing) return null;
    const status = briefing.status;

    if (status === "approved") {
      return (
        <div className="w-full px-6 py-3 bg-severity-harmless/10 border-b border-severity-harmless/40 font-mono text-xs text-green-400 uppercase tracking-widest flex items-center gap-2 print:hidden">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          Briefing approved ✓ — ready for 8:00 AM
        </div>
      );
    }
    if (status === "maya_reviewing") {
      return (
        <div className="w-full px-6 py-3 bg-severity-monitor/10 border-b border-severity-monitor/40 font-mono text-xs text-amber-400 uppercase tracking-widest flex items-center gap-2 print:hidden">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          In review — confirm each section before approving
        </div>
      );
    }
    if (status === "agent_complete") {
      return (
        <div className="w-full px-6 py-3 bg-agent-blue/10 border-b border-agent-blue/40 font-mono text-xs text-agent-blue uppercase tracking-widest flex items-center gap-2 print:hidden">
          <span className="w-2 h-2 rounded-full bg-agent-blue"></span>
          Agent has drafted the briefing — review each section below
        </div>
      );
    }
    return null;
  };

  // Waiting state — investigation not yet complete
  if (!isLoading && briefing?.status === "draft") {
    return (
      <AppShell variant="briefing">
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center h-full gap-8 px-8">
          <div className="text-center">
            <h2 className="text-white text-2xl font-bold mb-2">Agent is completing the investigation...</h2>
            <p className="text-text-secondary text-sm">The briefing will appear once all incidents have been classified.</p>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-2 border border-border overflow-hidden">
            <div
              className="h-full bg-agent-blue transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <span className="font-mono text-agent-blue text-sm">{Math.round(progressPercent)}% complete</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell variant="briefing">
      <div className="w-full h-full flex flex-col">
        {renderStatusBanner()}

        {/* Document Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border shrink-0 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Morning Briefing</h1>
            <p className="font-mono text-xs text-text-secondary mt-1 uppercase tracking-widest">{formatNightLabel(new Date())}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className={`font-mono text-lg font-bold ${urgencyClass}`}>{timeLeft}</div>
              <div className="font-mono text-[10px] text-text-muted uppercase tracking-widest">until 08:00</div>
            </div>
            <ApproveButton
              briefingId={briefing?.id}
              canApprove={canApprove}
              isApproved={isApproved}
              approvedAt={briefing?.approvedAt}
            />
          </div>
        </div>

        {/* Document Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <BriefingDocument briefing={null} />
          ) : (
            <BriefingDocument briefing={briefing} isApproved={isApproved} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
