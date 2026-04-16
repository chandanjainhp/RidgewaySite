const asyncHandler = require('../utils/async-handler');
const ApiResponse = require('../utils/api-response');
const ApiError = require('../utils/api-error');
const Investigation = require('../models/investigation.model');

// Create investigation
const createInvestigation = asyncHandler(async (req, res) => {
  const { investigationId, incident, aiAgent } = req.body;

  const investigation = await Investigation.create({
    investigationId,
    incident,
    aiAgent,
    status: 'pending',
  });

  return res
    .status(201)
    .json(new ApiResponse(201, investigation, 'Investigation created successfully'));
});

// Get investigations
const getInvestigations = asyncHandler(async (req, res) => {
  const { status, limit = 10, offset = 0 } = req.query;

  const query = {};
  if (status) query.status = status;

  const investigations = await Investigation.find(query)
    .populate('incident')
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .sort({ createdAt: -1 });

  const total = await Investigation.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(200, { investigations, total, limit, offset }, 'Investigations fetched successfully')
  );
});

// Get investigation by ID
const getInvestigationById = asyncHandler(async (req, res) => {
  const { investigationId } = req.params;
  const investigation = await Investigation.findById(investigationId)
    .populate('incident');

  if (!investigation) {
    throw new ApiError(404, 'Investigation not found');
  }

  return res.status(200).json(new ApiResponse(200, investigation, 'Investigation fetched successfully'));
});

// Update investigation findings
const updateInvestigationFindings = asyncHandler(async (req, res) => {
  const { investigationId } = req.params;
  const { findings, rootCause, recommendedActions, status } = req.body;

  const updateData = {};
  if (findings) updateData.findings = findings;
  if (rootCause) updateData.rootCause = rootCause;
  if (recommendedActions) updateData.recommendedActions = recommendedActions;
  if (status) updateData.status = status;

  const investigation = await Investigation.findByIdAndUpdate(
    investigationId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!investigation) {
    throw new ApiError(404, 'Investigation not found');
  }

  return res.status(200).json(new ApiResponse(200, investigation, 'Investigation updated successfully'));
});

// Add execution log
const addExecutionLog = asyncHandler(async (req, res) => {
  const { investigationId } = req.params;
  const { action, result } = req.body;

  const investigation = await Investigation.findByIdAndUpdate(
    investigationId,
    {
      $push: {
        executionLogs: {
          timestamp: new Date(),
          action,
          result,
        },
      },
    },
    { new: true }
  );

  if (!investigation) {
    throw new ApiError(404, 'Investigation not found');
  }

  return res.status(200).json(new ApiResponse(200, investigation, 'Execution log added successfully'));
});

module.exports = {
  createInvestigation,
  getInvestigations,
  getInvestigationById,
  updateInvestigationFindings,
  addExecutionLog,
};
