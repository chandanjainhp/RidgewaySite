/*
  MCP-STYLE TOOL REGISTRY FOR AI AGENT

  Defines all tools available to the Claude agent for investigating overnight security incidents.
  Two exports:
  1. TOOLS_FOR_CLAUDE - tool definitions sent to Claude API
  2. executeTool() - dispatcher that executes the selected tool
*/

import {
  getOvernightAlerts,
  getVehiclePaths,
  getBadgeSwipeHistory,
  getDronePatrolLog,
} from '../services/event.service.js';
import { getEventsByLocation } from '../services/correlation.service.js';
import Incident from '../models/incident.model.js';
import { queryVehicleRegistry } from '../tools/vehicleRegistry.tool.js';
import { queryAccessControl } from '../tools/accessControl.tool.js';
import { queryEnvironmentalData } from '../tools/environmentalSensor.tool.js';

const normalizeNightDate = (nightDate) => {
  if (!nightDate) {
    throw new Error('nightDate is required for tool execution');
  }

  const parsed = new Date(nightDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid nightDate: ${nightDate}`);
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

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
  {
    name: 'query_vehicle_registry',
    description:
      'Queries the site vehicle and contractor registry to check if a detected vehicle is authorized to be on site. Call this for any vehicle-related incident. Returns contractor details, authorization status, and previous appearance history. Always call this before classifying any vehicle incident.',
    input_schema: {
      type: 'object',
      properties: {
        vehicleId: {
          type: 'string',
        },
        locationName: {
          type: 'string',
        },
        timeRange: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
            },
            end: {
              type: 'string',
            },
          },
          required: [],
        },
      },
      required: [],
    },
  },
  {
    name: 'query_access_control',
    description:
      'Queries the employee badge and access control system. Call this for any badge failure or personnel access incident. Returns employee identity, authorization status, and any infrastructure issues that might explain failed access attempts. Always call this before classifying badge-related incidents.',
    input_schema: {
      type: 'object',
      properties: {
        badgeId: {
          type: 'string',
        },
        gateId: {
          type: 'string',
        },
        timeRange: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
            },
            end: {
              type: 'string',
            },
          },
          required: [],
        },
      },
      required: [],
    },
  },
  {
    name: 'query_environmental_data',
    description:
      'Queries environmental conditions and sensor health data for a specific location and time. Call this for fence alerts, motion sensor events, or light anomalies. Returns wind speed, temperature, sensor fault history, and false positive rates. Use this to determine if environmental conditions or sensor faults explain an alert before escalating.',
    input_schema: {
      type: 'object',
      properties: {
        locationName: {
          type: 'string',
        },
        timeRange: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
            },
            end: {
              type: 'string',
            },
          },
          required: [],
        },
      },
      required: ['locationName'],
    },
  },
];

// Tool handlers — implementations of each tool
const toolHandlers = {
  async get_overnight_alerts(input, nightDate) {
    const queryNightDate = normalizeNightDate(nightDate || input?.nightDate);
    const alerts = await getOvernightAlerts(queryNightDate);

    return {
      success: true,
      nightDate: queryNightDate.toISOString().split('T')[0],
      alertCount: alerts.length,
      alerts,
      message: `Retrieved ${alerts.length} overnight alerts`,
    };
  },

  async get_vehicle_paths(input, nightDate) {
    const queryNightDate = normalizeNightDate(nightDate || input?.nightDate);
    const vehiclePaths = await getVehiclePaths(input?.vehicleId || null, queryNightDate);

    return {
      success: true,
      nightDate: queryNightDate.toISOString().split('T')[0],
      vehicleCount: vehiclePaths.length,
      vehiclePaths,
      message: `Retrieved movement history for ${vehiclePaths.length} vehicles`,
    };
  },

  async get_badge_swipe_history(input, nightDate) {
    const queryNightDate = normalizeNightDate(nightDate || input?.nightDate);
    const history = await getBadgeSwipeHistory(
      {
        locationName: input?.locationName,
        employeeId: input?.employeeId,
      },
      queryNightDate
    );

    return {
      success: true,
      nightDate: queryNightDate.toISOString().split('T')[0],
      groupedEmployeeCount: history.length,
      history,
      message: `Retrieved badge history for ${history.length} employees`,
    };
  },

  async get_drone_patrol_log(input, nightDate) {
    const queryNightDate = normalizeNightDate(nightDate || input?.nightDate);
    const patrolLog = await getDronePatrolLog(queryNightDate);

    return {
      success: true,
      nightDate: queryNightDate.toISOString().split('T')[0],
      patrolLog,
      message: patrolLog.routeSummary || 'Drone patrol log retrieved',
    };
  },

  async correlate_events_by_location(input, nightDate) {
    const queryNightDate = normalizeNightDate(nightDate || input?.nightDate);
    const locationSummary = await getEventsByLocation(
      input?.locationName,
      input?.radiusMeters || 200,
      queryNightDate
    );

    return {
      success: true,
      nightDate: queryNightDate.toISOString().split('T')[0],
      ...locationSummary,
      message: `Correlated ${locationSummary.eventCount} events around ${input?.locationName}`,
    };
  },

  async classify_incident(input) {
    const incident = await Incident.findById(input.incidentId);

    if (!incident) {
      return {
        success: false,
        error: `Incident not found: ${input.incidentId}`,
      };
    }

    incident.finalSeverity = input.severity;
    incident.agentSummary = input.reasoning;
    await incident.save();

    return {
      success: true,
      incidentId: input.incidentId,
      classification: {
        severity: input.severity,
        confidence: input.confidence,
        reasoning: input.reasoning,
        uncertainties: input.uncertainties || [],
        recommendedFollowup: input.recommendedFollowup || null,
      },
      message: 'Classification accepted and persisted',
    };
  },

  async draft_briefing_section(input) {
    const incidents = await Incident.find({
      _id: { $in: input?.incidentIds || [] },
    })
      .select('title finalSeverity agentSummary primaryLocation')
      .lean();

    const incidentLines = incidents.map((incident) => {
      const location = incident.primaryLocation?.name || 'unknown location';
      const severity = incident.finalSeverity || 'uncertain';
      const summary = incident.agentSummary || 'No summary available';
      return `- ${incident.title} (${severity}) at ${location}: ${summary}`;
    });

    const sectionLabelMap = {
      whatHappened: 'What Happened Overnight',
      harmlessEvents: 'Harmless Events',
      escalations: 'Escalations',
      droneFindings: 'Drone Findings',
      followUpItems: 'Follow-up Items',
    };

    const generatedContent = `${sectionLabelMap[input.sectionName] || input.sectionName}\n${incidentLines.join('\n')}`;

    return {
      success: true,
      section: input.sectionName,
      content: generatedContent,
      incidentCount: incidents.length,
      message: `Drafted section ${input.sectionName} from ${incidents.length} incidents`,
    };
  },

  async query_vehicle_registry(input, nightDate) {
    const result = await queryVehicleRegistry({
      vehicleId: input?.vehicleId,
      locationName: input?.locationName,
      timeRange: input?.timeRange,
      nightDate,
    });

    return {
      success: true,
      nightDate: nightDate ? new Date(nightDate).toISOString().split('T')[0] : null,
      ...result,
      message: 'Vehicle registry query completed',
    };
  },

  async query_access_control(input, nightDate) {
    const result = await queryAccessControl({
      badgeId: input?.badgeId,
      gateId: input?.gateId,
      timeRange: input?.timeRange,
      nightDate,
    });

    return {
      success: true,
      nightDate: nightDate ? new Date(nightDate).toISOString().split('T')[0] : null,
      ...result,
      message: 'Access control query completed',
    };
  },

  async query_environmental_data(input, nightDate) {
    const result = await queryEnvironmentalData(input?.locationName, {
      ...(input?.timeRange || {}),
      nightDate,
    });

    return {
      success: true,
      nightDate: nightDate ? new Date(nightDate).toISOString().split('T')[0] : null,
      ...result,
      message: 'Environmental and sensor health query completed',
    };
  },
};

/**
 * Execute a tool by name with the given input
 * @param {string} toolName - name of the tool to execute
 * @param {object} toolInput - input parameters for the tool
 * @param {Date|string} nightDate - canonical nightDate from investigation context
 * @returns {Promise<object>} tool execution result
 */
export const executeTool = async (toolName, toolInput, nightDate) => {
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
      nightDate: nightDate ? new Date(nightDate).toISOString().split('T')[0] : null,
      timestamp: new Date().toISOString(),
    });

    const result = await toolHandlers[toolName](toolInput, nightDate);
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
