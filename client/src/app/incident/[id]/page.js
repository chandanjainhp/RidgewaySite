"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useIncidentById, useIncidentEvidenceGraph } from "@/hooks/useIncidents";
import { SEVERITY_CONFIG } from "@/config/constants";
import AppShell from "@/components/layout/AppShell";
import EvidenceChain from "@/components/incident/EvidenceChain";
import AgentReasoning from "@/components/incident/AgentReasoning";
import ReviewControls from "@/components/incident/ReviewControls";
// Assuming dynamic resolution for mapping component to dodge SSR window errors
import dynamic from "next/dynamic";
const IncidentMiniMap = dynamic(() => import("@/components/incident/IncidentMiniMap"), { ssr: false, loading: () => <div className="h-64 bg-surface-3 animate-pulse border border-border w-full flex items-center justify-center font-mono text-xs text-text-muted">Loading Map...</div> });

export default function IncidentDetailView({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;

  const { data: incidentResponse, isLoading: isLoadingIncident } = useIncidentById(id);
  const { data: evidenceGraphResponse, isLoading: isLoadingGraph } = useIncidentEvidenceGraph(id);

  if (isLoadingIncident || isLoadingGraph) {
    return (
      <AppShell variant="detail">
        <div className="flex-1 p-8 animate-pulse flex flex-col gap-6">
          <div className="h-4 w-32 bg-surface-3 rounded-sm"></div>
          <div className="h-10 w-96 bg-surface-3 rounded-sm mt-4"></div>
          <div className="h-6 w-48 bg-surface-3 rounded-sm"></div>
          <div className="flex-1 bg-surface-3 mt-8 rounded-sm"></div>
        </div>
        <div className="w-95 p-6 border-l border-border bg-surface-2 animate-pulse flex flex-col gap-6">
          <div className="h-64 bg-surface-3 rounded-sm"></div>
          <div className="flex-1 bg-surface-3 rounded-sm"></div>
        </div>
      </AppShell>
    );
  }

  const incident = incidentResponse?.data || incidentResponse || {};
  const evidenceGraph = evidenceGraphResponse?.data || evidenceGraphResponse || {};

  // Safe extraction of nested structures from standard API layouts
  const title = incident.title || incident.description || "Unidentified Alert Sequence";
  const severity = incident.finalClassification?.severity || incident.severity || "unknown";
  const severityData = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.unknown;

  const classification =
    incident.finalClassification || evidenceGraph.classification || {};
  const confidencePercent = Math.round((classification.confidence || 0) * 100);
  const confidenceWidthClass =
    confidencePercent <= 0 ? 'w-0' :
    confidencePercent <= 10 ? 'w-[10%]' :
    confidencePercent <= 20 ? 'w-[20%]' :
    confidencePercent <= 30 ? 'w-[30%]' :
    confidencePercent <= 40 ? 'w-[40%]' :
    confidencePercent <= 50 ? 'w-1/2' :
    confidencePercent <= 60 ? 'w-[60%]' :
    confidencePercent <= 70 ? 'w-[70%]' :
    confidencePercent <= 80 ? 'w-[80%]' :
    confidencePercent <= 90 ? 'w-[90%]' :
    'w-full';

  return (
    <AppShell variant="detail">
      {/* 1. Main Logical Thread & Context Analysis */}
      <div className="flex-1 p-8 overflow-y-auto flex flex-col items-start w-full">
        <Link
          href="/investigate"
          className="text-text-muted hover:text-white transition-colors flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest mb-8"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Investigation
        </Link>

        {incident.raghavsNote && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/50 text-amber-500 px-4 py-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest w-full">
            <AlertTriangle className="w-4 h-4" /> Raghav flagged this area
          </div>
        )}

        <h1 className="text-2xl font-bold text-white mb-4 leading-tight">
          {title}
        </h1>

        <div className="flex items-center gap-6 mb-12 w-full">
          <span className={`px-3 py-1 text-xs font-mono uppercase tracking-widest ${severityData.bgClass} ${severityData.textClass} border ${severityData.borderClass}`}>
            {severityData.label}
          </span>
          <div className="flex items-center gap-4 bg-surface-2 px-4 py-1 border border-border">
            <span className="font-mono text-xs text-text-muted uppercase tracking-widest">Confidence</span>
            <div className="h-1.5 w-24 bg-surface rounded-sm relative overflow-hidden">
              <div className={`absolute top-0 left-0 h-full ${confidencePercent > 80 ? 'bg-green-500' : 'bg-amber-500'} ${confidenceWidthClass}`}></div>
            </div>
            <span className="font-mono text-xs text-white">{confidencePercent}%</span>
          </div>
        </div>

        {/* Evidence Chain Flow */}
        <section className="w-full mb-12">
          <h3 className="font-mono text-sm text-white uppercase tracking-widest border-b border-border/50 pb-2 mb-6">Evidence Chain</h3>
          <EvidenceChain steps={evidenceGraph.steps || []} finalClassification={classification} />
        </section>

        {/* Generative Explanations */}
        <section className="w-full mb-12">
           <AgentReasoning
             reasoning={classification.reasoning || "No reasoning attached by agent."}
             uncertainties={classification.uncertainties || []}
           />
        </section>

        {/* Operational Guard Rails */}
        <section className="w-full">
           <ReviewControls
             incidentId={id}
             agentClassification={classification}
             incidentLocation={incident.primaryLocation || incident.location}
           />
        </section>
      </div>

      {/* 2. Map and Entity Context Window */}
      <div className="w-95 h-full border-l border-border bg-surface-2 flex flex-col p-6 overflow-y-auto shrink-0">
        <IncidentMiniMap
          incidentId={id}
          location={incident.primaryLocation || incident.location}
        />

        <div className="mt-6 flex flex-col gap-6 w-full">
           <div className="bg-surface rounded-sm border border-border p-4">
              <h4 className="font-mono text-xs text-text-secondary uppercase tracking-widest mb-3">Involved Entities</h4>
              <div className="text-sm text-text-primary">
                 {/* Generic Mock for requested involved entities list */}
                 {(incident.entities || []).length > 0 ? (
                    incident.entities.map((ent, i) => (
                      <div key={i} className="flex justify-between border-b border-border/50 last:border-0 py-2">
                        <span>{ent.type}</span>
                        <span className="text-text-muted">{ent.id}</span>
                      </div>
                    ))
                 ) : (
                    <span className="text-text-muted italic">No specific entities detected</span>
                 )}
              </div>
           </div>

           <div className="bg-surface rounded-sm border border-border p-4">
              <h4 className="font-mono text-xs text-text-secondary uppercase tracking-widest mb-3">Raw Events</h4>
              <div className="flex flex-col gap-4">
                 {(incident.rawEvents || []).length > 0 ? (
                   incident.rawEvents.map((evt, i) => (
                     <div key={i} className="flex items-start gap-2">
                       <span className="font-mono text-[10px] text-text-muted shrink-0 mt-0.5">{evt.time}</span>
                       <p className="text-xs text-text-primary leading-snug">{evt.description}</p>
                     </div>
                   ))
                 ) : (
                   <span className="text-xs text-text-muted">No raw logs attached</span>
                 )}
              </div>
           </div>
        </div>
      </div>
    </AppShell>
  );
}
