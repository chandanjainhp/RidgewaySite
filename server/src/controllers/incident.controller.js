import Incident from "../models/incident.model.js";
import Event from "../models/event.model.js";
import Investigation from "../models/investigation.model.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";

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
  severity: incident.finalSeverity || incident.severity || "unknown",
  status: incident.status,
  priority: incident.priority,
  primaryLocation: incident.primaryLocation,
  location: incident.primaryLocation,
  raghavsNote: incident.raghavsNote,
});

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
    query.$or = [{ finalSeverity: severity }, { severity }];
  }

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
  const incident = await Incident.findById(req.params.id).lean();

  if (!incident) {
    throw new ApiError(404, "Incident not found");
  }

  const [events, investigation] = await Promise.all([
    Event.find({ _id: { $in: incident.eventIds || [] } }).sort({ timestamp: 1 }).lean(),
    Investigation.findOne({ incidentId: incident._id }).sort({ createdAt: -1 }).lean(),
  ]);

  const detail = {
    ...toIncidentSummary(incident),
    entities: incident.entityInvolved ? [incident.entityInvolved] : [],
    rawEvents: events.map((event) => ({
      id: event._id.toString(),
      time: event.timestamp?.toISOString?.().split("T")[1]?.slice(0, 5),
      description: event.description || event.type,
      type: event.type,
      severity: event.severity,
      location: event.location,
    })),
    finalClassification: investigation?.finalClassification || {
      severity: incident.finalSeverity || incident.severity || "unknown",
      confidence: 0,
      reasoning: incident.agentSummary || "",
      uncertainties: [],
    },
  };

  res
    .status(200)
    .json(new ApiResponse(200, detail, "Incident fetched successfully"));
};

export const getIncidentEvidenceGraph = async (req, res) => {
  const incident = await Incident.findById(req.params.id).lean();

  if (!incident) {
    throw new ApiError(404, "Incident not found");
  }

  const investigation = await Investigation.findOne({ incidentId: incident._id })
    .sort({ createdAt: -1 })
    .lean();

  const graph = {
    steps:
      investigation?.evidenceChain?.map((step) => ({
        id: `${req.params.id}-${step.step}`,
        step: step.step,
        source: step.source,
        finding: step.finding,
        confidence: step.confidence,
        // Keep compatibility for any existing clients using title/summary
        title: step.source,
        summary: step.finding,
      })) || [],
    classification: investigation?.finalClassification || null,
  };

  res
    .status(200)
    .json(new ApiResponse(200, graph, "Evidence graph fetched successfully"));
};
