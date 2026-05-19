"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getIncidents } from "@/lib/api";
import SeverityBadge from "@/components/events/SeverityBadge";

const MONO = "var(--font-mono)";
const SANS = "var(--font-sans)";

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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data: incidentsRaw, isLoading } = useQuery({
    queryKey: ["incidents", nightDate],
    queryFn: () => getIncidents({ nightDate }),
    staleTime: 60 * 1000,
  });

  const incidents = Array.isArray(incidentsRaw)
    ? incidentsRaw
    : incidentsRaw?.incidents ?? incidentsRaw?.data ?? [];

  const filteredIncidents = incidents.filter(inc => {
    const sevMatch = severityFilter === "all" || inc.severity === severityFilter;
    const priMatch = priorityFilter === "all" || String(inc.priority) === priorityFilter;
    return sevMatch && priMatch;
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      padding: "32px 24px",
      maxWidth: "1100px",
      margin: "0 auto",
    }}>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontFamily: SANS, fontSize: "24px", color: "var(--fg-1)", margin: "0 0 8px" }}>
            Incidents
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "var(--fg-4)", margin: 0, textTransform: "uppercase" }}>
            Night of {nightDate}
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase" }}>Priority</label>
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
            <label style={{ fontFamily: MONO, fontSize: "10px", color: "var(--fg-3)", textTransform: "uppercase" }}>Severity</label>
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

      <div style={{
        background: "var(--bg-surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: "2px",
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
                <td colSpan="5" style={{ padding: "24px", textAlign: "center", fontFamily: SANS, color: "var(--fg-4)" }}>
                  Loading incidents...
                </td>
              </tr>
            ) : filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: "24px", textAlign: "center", fontFamily: SANS, color: "var(--fg-4)" }}>
                  No incidents match the selected filters.
                </td>
              </tr>
            ) : (
              filteredIncidents.map(inc => (
                <tr key={inc._id} style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "11px", color: "var(--fg-2)" }}>
                    <Link href={`/incident/${inc._id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                      {inc.incidentId || inc._id.substring(0, 8)}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: SANS, fontSize: "14px", color: "var(--fg-1)" }}>
                    {inc.title || "Unnamed Incident"}
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "11px", color: "var(--fg-3)" }}>
                    {inc.location?.name || "Unknown"}
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: MONO, fontSize: "12px", color: "var(--fg-2)" }}>
                    P{inc.priority}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <SeverityBadge severity={inc.severity || 'uncertain'} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
