export const SEVERITY_CONFIG = {
  harmless: { label: 'Harmless', color: '#22c55e', bgClass: 'bg-green-900/30', textClass: 'text-green-400', borderClass: 'border-green-800', pinColor: 'green' },
  monitor: { label: 'Monitor', color: '#f59e0b', bgClass: 'bg-amber-900/30', textClass: 'text-amber-400', borderClass: 'border-amber-800', pinColor: 'orange' },
  escalate: { label: 'Escalate', color: '#ef4444', bgClass: 'bg-red-900/30', textClass: 'text-red-400', borderClass: 'border-red-800', pinColor: 'red' },
  uncertain: { label: 'Uncertain', color: '#6366f1', bgClass: 'bg-indigo-900/30', textClass: 'text-indigo-400', borderClass: 'border-indigo-800', pinColor: 'purple' },
  unknown: { label: 'Unknown', color: '#4a5568', bgClass: 'bg-slate-800/50', textClass: 'text-slate-400', borderClass: 'border-slate-700', pinColor: 'gray' }
};

export const EVENT_TYPE_CONFIG = {
  fence_alert: { label: 'Fence Alert', icon: 'shield-alert' },
  vehicle_detected: { label: 'Vehicle Detected', icon: 'truck' },
  badge_fail: { label: 'Badge Failure', icon: 'key-round' },
  motion_sensor: { label: 'Motion Sensor', icon: 'activity' },
  light_anomaly: { label: 'Light Anomaly', icon: 'zap' },
  drone_observation: { label: 'Drone Observation', icon: 'scan' }
};

export const AGENT_FEED_TYPES = {
  tool_called: { label: 'Tool Call', color: 'text-agent-blue' },
  tool_result: { label: 'Data Retrieved', color: 'text-text-primary' },
  reasoning: { label: 'Reasoning', color: 'text-text-secondary' },
  classification: { label: 'Classified', color: 'text-indigo-400' }, // Dynamically overridden in rendering by severity
  error: { label: 'Error', color: 'text-red-400' }
};

export const INVESTIGATION_STATUS = {
  queued: { label: 'Queued', colorClass: 'text-slate-400' },
  running: { label: 'Running', colorClass: 'text-agent-blue animate-pulse' },
  complete: { label: 'Complete', colorClass: 'text-green-400' },
  failed: { label: 'Failed', colorClass: 'text-red-400' },
  incomplete: { label: 'Incomplete', colorClass: 'text-amber-400' }
};

export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
export const SITE_CENTER = { lat: 51.505, lng: -0.09 };
export const DEFAULT_MAP_ZOOM = 16;
