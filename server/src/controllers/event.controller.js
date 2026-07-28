import Event from "../models/event.model.js";
import Incident from "../models/incident.model.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import {
  getEventsForNight as getEventsForNightService,
} from "../services/event.service.js";
import { logAudit } from "../utils/audit.js";
import { getCorrelationQueue } from "../queues/event.queue.js";

export const getEventsForNight = async (req, res) => {
  const nightDate = req.query.nightDate || new Date().toISOString().split("T")[0];
  const grouped = await getEventsForNightService(nightDate, req.orgFilter);
  const events = [...Object.values(grouped.byIncident).flat(), ...grouped.unincorporated];

  res
    .status(200)
    .json(new ApiResponse(200, events, "Events fetched successfully"));
};

export const ingestEvents = async (req, res) => {
  const eventsData = Array.isArray(req.body) ? req.body : [req.body];
  const nightDateString = req.query.nightDate || new Date().toISOString().split('T')[0];

  const eventsToInsert = eventsData.map((e) => ({
    ...e,
    orgId: req.user.orgId,
    nightDate: nightDateString,
    timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    eventId: e.eventId || `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }));

  const inserted = await Event.insertMany(eventsToInsert, { ordered: false });

  const correlationQueue = getCorrelationQueue();
  await correlationQueue.add('correlate', { orgId: req.user.orgId, nightDate: nightDateString }, {
    jobId: `correlate:${req.user.orgId}:${nightDateString}`,
    delay: 60_000,
    removeOnComplete: true,
  });

  res.status(201).json(new ApiResponse(201, { count: inserted.length, eventIds: inserted.map((e) => e._id) }, 'Events ingested successfully'));
};

export const getEventById = async (req, res) => {
  const event = await Event.findOne({ _id: req.params.id, ...req.orgFilter }).lean();

  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, event, "Event fetched successfully"));
};
