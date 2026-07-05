export const EVENT_TYPE_CONFIG = {
  fence_alert: { label: "Fence Alert", icon: "shield-alert" },
  vehicle_entry: { label: "Vehicle Entry", icon: "truck" },
  badge_swipe_fail: { label: "Badge Swipe Fail", icon: "key-round" },
  motion_detected: { label: "Motion Detected", icon: "activity" },
  environmental: { label: "Environmental", icon: "zap" },
};

export const AGENT_FEED_TYPES = {
  tool_called: { label: "Tool Call", color: "text-agent-blue" },
  tool_result: { label: "Data Retrieved", color: "text-text-primary" },
  reasoning: { label: "Reasoning", color: "text-text-secondary" },
  classification: { label: "Classified", color: "text-indigo-400" }, // Dynamically overridden in rendering by severity
  error: { label: "Error", color: "text-red-400" },
};

export const INVESTIGATION_STATUS = {
  queued: { label: "Queued", colorClass: "text-slate-400" },
  running: { label: "Running", colorClass: "text-agent-blue animate-pulse" },
  complete: { label: "Complete", colorClass: "text-green-400" },
  failed: { label: "Failed", colorClass: "text-red-400" },
};

export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
export const SITE_CENTER = { lat: 51.505, lng: -0.09 };
export const DEFAULT_MAP_ZOOM = 16;
