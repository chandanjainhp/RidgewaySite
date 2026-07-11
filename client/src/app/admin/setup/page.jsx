"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Key,
  Settings,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Activity,
  Loader2,
} from "lucide-react";
import {
  getOrgMe,
  updateOrgConfig,
  listOrgApiKeys,
  createOrgApiKey,
  revokeOrgApiKey,
  getIngestionStatus,
  getAdminGateStatus,
} from "@/lib/api";

const MONO = "var(--font-mono)";

export default function AdminSetupPage() {
  const [gateStatus, setGateStatus] = useState("checking");

  // Verification session gate
  useEffect(() => {
    let isMounted = true;
    async function checkGate() {
      try {
        const status = await getAdminGateStatus();
        if (!isMounted) return;
        if (status?.authenticated) {
          setGateStatus("authenticated");
        } else {
          window.location.href = `/settings-access?from=/admin/setup`;
        }
      } catch (_) {
        if (!isMounted) return;
        window.location.href = `/settings-access?from=/admin/setup`;
      }
    }
    checkGate();
    return () => {
      isMounted = false;
    };
  }, []);

  if (gateStatus !== "authenticated") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          color: "var(--fg-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: "11px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        <Loader2 size={14} className="animate-spin" style={{ marginRight: "8px" }} />
        Authenticating Secure Setup Access...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "calc(100vh - 80px)",
        background: "var(--bg-base)",
        color: "var(--fg-1)",
        fontFamily: MONO,
        width: "100%",
      }}
    >
      <Suspense fallback={
        <div style={{ padding: "40px", color: "var(--fg-3)", fontSize: "12px" }}>
          Loading setup settings…
        </div>
      }>
        <AdminSetupContainer />
      </Suspense>
    </div>
  );
}

function AdminSetupContainer() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "api-keys";

  const [orgData, setOrgData] = useState(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);

  // Ingestion banner status
  const [ingestStatus, setIngestStatus] = useState({ active: false, lastReceivedAt: null });
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef(null);

  const fetchOrgData = async () => {
    setIsLoadingOrg(true);
    try {
      const res = await getOrgMe();
      setOrgData(res?.data || res || {});
    } catch (err) {
      toast.error(err.message || "Failed to load organisation data.");
    } finally {
      setIsLoadingOrg(false);
    }
  };

  const fetchIngestStatus = async () => {
    try {
      const res = await getIngestionStatus();
      const status = res?.data || res || { active: false, lastReceivedAt: null };
      setIngestStatus(status);
      if (status.active && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setIsPolling(false);
      }
    } catch (_) {
      // Fail silently for polling
    }
  };

  useEffect(() => {
    fetchOrgData();
    fetchIngestStatus();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll for ingestion status if not active yet
  useEffect(() => {
    if (!ingestStatus.active && !pollIntervalRef.current) {
      setIsPolling(true);
      pollIntervalRef.current = setInterval(fetchIngestStatus, 5000);
    }
    return () => {
      if (ingestStatus.active && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setIsPolling(false);
      }
    };
  }, [ingestStatus.active]);

  return (
    <div style={{ width: "100%" }}>
      {/* Content Area */}
      <main style={{ padding: "0 0 40px", overflowY: "auto", position: "relative" }}>
        {isLoadingOrg ? (
          <div style={{ color: "var(--fg-3)", fontSize: "12px" }}>Loading config settings…</div>
        ) : (
          <div>
            {activeTab === "api-keys" && (
              <ApiKeysView
                ingestStatus={ingestStatus}
                isPolling={isPolling}
                triggerStatusCheck={fetchIngestStatus}
              />
            )}
            {activeTab === "site-config" && (
              <SiteConfigView orgData={orgData} refreshData={fetchOrgData} />
            )}
            {activeTab === "argus-config" && (
              <ArgusConfigView orgData={orgData} refreshData={fetchOrgData} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   API Keys Tab View
   ───────────────────────────────────────────────────────────────────────────── */
function ApiKeysView({ ingestStatus, isPolling, triggerStatusCheck }) {
  const [keys, setKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const res = await listOrgApiKeys();
      setKeys(res?.data || res || []);
    } catch (err) {
      toast.error(err.message || "Failed to retrieve API keys.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const name = `sensor_auth_${Date.now().toString().slice(-4)}`;
      const res = await createOrgApiKey({ name, scopes: ["events:write"] });
      const created = res?.data || res;
      setNewKey(created);
      toast.success("API key created successfully.");
      await fetchKeys();
      triggerStatusCheck();
    } catch (err) {
      toast.error(err.message || "Failed to generate API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (keyId) => {
    setRevokingId(keyId);
    try {
      await revokeOrgApiKey(keyId);
      toast.success("API key revoked.");
      await fetchKeys();
    } catch (err) {
      toast.error(err.message || "Failed to revoke API key.");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formattedDate = (d) => {
    if (!d) return "NEVER";
    return new Date(d).toISOString().replace("T", " ").slice(0, 19);
  };

  return (
    <div>
      <h2 style={{ fontSize: "16px", color: "var(--fg-1)", marginBottom: "10px", fontWeight: 700 }}>
        API KEY MANAGEMENT
      </h2>
      <p style={{ fontSize: "12px", color: "var(--fg-3)", marginBottom: "24px", lineHeight: 1.5 }}>
        Generate event ingestion tokens for your drone patrols and camera feeds. API keys are hashed in the database.
      </p>

      {/* Ingestion status banner */}
      <div
        style={{
          border: ingestStatus.active
            ? "1px solid var(--success)"
            : "1px solid var(--border-strong)",
          background: ingestStatus.active
            ? "rgba(34,197,94,0.06)"
            : "rgba(255,255,255,0.02)",
          padding: "16px",
          marginBottom: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {ingestStatus.active ? (
            <Activity size={18} style={{ color: "var(--success)" }} />
          ) : (
            <AlertCircle size={18} style={{ color: "var(--fg-3)" }} />
          )}
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: ingestStatus.active ? "var(--success)" : "var(--fg-2)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              INGESTION STATUS: {ingestStatus.active ? "ACTIVE" : "WAITING"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--fg-2)", marginTop: "4px" }}>
              {ingestStatus.active
                ? `Connection established. Last packet received at: ${formattedDate(ingestStatus.lastReceivedAt)}`
                : "Waiting for first data packet. Ingestion will begin within 24 hours of sensor link."}
            </div>
          </div>
        </div>
        {isPolling && !ingestStatus.active && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--fg-3)" }}>
            <Loader2 size={12} className="animate-spin" />
            Polling ingest status…
          </div>
        )}
      </div>

      {/* New Key Display Modal Overlay */}
      {newKey && (
        <div
          style={{
            background: "var(--bg-surface-2)",
            border: "1px solid var(--accent)",
            padding: "20px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>
              NEW API TOKEN GENERATED — SAVE NOW (SHOWN ONCE)
            </span>
            <button
              onClick={() => setNewKey(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--fg-3)",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: MONO,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg-1)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-3)")}
            >
              [Dismiss]
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <input
              style={{
                flex: 1,
                background: "var(--bg-base)",
                border: "1px solid var(--border-strong)",
                padding: "8px 12px",
                fontFamily: MONO,
                fontSize: "12px",
                color: "var(--accent)",
                outline: "none",
                borderRadius: 0,
              }}
              readOnly
              value={newKey.key}
            />
            <button
              onClick={() => copyToClipboard(newKey.key)}
              style={{
                background: "transparent",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
                padding: "8px 16px",
                fontFamily: MONO,
                fontSize: "12px",
                cursor: "pointer",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent)";
                e.currentTarget.style.color = "var(--bg-base)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--accent)";
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* API Keys List */}
      <div style={{ background: "var(--bg-surface-1)", border: "1px solid var(--border-default)" }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--fg-2)" }}>
            Active Credentials
          </span>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || newKey}
            style={{
              background: "transparent",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              padding: "6px 12px",
              fontFamily: MONO,
              fontSize: "11px",
              fontWeight: 500,
              cursor: (isGenerating || newKey) ? "not-allowed" : "pointer",
              borderRadius: 0,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: (isGenerating || newKey) ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isGenerating && !newKey) {
                e.currentTarget.style.background = "var(--accent)";
                e.currentTarget.style.color = "var(--bg-base)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--accent)";
            }}
          >
            <Plus size={14} />
            Generate API Key
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: "32px", textAlign: "center", fontSize: "12px", color: "var(--fg-3)" }}>
            Loading API keys…
          </div>
        ) : keys.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", fontSize: "12px", color: "var(--fg-3)" }}>
            No active API keys found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {keys.map((k) => (
              <div
                key={k._id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 140px 100px",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--border-hairline)",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ color: "var(--fg-1)" }}>{k.name}</span>
                  <code style={{ display: "block", fontSize: "11px", color: "var(--fg-3)", marginTop: "4px" }}>
                    {k.keyPrefix}
                  </code>
                </div>
                <div style={{ color: "var(--fg-3)" }}>
                  {formattedDate(k.createdAt).split(" ")[0]}
                </div>
                <div style={{ color: "var(--fg-3)", fontSize: "11px" }}>
                  {k.lastUsedAt ? formattedDate(k.lastUsedAt) : "UNUSED"}
                </div>
                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => handleRevoke(k._id)}
                    disabled={revokingId === k._id}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--sev-serious-dim)",
                      color: "var(--sev-serious)",
                      padding: "4px 8px",
                      fontSize: "11px",
                      cursor: revokingId === k._id ? "not-allowed" : "pointer",
                      borderRadius: 0,
                      fontFamily: MONO,
                      opacity: revokingId === k._id ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (revokingId !== k._id) {
                        e.currentTarget.style.background = "var(--sev-serious)";
                        e.currentTarget.style.color = "var(--fg-1)";
                        e.currentTarget.style.borderColor = "var(--sev-serious)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--sev-serious)";
                      e.currentTarget.style.borderColor = "var(--sev-serious-dim)";
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Site Configuration Tab View
   ───────────────────────────────────────────────────────────────────────────── */
function SiteConfigView({ orgData, refreshData }) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [zoneCount, setZoneCount] = useState("");
  const [droneIds, setDroneIds] = useState([]);
  const [newDroneId, setNewDroneId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (orgData?.config) {
      setLat(orgData.config.coordinates?.lat?.toString() || "");
      setLng(orgData.config.coordinates?.lng?.toString() || "");
      setZoneCount(orgData.config.zoneCount?.toString() || "0");
      setDroneIds(orgData.config.droneIds || []);
    }
  }, [orgData]);

  const handleAddDrone = (e) => {
    e.preventDefault();
    if (!newDroneId.trim()) return;
    if (droneIds.includes(newDroneId.trim())) {
      toast.error("Drone ID already exists in list.");
      return;
    }
    setDroneIds([...droneIds, newDroneId.trim()]);
    setNewDroneId("");
  };

  const handleRemoveDrone = (id) => {
    setDroneIds(droneIds.filter((d) => d !== id));
  };

  const handleSave = async () => {
    if (!lat || !lng) {
      toast.error("Site coordinates are required.");
      return;
    }

    setIsSaving(true);
    try {
      await updateOrgConfig({
        coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
        zoneCount: parseInt(zoneCount) || 0,
        droneIds: droneIds,
      });
      toast.success("Site configuration updated successfully.");
      await refreshData();
    } catch (err) {
      toast.error(err.message || "Failed to update configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const labelStyle = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--fg-3)",
    marginBottom: "8px",
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    height: "40px",
    padding: "0 12px",
    background: "var(--bg-surface-2)",
    border: "1px solid var(--border-strong)",
    color: "var(--fg-1)",
    fontFamily: MONO,
    fontSize: "13px",
    borderRadius: 0,
    outline: "none",
  };

  return (
    <div style={{ maxWidth: "560px" }}>
      <h2 style={{ fontSize: "16px", color: "var(--fg-1)", marginBottom: "10px", fontWeight: 700 }}>
        SITE GEOMETRY & INGEST CONFIG
      </h2>
      <p style={{ fontSize: "12px", color: "var(--fg-3)", marginBottom: "28px", lineHeight: 1.5 }}>
        Configure the geographical location, scanning grid boundaries, and registered drones to unlock map visualization.
      </p>

      {/* Lat/Lng Grid */}
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Site Center Coordinates</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "10px", color: "var(--fg-3)", display: "block", marginBottom: "4px" }}>Latitude</span>
            <input
              type="number"
              step="any"
              value={lat}
              placeholder="51.5074"
              onChange={(e) => setLat(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <span style={{ fontSize: "10px", color: "var(--fg-3)", display: "block", marginBottom: "4px" }}>Longitude</span>
            <input
              type="number"
              step="any"
              value={lng}
              placeholder="-0.1278"
              onChange={(e) => setLng(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Zones Count */}
      <div style={{ marginBottom: "24px" }}>
        <label style={labelStyle}>Zone Count</label>
        <input
          type="number"
          min="0"
          value={zoneCount}
          onChange={(e) => setZoneCount(e.target.value)}
          placeholder="0"
          style={inputStyle}
        />
      </div>

      {/* Drone List */}
      <div style={{ marginBottom: "32px" }}>
        <label style={labelStyle}>Registered Drone / Sensor IDs</label>
        <form onSubmit={handleAddDrone} style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            type="text"
            value={newDroneId}
            onChange={(e) => setNewDroneId(e.target.value)}
            placeholder="e.g. drone-north-01"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="submit"
            style={{
              background: "transparent",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              padding: "0 16px",
              fontFamily: MONO,
              fontSize: "12px",
              cursor: "pointer",
              borderRadius: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.color = "var(--bg-base)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--accent)";
            }}
          >
            Add ID
          </button>
        </form>

        <div
          style={{
            background: "var(--bg-surface-1)",
            border: "1px solid var(--border-default)",
            minHeight: "80px",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {droneIds.length === 0 ? (
            <div style={{ padding: "20px", color: "var(--fg-3)", fontSize: "12px", textAlign: "center" }}>
              No drones configured.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {droneIds.map((id) => (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--border-hairline)",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "var(--fg-1)" }}>{id}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDrone(id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--fg-3)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sev-serious)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-3)")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          background: "transparent",
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          padding: "12px 24px",
          fontFamily: MONO,
          fontSize: "12px",
          fontWeight: 700,
          cursor: isSaving ? "not-allowed" : "pointer",
          borderRadius: 0,
          opacity: isSaving ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isSaving) {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.color = "var(--bg-base)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--accent)";
        }}
      >
        {isSaving ? "Saving Config…" : "Save Site Configurations"}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Argus Config Tab View
   ───────────────────────────────────────────────────────────────────────────── */
function ArgusConfigView({ orgData, refreshData }) {
  const [argusEnabled, setArgusEnabled] = useState(true);
  const [serious, setSerious] = useState(50);
  const [minor, setMinor] = useState(50);
  const [harmless, setHarmless] = useState(50);
  const [uncertain, setUncertain] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (orgData?.config) {
      setArgusEnabled(orgData.config.argusEnabled !== false);
      setSerious(orgData.config.argusThresholds?.serious ?? 50);
      setMinor(orgData.config.argusThresholds?.minor ?? 50);
      setHarmless(orgData.config.argusThresholds?.harmless ?? 50);
      setUncertain(orgData.config.argusThresholds?.uncertain ?? 50);
    }
  }, [orgData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateOrgConfig({
        argusEnabled,
        argusThresholds: {
          serious,
          minor,
          harmless,
          uncertain,
        },
      });
      toast.success("Argus Agent config updated successfully.");
      await refreshData();
    } catch (err) {
      toast.error(err.message || "Failed to update agent config.");
    } finally {
      setIsSaving(false);
    }
  };

  const sliderLabelStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--fg-3)",
    marginBottom: "6px",
  };

  const sliderStyle = {
    width: "100%",
    height: "6px",
    background: "var(--bg-surface-2)",
    outline: "none",
    border: "1px solid var(--border-strong)",
    appearance: "none",
    borderRadius: 0,
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: "560px" }}>
      <h2 style={{ fontSize: "16px", color: "var(--fg-1)", marginBottom: "10px", fontWeight: 700 }}>
        ARGUS AGENT CONFIGURATION
      </h2>
      <p style={{ fontSize: "12px", color: "var(--fg-3)", marginBottom: "28px", lineHeight: 1.5 }}>
        Enable the Argus AI agent and set classification sensitivity thresholds for incident analysis. Higher values reduce false positives.
      </p>

      {/* Argus Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "var(--bg-surface-1)",
          border: "1px solid var(--border-default)",
          padding: "16px",
          marginBottom: "32px",
        }}
      >
        <input
          id="argus-toggle"
          type="checkbox"
          checked={argusEnabled}
          onChange={(e) => setArgusEnabled(e.target.checked)}
          style={{
            width: "18px",
            height: "18px",
            accentColor: "var(--accent)",
            cursor: "pointer",
          }}
        />
        <label htmlFor="argus-toggle" style={{ fontSize: "12px", color: "var(--fg-1)", cursor: "pointer", fontWeight: 700 }}>
          Enable Argus Security Investigation Agent
        </label>
      </div>

      {/* Sliders Container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          marginBottom: "36px",
          opacity: argusEnabled ? 1 : 0.4,
          pointerEvents: argusEnabled ? "auto" : "none",
        }}
      >
        {/* Serious */}
        <div>
          <div style={sliderLabelStyle}>
            <span>Serious Event Sensitivity</span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{serious}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={serious}
            onChange={(e) => setSerious(parseInt(e.target.value))}
            style={sliderStyle}
          />
        </div>

        {/* Minor */}
        <div>
          <div style={sliderLabelStyle}>
            <span>Minor Event Sensitivity</span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{minor}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={minor}
            onChange={(e) => setMinor(parseInt(e.target.value))}
            style={sliderStyle}
          />
        </div>

        {/* Harmless */}
        <div>
          <div style={sliderLabelStyle}>
            <span>Harmless Event Sensitivity</span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{harmless}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={harmless}
            onChange={(e) => setHarmless(parseInt(e.target.value))}
            style={sliderStyle}
          />
        </div>

        {/* Uncertain */}
        <div>
          <div style={sliderLabelStyle}>
            <span>Uncertain Event Sensitivity</span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{uncertain}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={uncertain}
            onChange={(e) => setUncertain(parseInt(e.target.value))}
            style={sliderStyle}
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          background: "transparent",
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          padding: "12px 24px",
          fontFamily: MONO,
          fontSize: "12px",
          fontWeight: 700,
          cursor: isSaving ? "not-allowed" : "pointer",
          borderRadius: 0,
          opacity: isSaving ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isSaving) {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.color = "var(--bg-base)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--accent)";
        }}
      >
        {isSaving ? "Saving Config…" : "Save Agent Configurations"}
      </button>
    </div>
  );
}
