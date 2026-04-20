import { getStoredToken } from "@/lib/api";

/* =========================================
          SSE EVENT TYPES
========================================= */
export const SSE_EVENT_TYPES = {
  TOOL_CALLED: "tool_called",
  TOOL_RESULT: "tool_result",
  REASONING: "reasoning",
  CLASSIFICATION: "classification",
  COMPLETE: "complete",
  FAILED: "failed",
  CONNECTED: "connected",
  ERROR: "error",
};

/* =========================================
          CONSTANTS
========================================= */
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 3000;

/**
 * Safe JSON parser that returns null on parse error
 */
function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Creates and wraps an EventSource connection capable of reconnecting with defined hooks.
 * Handles authentication via token query parameter and implements exponential backoff for reconnection.
 *
 * @param {string} jobId The associated backend job identifier
 * @param {Object} handlers Lifecycle hooks:
 *   - onConnected: () → void
 *   - onMessage: (parsedEvent) → void
 *   - onComplete: (completionData) → void
 *   - onFailed: (errorData) → void
 *   - onReconnecting: (attemptNumber) → void
 *   - onError: (error) → void
 * @returns {Function} disconnect function to close the connection
 */
export function createSSEConnection(jobId, handlers = {}) {
  // Guard against SSR environment
  if (typeof EventSource === "undefined") {
    const error = new Error("EventSource is not available in this environment");
    handlers.onError?.(error);
    return () => {};
  }

  const {
    onConnected = () => {},
    onMessage = () => {},
    onComplete = () => {},
    onFailed = () => {},
    onReconnecting = () => {},
    onError = () => {},
  } = handlers;

  let eventSource = null;
  let reconnectCount = 0;
  let isIntentionallyClosed = false;

  const connect = () => {
    try {
      // Get auth token
      const token = getStoredToken();
      if (!token) {
        const error = new Error("No auth token available for SSE connection");
        onError(error);
        return;
      }

      // Build SSE URL with token
      const baseUrl =
        (process.env.NEXT_PUBLIC_API_URL || "") +
        `/api/v1/investigations/${jobId}/stream`;
      const url = `${baseUrl}?token=${encodeURIComponent(token)}`;

      // Create EventSource connection
      eventSource = new EventSource(url);

      // Handle the 'connected' named event
      eventSource.addEventListener(SSE_EVENT_TYPES.CONNECTED, () => {
        reconnectCount = 0; // Reset on successful connect
        onConnected();
      });

      // Handle named completion/failure events emitted by server
      eventSource.addEventListener(SSE_EVENT_TYPES.COMPLETE, (event) => {
        const data = safeParseJSON(event.data) || {};
        onComplete(data);
        isIntentionallyClosed = true;
        disconnect();
      });

      eventSource.addEventListener(SSE_EVENT_TYPES.FAILED, (event) => {
        const data = safeParseJSON(event.data) || {};
        onFailed(data);
        isIntentionallyClosed = true;
        disconnect();
      });

      // Handle default message events (progress updates)
      eventSource.onmessage = (event) => {
        const data = safeParseJSON(event.data);
        if (!data) return;

        // Regular message
        onMessage(data);
      };

      // Handle errors and reconnection logic
      eventSource.onerror = () => {
        if (isIntentionallyClosed) return;

        // Check if connection is closed
        if (eventSource?.readyState === EventSource.CLOSED) {
          if (reconnectCount < MAX_RECONNECT_ATTEMPTS) {
            reconnectCount++;
            onReconnecting(reconnectCount);

            // Exponential backoff: multiply base delay by attempt number
            const delayMs = RECONNECT_DELAY_MS * reconnectCount;
            setTimeout(connect, delayMs);
          } else {
            isIntentionallyClosed = true;
            const error = new Error(
              `SSE connection failed after ${MAX_RECONNECT_ATTEMPTS} reconnection attempts`
            );
            onError(error);
          }
        }
      };
    } catch (err) {
      isIntentionallyClosed = true;
      onError(err);
    }
  };

  /**
   * Disconnect function to cleanly close the SSE connection
   */
  const disconnect = () => {
    isIntentionallyClosed = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  // Start the connection immediately
  connect();

  return disconnect;
}
