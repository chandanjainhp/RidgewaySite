import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Incident from '../models/incident.model.js';
import Event from '../models/event.model.js';
import Investigation from '../models/investigation.model.js';
import { getLatestBriefing } from '../services/briefing.service.js';
import { dispatchInvestigation } from '../queues/investigation.queue.js';

// Setup MCP server
export const mcpServer = new McpServer(
  {
    name: 'sentinel-mcp',
    version: '1.0.0',
  },
  { capabilities: { tools: {} } }
);

// get_latest_briefing
mcpServer.tool(
  'get_latest_briefing',
  'Returns the most recent morning operational briefing for this site. Use this when the user asks for a summary of last night, what happened overnight, or the current status of the site.',
  {
    date: z.string().optional().describe('Optional night date (YYYY-MM-DD) to get briefing for'),
  },
  async ({ date }, extra) => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const briefing = await getLatestBriefing(targetDate, extra.orgFilter);
      
      if (!briefing) {
        return {
          content: [{ type: 'text', text: `No briefing found for ${targetDate}.` }],
        };
      }
      
      return {
        content: [{ type: 'text', text: JSON.stringify(briefing, null, 2) }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  }
);

// list_incidents
mcpServer.tool(
  'list_incidents',
  'Returns a list of operational incidents detected at this site. Use this when the user asks about incidents, alerts, problems, or security events within a time period.',
  {
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    severity: z.enum(['serious', 'minor', 'harmless', 'uncertain']).optional(),
    status: z.enum(['open', 'investigating', 'reviewed', 'escalated', 'closed']).optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
    skip: z.number().int().min(0).optional().default(0),
  },
  async ({ startDate, endDate, severity, status, limit, skip }, extra) => {
    try {
      const query = { ...extra.orgFilter };
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      if (severity) query.severity = severity;
      if (status) query.status = status;

      const incidents = await Incident.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean();

      const hasMore = incidents.length > limit;
      const results = hasMore ? incidents.slice(0, limit) : incidents;

      return {
        content: [{ type: 'text', text: JSON.stringify({
          incidents: results.map(i => ({
            id: i._id,
            title: i.title,
            description: i.description,
            severity: i.severity || 'uncertain',
            status: i.status,
            detectedAt: i.createdAt,
            resolutionTime: i.resolutionTime,
          })),
          hasMore,
          nextCursor: hasMore ? skip + limit : null
        }, null, 2) }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  }
);

// get_incident
mcpServer.tool(
  'get_incident',
  'Returns complete details for a single incident including all evidence and investigation results. Use this after list_incidents to get full information about a specific incident.',
  {
    incidentId: z.string().length(24, 'incidentId must be a 24-character MongoDB ObjectId'),
  },
  async ({ incidentId }, extra) => {
    try {
      const incident = await Incident.findOne({ _id: incidentId, ...extra.orgFilter })
        .populate('investigationId')
        .lean();
        
      if (!incident) {
        return { isError: true, content: [{ type: 'text', text: `Incident not found: ${incidentId}` }] };
      }
      
      const events = await Event.find({ _id: { $in: incident.eventIds || [] }, ...extra.orgFilter })
        .sort({ timestamp: 1 })
        .lean();
        
      const fallbackInvestigation = incident.investigationId ? null :
        await Investigation.findOne({ incidentId: incident._id, ...extra.orgFilter }).sort({ createdAt: -1 }).lean();
        
      const investigation = incident.investigationId || fallbackInvestigation;

      const detail = {
        id: incident._id,
        title: incident.title,
        description: incident.description,
        status: incident.status,
        events: events.map(e => ({ type: e.type, time: e.timestamp, location: e.location })),
        investigation: investigation ? {
          status: investigation.status,
          classification: investigation.classification,
          evidenceChain: investigation.evidenceChain,
          toolCalls: investigation.toolCallSequence
        } : null
      };

      return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  }
);

// list_events
mcpServer.tool(
  'list_events',
  'Returns raw operational events recorded during an overnight period. Use this when the user asks about specific detections, sensor events, or unreviewed items from a particular night.',
  {
    nightDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    type: z.enum(['motion_detected', 'badge_swipe_fail', 'vehicle_entry', 'fence_alert', 'environmental']).optional(),
    reviewed: z.boolean().optional(),
  },
  async ({ nightDate, type, reviewed }, extra) => {
    try {
      const query = { ...extra.orgFilter };
      
      if (nightDate) {
        const start = new Date(nightDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(nightDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp = { $gte: start, $lte: end };
      }
      
      if (type) query.type = type;
      if (reviewed !== undefined) query.reviewed = reviewed;

      const events = await Event.find(query).sort({ timestamp: -1 }).limit(100).lean();

      return {
        content: [{ type: 'text', text: JSON.stringify(events.map(e => ({
          id: e._id,
          type: e.type,
          timestamp: e.timestamp,
          location: e.location?.name,
          reviewed: e.reviewed
        })), null, 2) }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  }
);

// get_investigation
mcpServer.tool(
  'get_investigation',
  'Returns the results of an AI-driven investigation into an incident. Use this when the user wants to understand why an incident was flagged or what the AI determined about it.',
  {
    investigationId: z.string().length(24, 'investigationId must be a 24-character MongoDB ObjectId'),
  },
  async ({ investigationId }, extra) => {
    try {
      const investigation = await Investigation.findOne({ _id: investigationId, ...extra.orgFilter }).lean();
      
      if (!investigation) {
        return { isError: true, content: [{ type: 'text', text: `Investigation not found: ${investigationId}` }] };
      }

      return { content: [{ type: 'text', text: JSON.stringify(investigation, null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  }
);

// start_investigation
mcpServer.tool(
  'start_investigation',
  'Starts an AI investigation into a specific incident. Use this when the user asks to investigate, analyse, or dig deeper into an incident. Note that investigation takes time to complete.',
  {
    incidentId: z.string().length(24, 'incidentId must be a 24-character MongoDB ObjectId'),
  },
  async ({ incidentId }, extra) => {
    try {
      const incident = await Incident.findOne({ _id: incidentId, ...extra.orgFilter });
      if (!incident) {
        return { isError: true, content: [{ type: 'text', text: `Incident not found: ${incidentId}` }] };
      }

      // Create pending investigation
      const newInv = await Investigation.create({
        incidentId: incident._id,
        orgId: extra.orgFilter.orgId,
        status: 'pending',
      });
      
      incident.investigationId = newInv._id;
      incident.status = 'investigating';
      await incident.save();

      // Dispatch job
      await dispatchInvestigation(incident._id.toString(), 3, newInv._id.toString(), {
        investigationId: newInv._id.toString(),
        nightDate: incident.nightDate || new Date().toISOString().split('T')[0],
        orgId: extra.orgFilter.orgId
      });

      return {
        content: [{ type: 'text', text: JSON.stringify({
          message: "Investigation queued successfully.",
          investigationId: newInv._id
        }, null, 2) }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  }
);

// get_site_status
mcpServer.tool(
  'get_site_status',
  'Returns a high-level overview of the current operational status of this site. Use this when the user asks for a status update, how the site is doing, or wants a quick summary without full briefing detail.',
  {},
  async (_, extra) => {
    try {
      const nightDate = new Date().toISOString().split('T')[0];
      const { start, end } = (() => {
        const s = new Date(nightDate); s.setHours(0,0,0,0);
        const e = new Date(nightDate); e.setHours(23,59,59,999);
        return { start: s, end: e };
      })();
      
      const [activeIncidents, unreviewedEvents, briefing] = await Promise.all([
        Incident.countDocuments({ status: { $in: ['open', 'investigating', 'escalated'] }, ...extra.orgFilter }),
        Event.countDocuments({ timestamp: { $gte: start, $lte: end }, reviewed: false, ...extra.orgFilter }),
        getLatestBriefing(nightDate, extra.orgFilter)
      ]);

      return {
        content: [{ type: 'text', text: JSON.stringify({
          activeIncidents,
          unreviewedEventsLastNight: unreviewedEvents,
          dronePatrolStatus: "active",
          latestBriefingStatus: briefing ? briefing.status : "pending"
        }, null, 2) }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  }
);
