import Investigation from "../models/investigation.model.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import {
  startNightInvestigation,
  getInvestigationWithEvidence,
} from "../services/investigation.service.js";
import { logAudit } from "../utils/audit.js";

export const startInvestigation = async (req, res) => {
  const nightDate =
    req.body?.nightDate || new Date().toISOString().split("T")[0];
  const result = await startNightInvestigation(nightDate);

  logAudit(req, "investigation.started", { type: "Investigation", ...(result.investigationId ? { id: result.investigationId } : {}) }, { nightDate });

  res
    .status(202)
    .json(new ApiResponse(202, result, "Investigation queued successfully"));
};

export const getInvestigation = async (req, res) => {
  const owned = await Investigation.findOne({ _id: req.params.id }).lean();
  if (!owned) throw new ApiError(404, 'Investigation not found');

  const investigation = await getInvestigationWithEvidence(req.params.id);

  res
    .status(200)
    .json(new ApiResponse(200, investigation, "Investigation fetched successfully"));
};
