"use client";

export default function StatusBar({
  jobStatus,
  resolvedIncidents,
  totalIncidents,
  escalationCount,
  diagnosticMessage,
  onReviewBriefing,
}) {
  const progressPercent =
    totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0;

  return (
    <div className="h-11 shrink-0 flex items-center justify-between px-4 md:px-6 border-b bg-surface-2 border-border">
      <div className="flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider">
        {diagnosticMessage && (
          <span className="text-severity-monitor">Data warning: {diagnosticMessage}</span>
        )}

        {!diagnosticMessage && (
          <>
        {jobStatus === "connecting" && (
          <span className="w-2 h-2 rounded-full bg-agent-blue inline-block dot-pulse" />
        )}
        {jobStatus === "idle" && <span className="text-text-muted">Checking for overnight events</span>}
        {jobStatus === "connecting" && <span className="text-text-muted">Connecting to agent</span>}
        {jobStatus === "running" && (
          <>
            <span className="text-agent-blue">
              {resolvedIncidents}/{totalIncidents} incidents resolved
            </span>
            <span className="text-border">({progressPercent}%)</span>
          </>
        )}
        {jobStatus === "complete" && <span className="text-severity-harmless">Investigation complete</span>}
        {jobStatus === "failed" && <span className="text-severity-escalate">Investigation error</span>}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {jobStatus === "complete" && (
          <button
            onClick={onReviewBriefing}
            className="font-mono bg-text-primary text-surface text-[10px] sm:text-[11px] font-semibold px-4 py-1.5 rounded-full uppercase tracking-wider hover:bg-text-secondary transition-colors"
          >
            Review Briefing
          </button>
        )}

        {escalationCount > 0 && (
          <span
            className="font-mono text-[10px] bg-severity-escalate/15 border border-severity-escalate/45 text-severity-escalate px-2 py-1 rounded tracking-[0.08em]"
          >
            {escalationCount} {escalationCount > 1 ? "ESCALATIONS" : "ESCALATION"}
          </span>
        )}
      </div>
    </div>
  );
}
