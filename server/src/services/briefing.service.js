import Briefing from "../models/briefing.model.js";
import Review from "../models/review.model.js";
import Investigation from "../models/investigation.model.js";
import { ApiError } from "../utils/api-error.js";

const getNightRange = (nightDate) => {
  const start = new Date(nightDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(nightDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const wrapSection = (agentDraft) => ({
  agentDraft,
  mayaVersion: null,
  isEdited: false,
});

export const generateBriefing = async (nightDate) => {
  try {
    const { start, end } = getNightRange(nightDate);
    const investigations = await Investigation.find({
      nightDate: { $gte: start, $lte: end },
      status: "complete",
    })
      .populate("incidentId")
      .lean();

    if (investigations.length === 0) {
      return null;
    }

    const severityBuckets = {
      escalate: [],
      monitor: [],
      harmless: [],
      uncertain: [],
    };

    for (const investigation of investigations) {
      const severity = investigation.finalClassification?.severity || "uncertain";
      severityBuckets[severity]?.push(investigation);
    }

    const executiveSummary = {
      overview: `Overnight investigation completed. ${severityBuckets.escalate.length} escalations, ${severityBuckets.monitor.length} monitor-only incidents.`,
      keyMetrics: {
        totalInvestigations: investigations.length,
        escalations: severityBuckets.escalate.length,
        monitoring: severityBuckets.monitor.length,
        harmless: severityBuckets.harmless.length,
      },
    };

    const incidentsSection = {
      escalations: {
        count: severityBuckets.escalate.length,
        items: severityBuckets.escalate.map((investigation) => ({
          title: investigation.incidentId?.title || "Unnamed incident",
          severity: investigation.finalClassification?.severity || "unknown",
          confidence: investigation.finalClassification?.confidence || 0,
          reasoning: investigation.finalClassification?.reasoning || "",
          requiredAction: "Immediate review recommended",
        })),
      },
      harmless: {
        count: severityBuckets.harmless.length,
        summary: `${severityBuckets.harmless.length} incidents confirmed harmless.`,
      },
    };

    const recommendations = {
      immediateActions: severityBuckets.escalate.map((investigation) => ({
        action: "Site security review",
        reason: investigation.finalClassification?.reasoning || "Escalation detected",
      })),
    };

    const anomalies = {
      lowConfidence: investigations
        .filter((investigation) => (investigation.finalClassification?.confidence || 0) < 0.6)
        .map((investigation) => investigation.incidentId?.title || "Unnamed incident"),
    };

    const followUp = {
      items: investigations
        .flatMap((investigation) => investigation.finalClassification?.uncertainties || [])
        .slice(0, 5),
    };

    const existing = await Briefing.findOne({
      nightDate: { $gte: start, $lte: end },
    }).sort({ generatedAt: -1 });

    if (existing) {
      existing.generatedAt = new Date();
      existing.status = "pending_review";
      existing.sections = {
        executive_summary: wrapSection(executiveSummary),
        incidents: wrapSection(incidentsSection),
        recommendations: wrapSection(recommendations),
        anomalies: wrapSection(anomalies),
        follow_up: wrapSection(followUp),
      };
      existing.metadata = {
        investigationCount: investigations.length,
        totalTokensUsed: investigations.reduce(
          (sum, investigation) =>
            sum +
            (investigation.tokenUsage?.inputTokens || 0) +
            (investigation.tokenUsage?.outputTokens || 0),
          0
        ),
      };
      await existing.save();
      return existing;
    }

    return Briefing.create({
      briefingId: `BR-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nightDate: start,
      generatedAt: new Date(),
      status: "pending_review",
      sections: {
        executive_summary: wrapSection(executiveSummary),
        incidents: wrapSection(incidentsSection),
        recommendations: wrapSection(recommendations),
        anomalies: wrapSection(anomalies),
        follow_up: wrapSection(followUp),
      },
      metadata: {
        investigationCount: investigations.length,
        totalTokensUsed: investigations.reduce(
          (sum, investigation) =>
            sum +
            (investigation.tokenUsage?.inputTokens || 0) +
            (investigation.tokenUsage?.outputTokens || 0),
          0
        ),
      },
    });
  } catch (error) {
    throw new ApiError(500, "Failed to generate briefing", [error.message]);
  }
};

export const getLatestBriefing = async (nightDate) => {
  try {
    const { start, end } = getNightRange(nightDate);
    return (
      (await Briefing.findOne({
        nightDate: { $gte: start, $lte: end },
      })
        .sort({ generatedAt: -1 })
        .lean()) || null
    );
  } catch (error) {
    throw new ApiError(500, "Failed to retrieve latest briefing", [error.message]);
  }
};

export const applyBriefingReview = async (briefingId, reviewData, reviewerId) => {
  try {
    const briefing = await Briefing.findById(briefingId);
    if (!briefing) {
      throw new ApiError(404, `Briefing not found: ${briefingId}`);
    }

    const review = await Review.create({
      reviewId: `REVIEW-${briefingId}-${Date.now()}`,
      briefingId,
      reviewer: reviewerId,
      verdict: reviewData.decision,
      comments: reviewData.notes || "",
      overrides: reviewData.overrides || {},
      reviewedAt: new Date(),
    });

    briefing.status =
      reviewData.decision === "needs_revision" ? "pending_revision" : "approved";
    briefing.reviewedAt = new Date();
    briefing.reviewedBy = reviewerId;
    briefing.lastReview = review._id;
    await briefing.save();

    return briefing.toJSON();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, "Failed to apply briefing review", [error.message]);
  }
};

export default {
  generateBriefing,
  getLatestBriefing,
  applyBriefingReview,
};
