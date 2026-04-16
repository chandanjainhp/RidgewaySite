/*
  MCP-STYLE TOOL REGISTRY FOR AI AGENT

  Defines all tools available to the Claude agent for investigating overnight security incidents.
  Two exports:
  1. TOOLS_FOR_CLAUDE - tool definitions sent to Claude API
  2. executeTool() - dispatcher that executes the selected tool
*/

// Tool definitions for Claude API (no handlers, just schema)
export const TOOLS_FOR_CLAUDE = [
  {
    name: 'get_overnight_alerts',
    description:
      'Returns all security sensor alerts from Ridgeway Site for last night. Use this first to understand the full scope of overnight activity. Returns event type, location, timestamp, and raw sensor data for each alert.',
    input_schema: {
      type: 'object',
      properties: {
        nightDate: {
          type: 'string',
          description: 'ISO date string (optional, defaults to last night)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_vehicle_paths',
    description:
      'Returns movement logs for all vehicles tracked on site last night. Each entry shows vehicle ID, the sequence of locations visited, and timestamps. Use this when investigating vehicle-related alerts.',
    input_schema: {
      type: 'object',
      properties: {
        vehicleId: {
          type: 'string',
          description: 'Optional filter for a specific vehicle ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_badge_swipe_history',
    description:
      'Returns all access control attempts from last night including successes and failures. Groups multiple attempts by the same employee. Use this when investigating access point alerts or repeated failure patterns.',
    input_schema: {
      type: 'object',
      properties: {
        locationName: {
          type: 'string',
          description: 'Optional filter by location name',
        },
        employeeId: {
          type: 'string',
          description: 'Optional filter by employee ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_drone_patrol_log',
    description:
      'Returns the complete drone patrol log for last night. Includes the route flown, timestamp at each waypoint, and field observations. Drone observations are ground truth — always check this after any alert at a location the drone visited.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'correlate_events_by_location',
    description:
      'Given a location name, returns all events that occurred at or near that location last night, sorted by time. Use this to find connections between events that sensors logged separately.',
    input_schema: {
      type: 'object',
      properties: {
        locationName: {
          type: 'string',
          description: 'Required: location name (e.g., "North Gate", "Storage Block A")',
        },
        radiusMeters: {
          type: 'number',
          description: 'Optional: search radius in meters (default 200)',
        },
      },
      required: ['locationName'],
    },
  },
  {
    name: 'classify_incident',
    description:
      'Submits your classification for a specific incident after you have gathered sufficient evidence. Provide the incident ID, your severity classification, confidence score, full reasoning, list of uncertainties, and recommended follow-up if any. Call this once per incident after investigation.',
    input_schema: {
      type: 'object',
      properties: {
        incidentId: {
          type: 'string',
          description: 'Required: incident ID',
        },
        severity: {
          type: 'string',
          enum: ['harmless', 'monitor', 'escalate', 'uncertain'],
          description: 'Required: severity classification',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Required: confidence score 0-1',
        },
        reasoning: {
          type: 'string',
          description: 'Required: full reasoning paragraph explaining the classification',
        },
        uncertainties: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Required: list of uncertainties or things that could not be confirmed (can be empty)',
        },
        recommendedFollowup: {
          type: 'string',
          description: 'Optional: recommended follow-up actions if any',
        },
      },
      required: ['incidentId', 'severity', 'confidence', 'reasoning', 'uncertainties'],
    },
  },
  {
    name: 'draft_briefing_section',
    description:
      'Drafts one section of the morning briefing based on completed classifications. Call this after all incidents are classified. Sections: "whatHappened", "harmlessEvents", "escalations", "droneFindings", "followUpItems". Call once per section.',
    input_schema: {
      type: 'object',
      properties: {
        sectionName: {
          type: 'string',
          enum: ['whatHappened', 'harmlessEvents', 'escalations', 'droneFindings', 'followUpItems'],
          description: 'Required: briefing section to draft',
        },
        incidentIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Required: relevant incident IDs for this section',
        },
      },
      required: ['sectionName', 'incidentIds'],
    },
  },
];

// Tool handlers — implementations of each tool
const toolHandlers = {
  async get_overnight_alerts(input) {
    // TODO: implement with eventService
    // const eventService = require('../services/event.service');
    // return eventService.getOvernightAlerts(input.nightDate);
    console.log('[Tools] get_overnight_alerts called with:', input);
    return {
      success: true,
      alerts: [],
      message: 'Event service integration pending',
    };
  },

  async get_vehicle_paths(input) {
    // TODO: implement with eventService
    // const eventService = require('../services/event.service');
    // return eventService.getVehiclePaths(input.vehicleId);
    console.log('[Tools] get_vehicle_paths called with:', input);
    return {
      success: true,
      vehicles: [],
      message: 'Event service integration pending',
    };
  },

  async get_badge_swipe_history(input) {
    // TODO: implement with eventService
    // const eventService = require('../services/event.service');
    // return eventService.getBadgeSwipeHistory(input);
    console.log('[Tools] get_badge_swipe_history called with:', input);
    return {
      success: true,
      attempts: [],
      message: 'Event service integration pending',
    };
  },

  async get_drone_patrol_log(input) {
    // TODO: implement with eventService
    // const eventService = require('../services/event.service');
    // return eventService.getDronePatrolLog();
    console.log('[Tools] get_drone_patrol_log called');
    return {
      success: true,
      patrols: [],
      message: 'Event service integration pending',
    };
  },

  async correlate_events_by_location(input) {
    // TODO: implement with correlationService
    // const correlationService = require('../services/correlation.service');
    // return correlationService.getEventsByLocation(input.locationName, input.radiusMeters);
    console.log('[Tools] correlate_events_by_location called with:', input);
    return {
      success: true,
      events: [],
      message: 'Correlation service integration pending',
    };
  },

  async classify_incident(input) {
    // TODO: implement with investigationService
    // const investigationService = require('../services/investigation.service');
    // return investigationService.saveClassification(input);
    console.log('[Tools] classify_incident called with:', {
      incidentId: input.incidentId,
      severity: input.severity,
      confidence: input.confidence,
    });
    return {
      success: true,
      incidentId: input.incidentId,
      message: 'Classification saved (service integration pending)',
    };
  },

  async draft_briefing_section(input) {
    // TODO: implement with briefingService
    // const briefingService = require('../services/briefing.service');
    // return briefingService.draftSection(input.sectionName, input.incidentIds);
    console.log('[Tools] draft_briefing_section called with:', {
      sectionName: input.sectionName,
      incidentCount: input.incidentIds?.length || 0,
    });
    return {
      success: true,
      section: input.sectionName,
      content: '',
      message: 'Briefing service integration pending',
    };
  },
};

/**
 * Execute a tool by name with the given input
 * @param {string} toolName - name of the tool to execute
 * @param {object} toolInput - input parameters for the tool
 * @returns {Promise<object>} tool execution result
 */
export const executeTool = async (toolName, toolInput) => {
  const startTime = Date.now();

  try {
    if (!toolHandlers[toolName]) {
      console.error(`[Tools] Unknown tool: ${toolName}`);
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        availableTools: Object.keys(toolHandlers),
      };
    }

    console.log(`[Tools] Executing ${toolName}`, {
      input: JSON.stringify(toolInput),
      timestamp: new Date().toISOString(),
    });

    const result = await toolHandlers[toolName](toolInput);
    const duration = Date.now() - startTime;

    console.log(`[Tools] ${toolName} completed`, {
      duration: `${duration}ms`,
      success: result.success || false,
    });

    return {
      ...result,
      toolName,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Tools] ${toolName} failed:`, {
      error: error.message,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      toolName,
      error: error.message,
      duration,
    };
  }
};

export default {
  TOOLS_FOR_CLAUDE,
  executeTool,
};
