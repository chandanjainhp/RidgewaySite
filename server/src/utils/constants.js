// ========== EVENT TYPES ==========
export const EVENT_TYPES = {
  FENCE_ALERT: 'fence_alert',
  VEHICLE_DETECTED: 'vehicle_detected',
  BADGE_FAIL: 'badge_fail',
  MOTION_SENSOR: 'motion_sensor',
  LIGHT_ANOMALY: 'light_anomaly',
  DRONE_OBSERVATION: 'drone_observation',
};

export const EVENT_TYPE_VALUES = Object.values(EVENT_TYPES);

// ========== SEVERITY LEVELS ==========
export const SEVERITY_LEVELS = {
  UNKNOWN: 'unknown',
  HARMLESS: 'harmless',
  MONITOR: 'monitor',
  ESCALATE: 'escalate',
  UNCERTAIN: 'uncertain',
};

export const SEVERITY_VALUES = Object.values(SEVERITY_LEVELS);

// ========== INCIDENT STATUS ==========
export const INCIDENT_STATUS = {
  PENDING: 'pending',
  INVESTIGATING: 'investigating',
  COMPLETE: 'complete',
  NEEDS_FOLLOWUP: 'needs_followup',
};

export const INCIDENT_STATUS_VALUES = Object.values(INCIDENT_STATUS);

// ========== INVESTIGATION STATUS ==========
export const INVESTIGATION_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETE: 'complete',
  FAILED: 'failed',
  INCOMPLETE: 'incomplete',
};

export const INVESTIGATION_STATUS_VALUES = Object.values(INVESTIGATION_STATUS);

// ========== BRIEFING STATUS ==========
export const BRIEFING_STATUS = {
  DRAFT: 'draft',
  AGENT_COMPLETE: 'agent_complete',
  MAYA_REVIEWING: 'maya_reviewing',
  APPROVED: 'approved',
};

export const BRIEFING_STATUS_VALUES = Object.values(BRIEFING_STATUS);

// ========== REVIEW DECISIONS ==========
export const REVIEW_DECISIONS = {
  AGREED: 'agreed',
  OVERRIDDEN: 'overridden',
  FLAGGED_FOR_FOLLOWUP: 'flagged_for_followup',
};

export const REVIEW_DECISION_VALUES = Object.values(REVIEW_DECISIONS);

// ========== BRIEFING SECTIONS ==========
export const BRIEFING_SECTIONS = {
  WHAT_HAPPENED: 'what_happened',
  HARMLESS_EVENTS: 'harmless_events',
  ESCALATIONS: 'escalations',
  DRONE_FINDINGS: 'drone_findings',
  FOLLOW_UP_ITEMS: 'follow_up_items',
};

export const BRIEFING_SECTION_VALUES = Object.values(BRIEFING_SECTIONS);

// ========== AI CONFIGURATION ==========
export const AI_CONFIG = {
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOOL_CALLS: 12,
  MAX_TOKENS_PER_CALL: 2000,
  INVESTIGATION_CONCURRENCY: 3,
};

// ========== QUEUE NAMES ==========
export const QUEUE_NAMES = {
  INVESTIGATION_QUEUE: 'investigations',
  EVENT_QUEUE: 'events',
};

// ========== REDIS KEY PREFIXES ==========
export const REDIS_KEY_PREFIXES = {
  AGENT_STATE_PREFIX: 'agent:state:',
  AGENT_CONV_PREFIX: 'agent:conv:',
  SITE_FACTS_PREFIX: 'site:facts:',
  SSE_SUBSCRIBERS_PREFIX: 'sse:subscribers:',
};

// ========== SITE CONFIGURATION ==========
export const SITE_CONFIG = {
  SITE_CENTER_COORDINATES: { lat: 51.505, lng: -0.09 },
  DEFAULT_CORRELATION_RADIUS_METERS: 200,
  BADGE_FAILURE_TIME_WINDOW_MINUTES: 30,
  SPATIAL_CLUSTER_RADIUS_METERS: 200,
  TEMPORAL_CHAIN_WINDOW_MINUTES: 30,
};

// ========== USER ROLES (Legacy) ==========
export const UserRolesEnum = {
  ADMIN: 'admin',
  PROJECT_ADMIN: 'project_admin',
  MEMBER: 'member',
};

export const AvailableUserRole = Object.values(UserRolesEnum);

// ========== TASK STATUS (Legacy) ==========
export const TaskStatusEnum = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

export const AvailableTaskStatues = Object.values(TaskStatusEnum);
