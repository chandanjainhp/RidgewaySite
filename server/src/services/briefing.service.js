import Briefing from "../models/briefing.model.js";
import Review from "../models/review.model.js";
import Investigation from "../models/investigation.model.js";
import "../models/incident.model.js";
import { ApiError } from "../utils/api-error.js";
import { getClaudeClient, getModelName } from "../utils/anthropic.js";

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

const BRIEFING_PROSE_INSTRUCTION =
  "Write the following briefing section as clear plain English prose. Do not use JSON format. Do not use markdown. Write natural paragraphs that Maya can read aloud to the site head Nisha.";

export const extractTextFromResponse = (text) => {
  if (!text) return "No content generated.";
  const trimmed = String(text).trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return (
        parsed.overview ||
        parsed.summary ||
        parsed.content ||
        parsed.text ||
        JSON.stringify(parsed, null, 2)
      );
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

const getFallbackSectionText = (sectionName, investigations, severityBuckets) => {
  const total = investigations.length;
  const escalations = severityBuckets.escalate.length;
  const monitor = severityBuckets.monitor.length;
  const harmless = severityBuckets.harmless.length;

  const incidentList = investigations
    .map((investigation) => {
      const incident = investigation.incidentId;
      const title = incident?.title || "Unnamed incident";
      const location = incident?.primaryLocation?.name || "unknown location";
      const severity = investigation.finalClassification?.severity || "uncertain";
      const reasoning =
        investigation.finalClassification?.reasoning ||
        incident?.agentSummary ||
        "No reasoning provided.";
      return `${title} at ${location} was assessed as ${severity}. ${reasoning}`;
    })
    .join(" ");

  if (sectionName === "whatHappened") {
    return `Overnight investigation completed for ${total} incidents. The team identified ${escalations} escalations, ${monitor} monitor-only items, and ${harmless} harmless events. ${incidentList}`;
  }

  if (sectionName === "harmlessEvents") {
    const harmlessItems = severityBuckets.harmless
      .map((investigation) => investigation.incidentId?.title || "Unnamed incident")
      .join(", ");
    if (!harmlessItems) {
      return "No incidents were fully cleared as harmless during this run.";
    }
    return `The following incidents were assessed as harmless and require no immediate action: ${harmlessItems}.`;
  }

  if (sectionName === "escalations") {
    const escalationItems = severityBuckets.escalate
      .map((investigation) => {
        const title = investigation.incidentId?.title || "Unnamed incident";
        const why = investigation.finalClassification?.reasoning || "Escalation required based on available evidence.";
        return `${title}: ${why}`;
      })
      .join(" ");
    if (!escalationItems) {
      return "No escalation-level incidents were identified overnight.";
    }
    return `Escalation review is required for the following incidents. ${escalationItems}`;
  }

  if (sectionName === "droneFindings") {
    return "Drone patrol observations were incorporated into the investigation where available. No additional drone-only anomalies were flagged outside the correlated incidents.";
  }

  if (sectionName === "followUpItems") {
    const uncertainties = investigations
      .flatMap((investigation) => investigation.finalClassification?.uncertainties || [])
      .filter(Boolean)
      .slice(0, 5);

    if (uncertainties.length === 0) {
      return "No immediate follow-up gaps were recorded by the agent for this night.";
    }

    return `The following follow-up checks are recommended: ${uncertainties.join(" ")}`;
  }

  return "No content generated.";
};

const draftSection = async (sectionName, investigations, severityBuckets) => {
  const sectionTitles = {
    whatHappened: "What Happened Last Night",
    harmlessEvents: "Cleared - No Action Required",
    escalations: "Requires Escalation",
    droneFindings: "Drone Patrol Findings",
    followUpItems: "Requires Follow-Up",
  };

  const inputContext = investigations.map((investigation, index) => {
    const incident = investigation.incidentId;
    const classification = investigation.finalClassification || {};
    return `${index + 1}. Title: ${incident?.title || "Unnamed incident"}; Location: ${incident?.primaryLocation?.name || "unknown"}; Severity: ${classification.severity || "uncertain"}; Confidence: ${classification.confidence ?? 0}; Reasoning: ${classification.reasoning || incident?.agentSummary || "No reasoning"}; Uncertainties: ${(classification.uncertainties || []).join(" | ") || "None"}`;
  });

  const prompt = [
    BRIEFING_PROSE_INSTRUCTION,
    `Section: ${sectionTitles[sectionName] || sectionName}`,
    "Write this as plain English prose paragraphs.",
    "Do not return JSON. Do not return structured data.",
    "Write it as a human would write a morning briefing.",
    "Incident data:",
    ...inputContext,
  ].join("\n");

  try {
    const claude = getClaudeClient();
    const response = await claude.messages.create({
      model: getModelName(),
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const textOutput =
      response?.content?.find((block) => block?.type === "text")?.text ||
      "";

    const extracted = extractTextFromResponse(textOutput);
    return extracted || getFallbackSectionText(sectionName, investigations, severityBuckets);
  } catch {
    return getFallbackSectionText(sectionName, investigations, severityBuckets);
  }
};

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

    const draftedSections = {
      whatHappened: await draftSection("whatHappened", investigations, severityBuckets),
      harmlessEvents: await draftSection("harmlessEvents", investigations, severityBuckets),
      escalations: await draftSection("escalations", investigations, severityBuckets),
      droneFindings: await draftSection("droneFindings", investigations, severityBuckets),
      followUpItems: await draftSection("followUpItems", investigations, severityBuckets),
    };

    const incidentsSection = {
      harmlessEvents: extractTextFromResponse(draftedSections.harmlessEvents),
      escalations: extractTextFromResponse(draftedSections.escalations),
    };

    const existing = await Briefing.findOne({
      nightDate: { $gte: start, $lte: end },
    }).sort({ generatedAt: -1 });

    if (existing) {
      existing.generatedAt = new Date();
      existing.status = "pending_review";
      existing.sections = {
        executive_summary: wrapSection(
          extractTextFromResponse(draftedSections.whatHappened)
        ),
        incidents: wrapSection(incidentsSection),
        recommendations: wrapSection(
          extractTextFromResponse(draftedSections.followUpItems)
        ),
        anomalies: wrapSection(
          extractTextFromResponse(draftedSections.droneFindings)
        ),
        follow_up: wrapSection(
          extractTextFromResponse(draftedSections.followUpItems)
        ),
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
        executive_summary: wrapSection(
          extractTextFromResponse(draftedSections.whatHappened)
        ),
        incidents: wrapSection(incidentsSection),
        recommendations: wrapSection(
          extractTextFromResponse(draftedSections.followUpItems)
        ),
        anomalies: wrapSection(
          extractTextFromResponse(draftedSections.droneFindings)
        ),
        follow_up: wrapSection(
          extractTextFromResponse(draftedSections.followUpItems)
        ),
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
