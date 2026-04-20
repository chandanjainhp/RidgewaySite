import Event from "../models/event.model.js";
import Incident from "../models/incident.model.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import {
  getEventsForNight as getEventsForNightService,
  applyMayaReview as applyMayaReviewService,
} from "../services/event.service.js";

export const getEventsForNight = async (req, res) => {
  const nightDate = req.query.nightDate || new Date().toISOString().split("T")[0];
  const grouped = await getEventsForNightService(nightDate);
  const events = [...Object.values(grouped.byIncident).flat(), ...grouped.unincorporated];

  res
    .status(200)
    .json(new ApiResponse(200, events, "Events fetched successfully"));
};

export const getEventById = async (req, res) => {
  const event = await Event.findById(req.params.id).lean();

  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, event, "Event fetched successfully"));
};

export const applyMayaReview = async (req, res) => {
  let targetEventId = req.params.id;
  const event = await Event.findById(targetEventId).lean();

  if (!event) {
    const incident = await Incident.findById(req.params.id).lean();
    if (!incident?.eventIds?.length) {
      throw new ApiError(404, "Event or incident not found");
    }

    targetEventId = incident.eventIds[0].toString();
  }

  const review = await applyMayaReviewService(targetEventId, req.body, req.user?._id);

  res
    .status(200)
    .json(new ApiResponse(200, review, "Review applied successfully"));
};
