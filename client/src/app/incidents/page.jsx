"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getSiteMapData, getEventPins } from "@/lib/api";
import { useMapStore } from "@/store/mapStore";
import { useIncidents, useIncidentById, useIncidentEvidenceGraph } from "@/hooks/useIncidents";
import AgentReasoning from "@/components/incident/AgentReasoning";
import EvidenceChain from "@/components/incident/EvidenceChain";
import { useStartInvestigation, usePollInvestigationStatus } from "@/hooks/useInvestigation";
import { useInvestigationStore } from "@/store/investigationStore";
import AgentFeed from "@/components/agent/AgentFeed";
import EventPanel from "@/components/events/EventPanel";
import SeverityBadge from "@/components/events/SeverityBadge";
import { Activity, ShieldAlert, Sliders, Calendar, Play } from "lucide-react";

const MONO = "var(--font-mono)";
const SANS = "var(--font-sans)";

const SiteMap = dynamic(() => import("@/components/map/SiteMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
      Loading map…
    </div>
  ),
});

function IncidentsMapPanel({ nightDate }) {
  const setEventPins = useMapStore((s) => s.setEventPins);
  const { data: siteMapData, isLoading: mapLoading, isError: mapError, error: mapErr } = useQuery({
    queryKey: ["siteMap"],
    queryFn: getSiteMapData,
    staleTime: 3600000,
  });
  const { data: eventPins, isLoading: pinsLoading } = useQuery({
    queryKey: ["eventPins", nightDate],
    queryFn: () => getEventPins(nightDate),
    staleTime: 60000,
  });

  useEffect(() => {
    if (Array.isArray(eventPins)) setEventPins(eventPins);
  }, [eventPins, setEventPins]);

  const resolvedMapData = useMemo(() => {
    if (!siteMapData && !eventPins?.length) return null;
    const coords = siteMapData?.coordinates;
    const hasCoords = coords && typeof coords.lat === "number" && typeof coords.lng === "number";
    if (hasCoords) return siteMapData;
    const firstPin = eventPins?.find((p) => p?.coordinates?.lat != null && p?.coordinates?.lng != null);
    if (!firstPin) return siteMapData;
    return { ...siteMapData, coordinates: firstPin.coordinates };
  }, [siteMapData, eventPins]);

  return (
    <div style={{
      marginTop: "16px",
      background: "var(--bg-surface-1)",
      border: "1px solid var(--border-default)",
      borderRadius: "4px",
      overflow: "hidden",
      height: "320px",
    }}>
      <div style={{
        padding: "8px 16px",
        borderBottom: "1px solid var(--border-hairline)",
        background: "var(--bg-surface-2)",
        fontFamily: MONO,
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--fg-3)",
      }}>
        Site map — overnight events
      </div>
      <div style={{ height: "calc(100% - 33px)" }}>
        <SiteMap
          siteMapData={resolvedMapData}
          eventPins={eventPins || []}
          isLoading={mapLoading || pinsLoading}
          isError={mapError}
          errorMessage={mapErr?.message}
          nightDate={nightDate}
        />
      </div>
    </div>
  );
}

function useNightDate() {
  return useMemo(() => {
    if (process.env.NEXT_PUBLIC_SEED_NIGHT_DATE) return process.env.NEXT_PUBLIC_SEED_NIGHT_DATE;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
}

export default function IncidentsPage() {
  const nightDate = useNightDate();
  return (
    <Suspense fallback={
      <div style={{ padding: "40px", color: "var(--fg-3)", fontSize: "12px", fontFamily: MONO }}>
        Loading incidents workspace…
      </div>
    }>
      <IncidentsWorkspace nightDate={nightDate} />
    </Suspense>
  );
}

function IncidentsWorkspace({ nightDate }) {
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState("activity"); // 'activity' | 'events'

  // Load incidents
  const { data: incidentsData, isLoading } = useIncidents({ nightDate });
  const incidents = incidentsData?.incidents ?? [];

  // Filter incidents for display in the table
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const sevMatch = severityFilter === "all" || inc.severity === severityFilter;
      const priMatch = priorityFilter === "all" || String(inc.priority) === priorityFilter;
      return sevMatch && priMatch;
    });
  }, [incidents, severityFilter, priorityFilter]);

  // Find selected incident details
  const getIncidentId = (inc) => inc?.id || inc?._id;

  const selectedIncident = useMemo(() => {
    return incidents.find((i) => getIncidentId(i) === selectedIncidentId);
  }, [incidents, selectedIncidentId]);

  // Connect to investigation store and polling
  const jobId = useInvestigationStore((s) => s.jobId);
  const jobStatus = useInvestigationStore((s) => s.jobStatus);
  const stats = useInvestigationStore((s) => s.investigationStats);
  const { mutate: startInvestigation, isPending: isStarting } = useStartInvestigation();
  
  // Poll investigation status when job is active
  usePollInvestigationStatus(jobId);

  const { data: selectedDetail, isLoading: detailLoading } = useIncidentById(
    selectedIncidentId,
    { enabled: !!selectedIncidentId },
  );
  const { data: evidenceGraph, isLoading: graphLoading } = useIncidentEvidenceGraph(
    selectedIncidentId,
    { enabled: !!selectedIncidentId },
  );

  const isNightJobActive = jobStatus !== "idle" || jobId;
  const persistedInvestigation = selectedDetail?.investigationId;
  const hasCompletedInvestigation =
    persistedInvestigation?.status === "complete" ||
    Boolean(persistedInvestigation?.classification?.reasoning);
  const showPersistedResults =
    !!selectedIncidentId && hasCompletedInvestigation && !isNightJobActive;
  const showPanelWorkspace = isNightJobActive || showPersistedResults;

  const persistedClassification = {
    ...(evidenceGraph?.classification || {}),
    ...(persistedInvestigation?.classification || {}),
  };
  const persistedReasoning =
    persistedClassification.reasoning ||
    selectedDetail?.classification?.reasoning ||
    selectedIncident?.agentSummary ||
    "No reasoning attached by Argus.";
  const persistedConfidence = persistedClassification.confidence ?? 0;
  const persistedUncertainties = persistedClassification.uncertainties || [];
  const evidenceSteps = evidenceGraph?.steps || [];

  // If selectedIncidentId is not set, select the first matching incident if available
  useEffect(() => {
    if (!selectedIncidentId && filteredIncidents.length > 0) {
      setSelectedIncidentId(getIncidentId(filteredIncidents[0]));
    }
  }, [filteredIncidents, selectedIncidentId]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      padding: "24px",
      maxWidth: "1400px",
      margin: "0 auto",
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .incidents-workspace {
          display: grid;
          grid-template-columns: 1fr 460px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .incidents-workspace {
            grid-template-columns: 1fr;
          }
          .incidents-panel {
            position: relative !important;
            top: 0 !important;
            height: auto !important;
            max-height: none !important;
          }
        }
      ` }} />

      {/* Header section */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontFamily: SANS, fontSize: "24px", color: "var(--fg-1)", margin: "0 0 8px", fontWeight: 500 }}>
            Incidents Workspace
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: MONO, fontSize: "11px", color: "var(--fg-4)", textTransform: "uppercase" }}>
            <Calendar size={12} style={{ color: "var(--accent)" }} />
            <span>Night of {nightDate}</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{
                background: "var(--bg-surface-1)",
                color: "var(--fg-1)",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                padding: "6px 12px",
                fontFamily: SANS,
                fontSize: "13px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Priorities</option>
              <option value="1">Priority 1 (High)</option>
              <option value="2">Priority 2</option>
              <option value="3">Priority 3</option>
              <option value="4">Priority 4</option>
              <option value="5">Priority 5 (Low)</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                background: "var(--bg-surface-1)",
                color: "var(--fg-1)",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                padding: "6px 12px",
                fontFamily: SANS,
                fontSize: "13px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Severities</option>
              <option value="serious">Serious</option>
              <option value="minor">Minor</option>
              <option value="harmless">Harmless</option>
              <option value="uncertain">Uncertain</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="incidents-workspace">
        {/* Left Side: Table */}
        <div style={{
          background: "var(--bg-surface-1)",
          border: "1px solid var(--border-default)",
          borderRadius: "4px",
          overflow: "hidden"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-default)" }}>
                <th style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase" }}>ID</th>
                <th style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase" }}>Title</th>
                <th style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase" }}>Location</th>
                <th style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase" }}>Priority</th>
                <th style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase" }}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ padding: "32px", textAlign: "center", fontFamily: SANS, color: "var(--fg-4)", fontSize: "13px" }}>
                    Loading incidents data…
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "32px", textAlign: "center", fontFamily: SANS, color: "var(--fg-4)", fontSize: "13px" }}>
                    No incidents match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => {
                  const incidentId = getIncidentId(inc);
                  return (
                  <tr
                    key={incidentId}
                    onClick={() => setSelectedIncidentId(incidentId)}
                    style={{
                      borderBottom: "1px solid var(--border-hairline)",
                      cursor: "pointer",
                      background: selectedIncidentId === incidentId ? "rgba(184,212,232,0.06)" : "transparent",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedIncidentId !== incidentId) e.currentTarget.style.background = "var(--bg-surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (selectedIncidentId !== incidentId) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "11px" }}>
                      <Link
                        href={`/incident/${incidentId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
                      >
                        {inc.incidentId || String(incidentId).substring(0, 8)}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: SANS, fontSize: "13px", color: "var(--fg-1)", fontWeight: 500 }}>
                      {inc.title || "Unnamed Incident"}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "11px", color: "var(--fg-3)" }}>
                      {inc.location?.name || "Unknown"}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "12px", color: "var(--fg-2)" }}>
                      P{inc.priority}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <SeverityBadge severity={inc.severity || "uncertain"} />
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
          <IncidentsMapPanel nightDate={nightDate} />
        </div>

        {/* Right Side: Panel */}
        <div
          className="incidents-panel"
          style={{
            background: "var(--bg-surface-1)",
            border: "1px solid var(--border-default)",
            borderRadius: "4px",
            height: "calc(100vh - 140px)",
            position: "sticky",
            top: "88px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Panel Header */}
          <div style={{
            padding: "16px",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-surface-2)",
          }}>
            {selectedIncident ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>
                    INCIDENT: {selectedIncident.incidentId || String(getIncidentId(selectedIncident)).substring(0, 8)}
                  </span>
                  <button
                    onClick={() => setSelectedIncidentId(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--fg-4)",
                      fontSize: "11px",
                      fontFamily: MONO,
                      cursor: "pointer",
                      padding: 0,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg-1)"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "var(--fg-4)"}
                  >
                    [DESELECT]
                  </button>
                </div>
                <h3 style={{ fontFamily: SANS, fontSize: "15px", fontWeight: 600, color: "var(--fg-1)", margin: "0 0 8px" }}>
                  {selectedIncident.title || "Unnamed Incident"}
                </h3>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", fontFamily: MONO, fontSize: "11px", color: "var(--fg-3)" }}>
                  <span>{selectedIncident.location?.name || "Unknown"}</span>
                  <span>·</span>
                  <span>P{selectedIncident.priority}</span>
                  <span>·</span>
                  <SeverityBadge severity={selectedIncident.severity || "uncertain"} />
                </div>
              </div>
            ) : (
              <div>
                <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--fg-4)", fontWeight: 600 }}>
                  SYSTEM INTELLIGENCE
                </span>
                <h3 style={{ fontFamily: SANS, fontSize: "15px", fontWeight: 600, color: "var(--fg-1)", margin: "4px 0 0" }}>
                  Active Investigation Shell
                </h3>
              </div>
            )}
          </div>

          {/* Investigation Trigger / Progress Banner */}
          {showPersistedResults ? (
            <div style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(184,212,232,0.02)",
              borderBottom: "1px solid var(--border-default)",
              fontSize: "11px",
              fontFamily: MONO,
              color: "var(--fg-2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--sev-harmless)",
                }} />
                <span style={{ textTransform: "uppercase" }}>Investigation complete</span>
              </div>
              <SeverityBadge severity={persistedClassification.severity || selectedIncident?.severity || "uncertain"} />
            </div>
          ) : !isNightJobActive ? (
            <div style={{
              padding: "24px 16px",
              textAlign: "center",
              borderBottom: "1px solid var(--border-default)",
              background: "rgba(184,212,232,0.02)",
            }}>
              <ShieldAlert size={20} style={{ color: "var(--fg-3)", margin: "0 auto 8px" }} />
              <p style={{ fontFamily: MONO, fontSize: "11px", color: "var(--fg-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
                No active investigation running for {nightDate}. Start the AI agent protocol to analyse overnight events.
              </p>
              <button
                onClick={() => startInvestigation({ nightDate })}
                disabled={isStarting}
                style={{
                  background: "transparent",
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                  borderRadius: "2px",
                  padding: "8px 18px",
                  fontSize: "11px",
                  fontFamily: MONO,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  cursor: isStarting ? "not-allowed" : "pointer",
                  opacity: isStarting ? 0.6 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isStarting) {
                    e.currentTarget.style.background = "var(--accent)";
                    e.currentTarget.style.color = "var(--bg-base)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isStarting) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--accent)";
                  }
                }}
              >
                <Play size={12} fill="currentColor" />
                {isStarting ? "Initiating…" : "Start Investigation"}
              </button>
            </div>
          ) : (
            /* System active stats */
            <div style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(184,212,232,0.02)",
              borderBottom: "1px solid var(--border-default)",
              fontSize: "11px",
              fontFamily: MONO,
              color: "var(--fg-2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: jobStatus === "running" ? "var(--accent)" : "var(--fg-4)",
                  boxShadow: jobStatus === "running" ? "0 0 6px var(--accent)" : "none",
                  animation: jobStatus === "running" ? "status-pulse 1.6s ease-in-out infinite" : "none",
                }} />
                <span style={{ textTransform: "uppercase" }}>{jobStatus}</span>
              </div>
              <div>
                {stats.resolvedIncidents}/{stats.totalIncidents} Resolved
              </div>
            </div>
          )}

          {/* Tab Selection */}
          {showPanelWorkspace && (
            <div style={{
              display: "flex",
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-surface-2)",
            }}>
              <button
                onClick={() => setActiveRightTab("activity")}
                style={{
                  flex: 1,
                  padding: "10px",
                  fontFamily: MONO,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  background: activeRightTab === "activity" ? "var(--bg-surface-1)" : "transparent",
                  color: activeRightTab === "activity" ? "var(--accent)" : "var(--fg-3)",
                  border: "none",
                  borderBottom: activeRightTab === "activity" ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 120ms ease",
                }}
              >
                Argus Activity
              </button>
              <button
                onClick={() => setActiveRightTab("events")}
                style={{
                  flex: 1,
                  padding: "10px",
                  fontFamily: MONO,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  background: activeRightTab === "events" ? "var(--bg-surface-1)" : "transparent",
                  color: activeRightTab === "events" ? "var(--accent)" : "var(--fg-3)",
                  border: "none",
                  borderBottom: activeRightTab === "events" ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 120ms ease",
                }}
              >
                Events Timeline
              </button>
            </div>
          )}

          {/* Panel Body / Tab Contents */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {!showPanelWorkspace ? (
              <div style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--fg-4)",
                fontFamily: MONO,
                fontSize: "12px",
              }}>
                Please start the investigation to activate the live feed and events logs.
              </div>
            ) : activeRightTab === "activity" ? (
              <div style={{ height: "100%" }}>
                {showPersistedResults ? (
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {(detailLoading || graphLoading) ? (
                      <div style={{ fontFamily: MONO, fontSize: "11px", color: "var(--fg-4)" }}>
                        Loading Argus investigation results…
                      </div>
                    ) : (
                      <>
                        <AgentReasoning
                          reasoning={persistedReasoning}
                          uncertainties={persistedUncertainties}
                          confidence={persistedConfidence}
                        />
                        <EvidenceChain
                          steps={evidenceSteps}
                          classification={persistedClassification}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <AgentFeed />
                )}
              </div>
            ) : (
              <div style={{ height: "100%" }}>
                <EventPanel nightDate={nightDate} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
