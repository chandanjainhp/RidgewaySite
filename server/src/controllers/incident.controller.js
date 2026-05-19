import Incident from "../models/incident.model.js";
import Event from "../models/event.model.js";
import Investigation from "../models/investigation.model.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import OutboxEvent from "../models/outboxEvent.model.js";

const OUTBOX_ENABLED = process.env.OUTBOX_ENABLED === 'true';

const startAndEndOfNight = (nightDate) => {
  const start = new Date(nightDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(nightDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const toIncidentSummary = (incident) => ({
  id: incident._id.toString(),
  incidentId: incident.incidentId || incident._id.toString(),
  title: incident.title,
  description: incident.description,
  severity: incident.severity || 'uncertain',
  status: incident.status,
  priority: incident.priority,
  location: incident.location,
});

const mapSignificanceToConfidence = (significance) => {
  if (significance === "critical") return "high";
  if (significance === "supporting") return "medium";
  if (significance === "inconclusive") return "low";
  return "low";
};

const summarizeToolResult = (toolName, toolResult) => {
  const result = toolResult || {};

  if (typeof result === "string") {
    return result;
  }

  if (result?.message) return result.message;
  if (result?.reasoning) return result.reasoning;
  if (result?.summary) return result.summary;
  if (result?.error) return `Tool returned error: ${result.error}`;

  if (result?.success === false) {
    return `${toolName} returned an unsuccessful result.`;
  }

  return `${toolName} executed and contributed evidence to the investigation.`;
};

export const createIncident = async (req, res) => {
  const incident = new Incident({ ...req.body, orgId: req.user.orgId });
  const savedIncident = await incident.save();

  const webhookPayload = {
    incidentId: savedIncident._id,
    severity: savedIncident.severity,
    summary: savedIncident.title || savedIncident.description,
    timestamp: savedIncident.createdAt,
  };
  if (OUTBOX_ENABLED) {
    await OutboxEvent.create({ orgId: req.user.orgId, eventType: 'incident.created', payload: webhookPayload, status: 'pending' });
  } else {
    const { triggerWebhook } = await import('../services/webhook.service.js');
    triggerWebhook(req.user.orgId, 'incident.created', webhookPayload);
  }

  return res.status(201).json(new ApiResponse(201, savedIncident, "Incident reported successfully"));
};

export const getIncidents = async (req, res) => {
  const { nightDate, status, severity } = req.query;
  const query = {};

  if (nightDate) {
    const { start, end } = startAndEndOfNight(nightDate);
    query.nightDate = { $gte: start, $lte: end };
  }

  if (status) {
    query.status = status;
  }

  if (severity) {
    query.severity = severity;
  }

  Object.assign(query, req.orgFilter);

  const incidents = await Incident.find(query).sort({
    priority: 1,
    createdAt: -1,
  });

  res.status(200).json(
    new ApiResponse(
      200,
      incidents.map(toIncidentSummary),
      "Incidents fetched successfully"
    )
  );
};

export const getIncidentById = async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...req.orgFilter })
    .populate("investigationId")
    .lean();

  if (!incident) {
    throw new ApiError(404, "Incident not found");
  }

  const [events, fallbackInvestigation] = await Promise.all([
    Event.find({ _id: { $in: incident.eventIds || [] }, ...req.orgFilter }).sort({ timestamp: 1 }).lean(),
    incident.investigationId
      ? Promise.resolve(null)
      : Investigation.findOne({ incidentId: incident._id, ...req.orgFilter }).sort({ createdAt: -1 }).lean(),
  ]);

  const investigation = incident.investigationId || fallbackInvestigation || null;

  const detail = {
    ...toIncidentSummary(incident),
    investigationId: investigation,
    entities: incident.entityInvolved ? [incident.entityInvolved] : [],
    rawEvents: events.map((event) => ({
      id: event._id.toString(),
      time: event.timestamp?.toISOString?.().split("T")[1]?.slice(0, 5),
      description: event.description || event.type,
      type: event.type,
      severity: event.severity,
      location: event.location,
    })),
    classification: investigation?.classification || {
      severity: incident.severity || 'uncertain',
      confidence: 0,
      reasoning: incident.agentSummary || '',
      uncertainties: [],
    },
  };

  res
    .status(200)
    .json(new ApiResponse(200, detail, "Incident fetched successfully"));
};

export const getIncidentEvidenceGraph = async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...req.orgFilter })
    .populate("investigationId")
    .lean();

  if (!incident) {
    throw new ApiError(404, "Incident not found");
  }

  const fallbackInvestigation = incident.investigationId
    ? null
    : await Investigation.findOne({ incidentId: incident._id, ...req.orgFilter })
        .sort({ createdAt: -1 })
        .lean();

  const investigation = incident.investigationId || fallbackInvestigation || null;

  const evidenceFromChain =
    investigation?.evidenceChain?.map((step) => ({
      id: `${req.params.id}-${step.step}`,
      step: step.step,
      source: step.source,
      finding: step.finding,
      confidence: step.confidence,
      title: step.source,
      summary: step.finding,
    })) || [];

  const evidenceFromToolCalls =
    investigation?.toolCallSequence?.map((call, index) => ({
      id: `${req.params.id}-tool-${index + 1}`,
      step: index + 1,
      finding: summarizeToolResult(call.toolName, call.toolResult),
      source: call.toolName,
      confidence: mapSignificanceToConfidence(call.significance),
      title: call.toolName,
      summary: summarizeToolResult(call.toolName, call.toolResult),
    })) || [];

  const graph = {
    steps: evidenceFromChain.length > 0 ? evidenceFromChain : evidenceFromToolCalls,
    classification: investigation?.classification || null,
    investigationId: investigation?._id || null,
  };

  res
    .status(200)
    .json(new ApiResponse(200, graph, "Evidence graph fetched successfully"));
};
