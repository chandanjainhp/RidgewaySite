import Investigation from "../models/investigation.model.js";
import Incident from "../models/incident.model.js";
import Event from "../models/event.model.js";
import { ApiError } from "../utils/api-error.js";
import { planInvestigations } from "../ai/planner.js";
import { dispatchInvestigation } from "../queues/investigation.queue.js";
import briefingService from "./briefing.service.js";

const getNightRange = (nightDate) => {
  const start = new Date(nightDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(nightDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export const startNightInvestigation = async (nightDate) => {
  try {
    const { start, end } = getNightRange(nightDate);

    const existingJobs = await Investigation.find({
      nightDate: { $gte: start, $lte: end },
    }).lean();

    const activeJobs = existingJobs.filter(
      (job) => job.status === "queued" || job.status === "running"
    );

    if (activeJobs.length > 0) {
      return {
        nightDate,
        totalJobs: activeJobs.length,
        jobIds: activeJobs.map((job) => job.jobId || job._id.toString()),
        status: "already_running",
      };
    }

    const incidents = await Incident.find({
      nightDate: { $gte: start, $lte: end },
      status: "pending",
    }).lean();

    if (incidents.length === 0) {
      const latestCompletedJobs = existingJobs
        .filter((job) => job.status === "complete")
        .map((job) => job.jobId || job._id.toString());

      return {
        nightDate,
        totalJobs: 0,
        jobIds: latestCompletedJobs,
        estimatedMinutes: 0,
        status: latestCompletedJobs.length > 0 ? "already_complete" : "no_incidents",
      };
    }

    const planItems = await planInvestigations(start);
    const plannedInvestigations = Array.isArray(planItems)
      ? planItems
      : planItems?.investigations || [];

    if (plannedInvestigations.length === 0) {
      return {
        nightDate,
        totalJobs: 0,
        jobIds: [],
        estimatedMinutes: 0,
      };
    }

    const jobIds = [];
    let estimatedMinutes = 0;

    for (const plannedIncident of plannedInvestigations) {
      const incidentId = plannedIncident._id || plannedIncident.incidentId;
      const investigation = await Investigation.create({
        incidentId,
        nightDate: start,
        status: "queued",
        toolCallSequence: [],
        evidenceChain: [],
        finalClassification: {
          severity: "uncertain",
          confidence: 0,
          reasoning: "Investigation queued; classification pending.",
          uncertainties: [],
        },
      });

      const job = await dispatchInvestigation(
        incidentId.toString(),
        plannedIncident.priority || 5,
        investigation._id.toString(),
        {
          investigationId: investigation._id.toString(),
          nightDate,
        }
      );

      investigation.jobId = job.id;
      await investigation.save();

      await Incident.findByIdAndUpdate(incidentId, {
        investigationId: investigation._id,
        status: "investigating",
      });

      jobIds.push(job.id);
      estimatedMinutes += plannedIncident.complexity === "high" ? 8 : 5;
    }

    return {
      nightDate,
      totalJobs: jobIds.length,
      jobIds,
      estimatedMinutes,
    };
  } catch (error) {
    throw new ApiError(500, "Failed to start night investigation", [error.message]);
  }
};

export const getInvestigationWithEvidence = async (investigationId) => {
  try {
    const investigation = await Investigation.findById(investigationId)
      .populate({
        path: "incidentId",
        select: "title description eventIds primaryLocation finalSeverity raghavsNote",
      })
      .lean();

    if (!investigation) {
      throw new ApiError(404, `Investigation not found: ${investigationId}`);
    }

    const events = await Event.find({
      _id: { $in: investigation.incidentId?.eventIds || [] },
    })
      .sort({ timestamp: 1 })
      .lean();

    const evidenceChain = (investigation.evidenceChain || []).map((step) => ({
      stepNumber: step.step,
      toolName: step.source,
      evidenceValue: step.finding,
      confidence: step.confidence,
      timestamp: null,
    }));

    return {
      investigationId: investigation._id.toString(),
      incidentId: investigation.incidentId?._id?.toString() || null,
      incidentTitle: investigation.incidentId?.title || "",
      severity: investigation.finalClassification?.severity || "unknown",
      confidence: investigation.finalClassification?.confidence || 0,
      reasoning: investigation.finalClassification?.reasoning || "",
      uncertainties: investigation.finalClassification?.uncertainties || [],
      status: investigation.status,
      startedAt: investigation.createdAt,
      completedAt: investigation.updatedAt,
      tokenUsage: investigation.tokenUsage || { inputTokens: 0, outputTokens: 0 },
      eventCount: events.length,
      events: events.map((event) => ({
        eventId: event._id.toString(),
        type: event.type,
        detectedAt: event.timestamp,
        location: event.location?.name,
      })),
      evidenceChain,
      toolCallCount: (investigation.toolCallSequence || []).length,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, "Failed to retrieve investigation evidence", [
      error.message,
    ]);
  }
};

export const checkNightComplete = async (nightDate) => {
  try {
    const { start, end } = getNightRange(nightDate);
    const incidents = await Incident.find({
      nightDate: { $gte: start, $lte: end },
    }).lean();

    if (incidents.length === 0) {
      return { isComplete: true, incidentCount: 0, completedCount: 0 };
    }

    const completedCount = incidents.filter(
      (incident) => incident.status === "complete"
    ).length;
    const isComplete = completedCount === incidents.length;

    if (!isComplete) {
      return {
        isComplete: false,
        incidentCount: incidents.length,
        completedCount,
        remaining: incidents.length - completedCount,
      };
    }

    const briefing = await briefingService.generateBriefing(nightDate);
    return {
      isComplete: true,
      incidentCount: incidents.length,
      completedCount,
      briefingId: briefing?._id || null,
      briefingStatus: briefing ? briefing.status : null,
    };
  } catch (error) {
    throw new ApiError(500, "Failed to check night completion", [error.message]);
  }
};

export default {
  startNightInvestigation,
  getInvestigationWithEvidence,
  checkNightComplete,
};
