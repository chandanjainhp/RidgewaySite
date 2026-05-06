import Briefing from "../models/briefing.model.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import {
  getLatestBriefing as getLatestBriefingService,
  applyBriefingReview,
} from "../services/briefing.service.js";
import { logAudit } from "../utils/audit.js";
import { triggerWebhook } from "../services/webhook.service.js";

const sectionKeyMap = {
  whatHappened: "executive_summary",
  harmlessEvents: "incidents",
  escalations: "incidents",
  droneFindings: "anomalies",
  followUpItems: "follow_up",
};

const extractSectionText = (value) => {
  if (value == null) return "No content available.";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") return parsed;
        if (parsed?.overview) return parsed.overview;
        if (parsed?.summary) return parsed.summary;
        if (parsed?.content) return parsed.content;
        if (parsed?.text) return parsed.text;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (typeof value === "object") {
    return (
      value.overview ||
      value.summary ||
      value.content ||
      value.text ||
      "No content available."
    );
  }

  return String(value);
};

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
        agentDraft: extractSectionText(executive.agentDraft),
        mayaVersion: executive.mayaVersion
          ? extractSectionText(executive.mayaVersion)
          : null,
        isEdited: executive.isEdited || false,
      },
      harmlessEvents: {
        agentDraft: extractSectionText(
          incidents.agentDraft?.harmlessEvents ||
            incidents.agentDraft?.harmless?.summary ||
            incidents.agentDraft ||
            ""
        ),
        mayaVersion: incidents.mayaVersion
          ? extractSectionText(incidents.mayaVersion)
          : null,
        isEdited: incidents.isEdited || false,
      },
      escalations: {
        items: [],
        agentDraft: extractSectionText(
          incidents.agentDraft?.escalations || incidents.agentDraft || ""
        ),
        mayaVersion: incidents.mayaVersion
          ? extractSectionText(incidents.mayaVersion)
          : null,
        isEdited: incidents.isEdited || false,
      },
      droneFindings: {
        agentDraft: extractSectionText(anomalies.agentDraft),
        mayaVersion: anomalies.mayaVersion
          ? extractSectionText(anomalies.mayaVersion)
          : null,
        isEdited: anomalies.isEdited || false,
      },
      followUpItems: {
        agentDraft: extractSectionText(
          followUp.agentDraft || recommendations.agentDraft || ""
        ),
        mayaVersion: followUp.mayaVersion
          ? extractSectionText(followUp.mayaVersion)
          : null,
        isEdited: followUp.isEdited || false,
      },
    },
  };
};

export const getLatestBriefing = async (req, res) => {
  const nightDate = req.query.nightDate || new Date().toISOString().split("T")[0];
  const briefing = await getLatestBriefingService(nightDate, req.orgFilter);

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

  const briefing = await Briefing.findOne({ _id: id, ...req.orgFilter });
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

  logAudit(req, "briefing.section_updated", { type: "Briefing", id: briefing._id }, { sectionName });

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
    req.user?._id,
    req.orgFilter
  );

  logAudit(req, "briefing.approved", { type: "Briefing", id: updated._id });

  triggerWebhook(req.user.orgId, "briefing.ready", {
    briefingId: updated._id,
    nightDate: updated.nightDate,
    status: updated.status,
    timestamp: updated.reviewedAt || new Date(),
  });

  res
    .status(200)
    .json(new ApiResponse(200, updated, "Briefing approved successfully"));
};
