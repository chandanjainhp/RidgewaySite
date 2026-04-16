const asyncHandler = require('../utils/async-handler');
const ApiResponse = require('../utils/api-response');
const ApiError = require('../utils/api-error');
const Event = require('../models/event.model');

// Create event
const createEvent = asyncHandler(async (req, res) => {
  const { eventId, type, severity, source, description, location, metadata } = req.body;

  const event = await Event.create({
    eventId,
    type,
    severity,
    source,
    description,
    location,
    metadata,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, event, 'Event created successfully'));
});

// Get all events
const getEvents = asyncHandler(async (req, res) => {
  const { status, severity, limit = 10, offset = 0 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (severity) query.severity = severity;

  const events = await Event.find(query)
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .sort({ timestamp: -1 });

  const total = await Event.countDocuments(query);

  return res
    .status(200)
    .json(new ApiResponse(200, { events, total, limit, offset }, 'Events fetched successfully'));
});

// Get event by ID
const getEventById = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const event = await Event.findById(eventId).populate('correlatedWith');

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  return res.status(200).json(new ApiResponse(200, event, 'Event fetched successfully'));
});

// Update event status
const updateEventStatus = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status } = req.body;

  const event = await Event.findByIdAndUpdate(
    eventId,
    { status },
    { new: true, runValidators: true }
  );

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  return res.status(200).json(new ApiResponse(200, event, 'Event status updated successfully'));
});

// Correlate events
const correlateEvents = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { correlatedEventIds } = req.body;

  const event = await Event.findByIdAndUpdate(
    eventId,
    { $addToSet: { correlatedWith: { $each: correlatedEventIds } } },
    { new: true }
  );

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, event, 'Events correlated successfully'));
});

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEventStatus,
  correlateEvents,
};
