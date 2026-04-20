"use client";

import { useEffect, useRef } from "react";
import { getStoredToken } from "@/lib/api";
import { useInvestigationStore } from "@/store/investigationStore";
import { useMapStore } from "@/store/mapStore";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 3000;

const parseEventData = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const redactTokenInUrl = (url) => {
  if (!url) return url;

  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", "[REDACTED]");
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]token=)[^&]+/i, "$1[REDACTED]");
  }
};

export function useAgentStream(jobId) {
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  const eventSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  const setJobStatus = useInvestigationStore((state) => state.setJobStatus);
  const addFeedItem = useInvestigationStore((state) => state.addFeedItem);
  const addClassification = useInvestigationStore((state) => state.addClassification);
  const setError = useInvestigationStore((state) => state.setError);

  const jobStatus = useInvestigationStore((state) => state.jobStatus);
  const feedItems = useInvestigationStore((state) => state.feedItems);
  const error = useInvestigationStore((state) => state.error);

  const updatePinSeverity = useMapStore((state) => state.updatePinSeverity);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (jobId === null || jobId === undefined) {
      console.warn("[SSE] jobId is", jobId, "— no connection will be opened");
      return;
    }
    if (typeof jobId !== "string" || jobId.trim() === "") {
      console.warn("[SSE] jobId is not a non-empty string:", jobId);
      return;
    }

    let disposed = false;

    const cleanupConnection = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const handleParsedEvent = (eventPayload) => {
      if (!eventPayload || !isMountedRef.current || disposed) {
        return;
      }

      console.log("SSE MESSAGE", eventPayload.type, eventPayload);

      const payload = eventPayload.payload || eventPayload.data || {};

      addFeedItem({
        ...eventPayload,
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        isNew: true,
      });

      if (eventPayload.type === "classification") {
        const incidentId = payload?.incidentId;
        const classification = payload?.classification || payload;

        if (incidentId) {
          addClassification(incidentId, {
            severity: classification?.severity,
            confidence: classification?.confidence,
            reasoning: classification?.reasoning,
          });

          if (classification?.severity) {
            updatePinSeverity(incidentId, classification.severity);
          }
        }
      }

      if (eventPayload.type === "complete") {
        setJobStatus("complete");
        queryClient.invalidateQueries({ queryKey: ["incidents"] });
        queryClient.invalidateQueries({ queryKey: ["briefing"] });
        toast.success("Investigation stream complete");
      }

      if (eventPayload.type === "failed") {
        setJobStatus("failed");
        setError(payload?.message || payload?.error || "Investigation stream failed");
      }
    };

    const connect = () => {
      if (disposed || !isMountedRef.current) {
        return;
      }

      setJobStatus("connecting");

      const token = getStoredToken();
      if (!token) {
        console.error("[SSE] missing auth token");
        setJobStatus("failed");
        setError("No auth token available for stream");
        return;
      }

      const streamUrl = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/investigations/${jobId}/stream?token=${encodeURIComponent(token)}`;
      const safeStreamUrl = redactTokenInUrl(streamUrl);
      console.log("[SSE] opening connection to:", safeStreamUrl);

      const source = new EventSource(streamUrl);
      eventSourceRef.current = source;

      source.addEventListener("connected", (event) => {
        const connectedPayload = parseEventData(event.data) || { jobId };
        console.log("SSE CONNECTED", connectedPayload);

        if (!isMountedRef.current || disposed) {
          return;
        }

        reconnectAttemptsRef.current = 0;
        setJobStatus("running");
      });

      source.addEventListener("complete", (event) => {
        const completePayload = parseEventData(event.data) || {};
        handleParsedEvent({ type: "complete", data: completePayload, payload: completePayload });
      });

      source.addEventListener("failed", (event) => {
        const failedPayload = parseEventData(event.data) || {};
        handleParsedEvent({ type: "failed", data: failedPayload, payload: failedPayload });
      });

      source.onmessage = (event) => {
        const parsed = parseEventData(event.data);
        if (!parsed) {
          return;
        }
        handleParsedEvent(parsed);
      };

      source.onerror = (event) => {
        if (!isMountedRef.current || disposed) {
          return;
        }

        const diagnostic = {
          jobId,
          streamUrl: safeStreamUrl,
          readyState: source.readyState,
          reconnectAttempts: reconnectAttemptsRef.current,
          eventType: event?.type || "error",
          isTrusted: Boolean(event?.isTrusted),
          lastEventId: event?.lastEventId || null,
        };

        const isFirstHandshakeTransient =
          source.readyState === EventSource.CONNECTING &&
          reconnectAttemptsRef.current === 0;

        if (isFirstHandshakeTransient) {
          return;
        }

        // onerror is expected during flaky connectivity; reserve console.error for terminal failures.
        console.warn("[SSE] transient error", diagnostic);

        if (source.readyState === EventSource.CLOSED) {
          cleanupConnection();

          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current += 1;
            const attempt = reconnectAttemptsRef.current;
            console.log(`[SSE] reconnecting in ${RECONNECT_DELAY_MS}ms (attempt ${attempt})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, RECONNECT_DELAY_MS);
          } else {
            console.error("[SSE] terminal failure", diagnostic);
            setJobStatus("failed");
            setError("SSE connection closed after max reconnect attempts");
            toast.error("Unable to reconnect to investigation stream");
          }
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      cleanupConnection();
    };
  }, [
    jobId,
    setJobStatus,
    addFeedItem,
    addClassification,
    setError,
    updatePinSeverity,
    queryClient,
  ]);

  return {
    isConnected: jobStatus === "running",
    isConnecting: jobStatus === "connecting",
    feedItems,
    jobStatus,
    error,
  };
}
