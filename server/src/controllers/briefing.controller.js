const asyncHandler = require('../utils/async-handler');
const ApiResponse = require('../utils/api-response');
const ApiError = require('../utils/api-error');
const Briefing = require('../models/briefing.model');

// Create briefing
const createBriefing = asyncHandler(async (req, res) => {
  const { briefingId, investigation, title, summary, highlights, audience, attachments } = req.body;

  const briefing = await Briefing.create({
    briefingId,
    investigation,
    title,
    summary,
    highlights,
    audience,
    attachments,
    aiGenerated: req.body.aiGenerated || true,
    generatedBy: req.body.generatedBy || 'system',
  });

  return res
    .status(201)
    .json(new ApiResponse(201, briefing, 'Briefing created successfully'));
});

// Get briefings
const getBriefings = asyncHandler(async (req, res) => {
  const { audience, limit = 10, offset = 0 } = req.query;

  const query = {};
  if (audience) query.audience = audience;

  const briefings = await Briefing.find(query)
    .populate('investigation')
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .sort({ createdAt: -1 });

  const total = await Briefing.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(200, { briefings, total, limit, offset }, 'Briefings fetched successfully')
  );
});

// Get briefing by ID
const getBriefingById = asyncHandler(async (req, res) => {
  const { briefingId } = req.params;
  const briefing = await Briefing.findById(briefingId)
    .populate('investigation');

  if (!briefing) {
    throw new ApiError(404, 'Briefing not found');
  }

  return res.status(200).json(new ApiResponse(200, briefing, 'Briefing fetched successfully'));
});

// Update briefing
const updateBriefing = asyncHandler(async (req, res) => {
  const { briefingId } = req.params;
  const { title, summary, highlights, attachments } = req.body;

  const updateData = {};
  if (title) updateData.title = title;
  if (summary) updateData.summary = summary;
  if (highlights) updateData.highlights = highlights;
  if (attachments) updateData.attachments = attachments;

  const briefing = await Briefing.findByIdAndUpdate(briefingId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!briefing) {
    throw new ApiError(404, 'Briefing not found');
  }

  return res.status(200).json(new ApiResponse(200, briefing, 'Briefing updated successfully'));
});

// Delete briefing
const deleteBriefing = asyncHandler(async (req, res) => {
  const { briefingId } = req.params;
  const briefing = await Briefing.findByIdAndDelete(briefingId);

  if (!briefing) {
    throw new ApiError(404, 'Briefing not found');
  }

  return res.status(200).json(new ApiResponse(200, null, 'Briefing deleted successfully'));
});

module.exports = {
  createBriefing,
  getBriefings,
  getBriefingById,
  updateBriefing,
  deleteBriefing,
};
