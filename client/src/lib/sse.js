// SSE specific event types 
export const SSE_EVENT_TYPES = {
  TOOL_CALLED: "tool_called",
  TOOL_RESULT: "tool_result",
  REASONING: "reasoning",
  CLASSIFICATION: "classification",
  COMPLETE: "complete",
  FAILED: "failed",
  CONNECTED: "connected",
};

/**
 * Creates and wraps an EventSource connection capable of reconnecting with defined hooks.
 * 
 * @param {string} jobId The associated backend job identifier hooking to stream.
 * @param {Object} handlers Lifecycle hooks: { onMessage, onComplete, onFailed, onConnected, onError }
 */
export function createSSEConnection(jobId, handlers) {
  const { 
    onMessage = () => {}, 
    onComplete = () => {}, 
    onFailed = () => {}, 
    onConnected = () => {}, 
    onError = () => {} 
  } = handlers;

  let eventSource = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECTS = 3;

  const connect = () => {
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "") + `/api/v1/investigations/${jobId}/stream`;
      
      // Attempt resolving local storage token dynamically
      let tokenStr = "";
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("ridgeway_token");
        if (token) tokenStr = `?token=${token}`;
      }

      const url = `${baseUrl}${tokenStr}`;
      eventSource = new EventSource(url);

      // Handle raw messages stream
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onMessage(parsed);
        } catch (err) {
          onError(err);
        }
      };

      // Handle named semantic events mapping to explicit boundaries
      eventSource.addEventListener("connected", () => {
        reconnectAttempts = 0; // reset ping
        onConnected();
      });

      eventSource.addEventListener("complete", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onComplete(parsed);
        } catch (err) {
          onError(err);
        }
        disconnect();
      });

      eventSource.addEventListener("failed", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onFailed(parsed);
        } catch (err) {
          onError(err);
        }
        disconnect();
      });

      // Unified error/closure bounds
      eventSource.onerror = (error) => {
        if (eventSource.readyState === EventSource.CLOSED) {
          if (reconnectAttempts < MAX_RECONNECTS) {
            reconnectAttempts++;
            setTimeout(() => {
              connect();
            }, 3000);
          } else {
            onError(new Error("SSE connection exhausted maximum reconnect attempts."));
          }
        } else {
          onError(error);
        }
      };
    } catch (err) {
      onError(err);
    }
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  // Instantiate connection
  connect();

  return disconnect;
}
