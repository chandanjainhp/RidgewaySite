"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNightLabel } from "@/lib/formatters";
import { useInvestigationStore } from "@/store/investigationStore";
import { CheckCircle2, AlertTriangle, FileText } from "lucide-react";

export default function TopBar() {
  const [time, setTime] = useState("");
  
  // Investigation metrics mapped seamlessly via hook logic
  const jobStatus = useInvestigationStore((state) => state.jobStatus);
  const investigationStats = useInvestigationStore((state) => state.investigationStats);
  const { totalIncidents, resolvedIncidents, escalationCount } = investigationStats;

  useEffect(() => {
    // Clock handler avoiding interval drift via reliable Date extraction
    const updateTime = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full h-full flex items-center justify-between px-6 bg-surface">
      {/* 1. Left Layout Navigation & Context */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          {/* Mock simplistic Skylark drones representation */}
          <div className="w-5 h-5 rounded-sm bg-text-secondary/10 flex items-center justify-center border border-border">
            <div className="w-2 h-2 rounded-full bg-text-secondary"></div>
          </div>
          <span className="text-text-primary tracking-widest uppercase font-mono text-xs font-bold leading-none">
            RIDGEWAY SITE
          </span>
        </div>

        <nav className="flex items-center gap-4 text-xs font-mono border-l border-border pl-6">
          <Link href="/investigate" className="text-text-muted hover:text-text-primary transition-colors">
            INVESTIGATE
          </Link>
          <Link href="/briefing" className="text-text-muted hover:text-text-primary transition-colors">
            BRIEFING
          </Link>
        </nav>
      </div>

      {/* 2. Central Agent States and Notifications */}
      <div className="flex-1 flex justify-center items-center gap-6 font-mono text-xs">
        <span className="text-text-secondary">
          {formatNightLabel(new Date()) /* In production dynamic date targets exist */}
        </span>
        
        {/* Dynamic AI Hook Rendering */}
        {(jobStatus === "running" || jobStatus === "connecting") && (
          <div className="flex items-center gap-4 border border-border bg-surface-2 px-4 py-1.5 rounded-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-agent-blue opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-agent-blue"></span>
            </span>
            <span className="text-agent-blue">Agent investigating...</span>
            <span className="text-text-secondary border-l border-border pl-4">{resolvedIncidents}/{totalIncidents} INCIDENTS</span>
          </div>
        )}

        {jobStatus === "complete" && (
           <div className="flex items-center gap-3 border border-border bg-severity-harmless/10 px-4 py-1.5 rounded-sm">
             <CheckCircle2 className="w-4 h-4 text-severity-harmless" />
             <span className="text-severity-harmless">Investigation complete</span>
           </div>
        )}
        
        {/* Flag Badges */}
        {escalationCount > 0 && (
           <div className="flex items-center gap-2 border border-severity-escalate bg-severity-escalate/10 px-3 py-1.5 rounded-sm text-severity-escalate">
             <AlertTriangle className="w-3.5 h-3.5" />
             {escalationCount} ESCALATIONS
           </div>
        )}

        {/* Call to Review */}
        {jobStatus === "complete" && (
           <Link 
             href="/briefing"
             className="bg-severity-monitor text-surface px-4 py-1.5 rounded-sm font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-severity-monitor/90 transition-colors"
           >
             <FileText className="w-4 h-4" /> REVIEW BRIEFING
           </Link>
        )}
      </div>

      {/* 3. Live Edge Standard Clock Right Component */}
      <div className="flex items-center text-text-primary font-mono text-sm tracking-widest min-w-[70px] justify-end">
        {time}
      </div>
    </header>
  );
}
