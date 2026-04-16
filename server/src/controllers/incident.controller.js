const asyncHandler = require('../utils/async-handler');
const ApiResponse = require('../utils/api-response');
const ApiError = require('../utils/api-error');
const Incident = require('../models/incident.model');

// Create incident
const createIncident = asyncHandler(async (req, res) => {
  const { incidentId, events, severity, title, description, tags } = req.body;

  const incident = await Incident.create({
    incidentId,
    events,
    severity,
    title,
    description,
    tags,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, incident, 'Incident created successfully'));
});

// Get all incidents
const getIncidents = asyncHandler(async (req, res) => {
  const { status, severity, limit = 10, offset = 0 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (severity) query.severity = severity;

  const incidents = await Incident.find(query)
    .populate('events')
    .populate('assignedTo', 'name email')
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .sort({ createdAt: -1 });

  const total = await Incident.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(200, { incidents, total, limit, offset }, 'Incidents fetched successfully')
  );
});

// Get incident by ID
const getIncidentById = asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const incident = await Incident.findById(incidentId)
    .populate('events')
    .populate('assignedTo', 'name email');

  if (!incident) {
    throw new ApiError(404, 'Incident not found');
  }

  return res.status(200).json(new ApiResponse(200, incident, 'Incident fetched successfully'));
});

// Update incident
const updateIncident = asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const { status, assignedTo, severity, description } = req.body;

  const updateData = {};
  if (status) updateData.status = status;
  if (assignedTo) updateData.assignedTo = assignedTo;
  if (severity) updateData.severity = severity;
  if (description) updateData.description = description;

  if (status === 'resolved' || status === 'closed') {
    updateData.resolvedAt = new Date();
  }

  const incident = await Incident.findByIdAndUpdate(incidentId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!incident) {
    throw new ApiError(404, 'Incident not found');
  }

  return res.status(200).json(new ApiResponse(200, incident, 'Incident updated successfully'));
});

// Delete incident
const deleteIncident = asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const incident = await Incident.findByIdAndDelete(incidentId);

  if (!incident) {
    throw new ApiError(404, 'Incident not found');
  }

  return res.status(200).json(new ApiResponse(200, null, 'Incident deleted successfully'));
});

module.exports = {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  deleteIncident,
};
