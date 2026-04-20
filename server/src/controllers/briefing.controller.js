import Briefing from "../models/briefing.model.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import {
  getLatestBriefing as getLatestBriefingService,
  applyBriefingReview,
} from "../services/briefing.service.js";

const sectionKeyMap = {
  whatHappened: "executive_summary",
  harmlessEvents: "incidents",
  escalations: "incidents",
  droneFindings: "anomalies",
  followUpItems: "follow_up",
};

const stringify = (value) =>
  typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2);

const sectionToClientFormat = (briefing) => {
  const executive = briefing.sections?.executive_summary || {};
  const incidents = briefing.sections?.incidents || {};
  const anomalies = briefing.sections?.anomalies || {};
  const followUp = briefing.sections?.follow_up || {};
  const recommendations = briefing.sections?.recommendations || {};

  return {
    id: briefing._id.toString(),
    status: briefing.status === "pending_review" ? "maya_reviewing" : briefing.status,
    approvedAt: briefing.reviewedAt || null,
    sections: {
      whatHappened: {
        agentDraft: stringify(executive.agentDraft),
        mayaVersion: executive.mayaVersion ? stringify(executive.mayaVersion) : null,
        isEdited: executive.isEdited || false,
      },
      harmlessEvents: {
        agentDraft: stringify(incidents.agentDraft?.harmless?.summary || ""),
        mayaVersion: incidents.mayaVersion ? stringify(incidents.mayaVersion) : null,
        isEdited: incidents.isEdited || false,
      },
      escalations: {
        items:
          incidents.agentDraft?.escalations?.items?.map(
            (item) => `${item.title}: ${item.reasoning || item.requiredAction || item.severity}`
          ) || [],
        agentDraft: stringify(incidents.agentDraft?.escalations?.items || []),
        mayaVersion: incidents.mayaVersion ? stringify(incidents.mayaVersion) : null,
        isEdited: incidents.isEdited || false,
      },
      droneFindings: {
        agentDraft: stringify(anomalies.agentDraft),
        mayaVersion: anomalies.mayaVersion ? stringify(anomalies.mayaVersion) : null,
        isEdited: anomalies.isEdited || false,
      },
      followUpItems: {
        agentDraft: stringify(followUp.agentDraft || recommendations.agentDraft || ""),
        mayaVersion: followUp.mayaVersion ? stringify(followUp.mayaVersion) : null,
        isEdited: followUp.isEdited || false,
      },
    },
  };
};

export const getLatestBriefing = async (req, res) => {
  const nightDate = req.query.nightDate || new Date().toISOString().split("T")[0];
  const briefing = await getLatestBriefingService(nightDate);

  if (!briefing) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "No briefing available yet"));
  }

  res.status(200).json(
    new ApiResponse(
      200,
      sectionToClientFormat(briefing),
      "Briefing fetched successfully"
    )
  );
};

export const updateBriefingSection = async (req, res) => {
  const { id } = req.params;
  const sectionName = req.params.sectionName || req.body.sectionName;
  const mappedSection = sectionKeyMap[sectionName];

  if (!mappedSection) {
    throw new ApiError(400, "Invalid section name");
  }

  const briefing = await Briefing.findById(id);
  if (!briefing) {
    throw new ApiError(404, "Briefing not found");
  }

  const existing = briefing.sections?.[mappedSection] || {};
  briefing.sections = briefing.sections || {};
  briefing.sections[mappedSection] = {
    ...existing,
    mayaVersion: req.body.content,
    isEdited: true,
  };

  await briefing.save();

  res.status(200).json(
    new ApiResponse(
      200,
      sectionToClientFormat(briefing.toJSON()),
      "Briefing section updated successfully"
    )
  );
};

export const approveBriefing = async (req, res) => {
  const updated = await applyBriefingReview(
    req.params.id,
    { decision: "approved", notes: "" },
    req.user?._id
  );

  res
    .status(200)
    .json(new ApiResponse(200, updated, "Briefing approved successfully"));
};
