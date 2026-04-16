/*
  Investigation Service — Orchestrate Full Investigation Runs

  Coordinates planning, queue dispatch, result persistence, and briefing.
  Called by investigation controller when investigations are triggered.
*/

import Investigation from '../models/investigation.model.js';
import Incident from '../models/incident.model.js';
import Event from '../models/event.model.js';
import { ApiError } from '../utils/api-error.js';
import { planInvestigations } from '../ai/planner.js';
import { addSiteFact } from '../ai/memory.js';
import investigationQueue from '../queues/investigation.queue.js';
import briefingService from './briefing.service.js';

/**
 * Start investigation for entire night (idempotent)
 * Plans incidents by priority and dispatches to job queue
 * @param {Date|string} nightDate - night to investigate
 * @returns {Promise<object>} { nightDate, totalJobs, jobIds, estimatedMinutes }
 */
export const startNightInvestigation = async (nightDate) => {
  try {
    console.log(`[InvestigationService] Starting night investigation for ${nightDate}`);

    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if jobs already exist (idempotency)
    const existingJobs = await Investigation.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    const existingStatuses = new Set(existingJobs.map((j) => j.status));
    if (existingStatuses.has('running') || existingStatuses.has('complete')) {
      console.log(
        `[InvestigationService] Investigation already in progress or complete for ${nightDate}`
      );
      return {
        nightDate,
        totalJobs: existingJobs.length,
        jobIds: existingJobs.map((j) => j._id),
        status: 'already_running',
      };
    }

    // Get incidents for the night
    const incidents = await Incident.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'pending',
    }).lean();

    if (incidents.length === 0) {
      console.log(`[InvestigationService] No pending incidents for ${nightDate}`);
      return {
        nightDate,
        totalJobs: 0,
        jobIds: [],
        estimatedMinutes: 0,
      };
    }

    // Plan investigations (scores and batches)
    const plan = await planInvestigations(incidents);

    // Dispatch jobs to queue (one per incident)
    const jobIds = [];
    let estimatedMinutes = 0;

    for (const plannedInc of plan.investigations) {
      // Create investigation record (queued state)
      const investigation = await Investigation.create({
        investigationId: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        incidentId: plannedInc._id || plannedInc.incidentId,
        nightDate: new Date(nightDate),
        status: 'queued',
        priority: plannedInc.priority || 5,
        startedAt: new Date(),
        evidence_chain: [],
        tool_call_sequence: [],
        final_classification: null,
        token_usage: { input: 0, output: 0, total: 0 },
      });

      // Dispatch to job queue
      const job = await investigationQueue.add(
        {
          investigationId: investigation._id,
          incidentId: plannedInc._id || plannedInc.incidentId,
          nightDate,
        },
        {
          priority: plannedInc.priority || 5,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }
      );

      jobIds.push(investigation._id);
      estimatedMinutes += plannedInc.estimatedMinutes || 5;

      console.log(
        `[InvestigationService] Dispatched job ${job.id} for incident ${plannedInc.incidentId} (priority ${plannedInc.priority})`
      );
    }

    console.log(
      `[InvestigationService] Night investigation started: ${jobIds.length} jobs queued, ~${estimatedMinutes} minutes`
    );

    return {
      nightDate,
      totalJobs: jobIds.length,
      jobIds,
      estimatedMinutes,
    };
  } catch (error) {
    console.error(`[InvestigationService] Error starting night investigation:`, error.message);
    throw new ApiError(500, 'Failed to start night investigation', [error.message]);
  }
};

/**
 * Save AI classification result
 * Called by classify_incident tool handler
 * Updates Investigation and parent Incident, records site fact
 * @param {object} classificationInput - { investigationId, severity, confidence, reasoning, uncertainties }
 * @returns {Promise<object>} saved classification
 */
export const saveClassification = async (classificationInput) => {
  try {
    const { investigationId, severity, confidence, reasoning, uncertainties } = classificationInput;

    if (!investigationId) {
      throw new ApiError(400, 'investigationId is required');
    }

    // Validate severity
    const validSeverities = ['harmless', 'monitor', 'escalate', 'uncertain'];
    if (!validSeverities.includes(severity)) {
      throw new ApiError(400, `Invalid severity: ${severity}`);
    }

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new ApiError(400, 'Confidence must be a number between 0 and 1');
    }

    console.log(`[InvestigationService] Saving classification for investigation ${investigationId}`);

    // Load investigation
    const investigation = await Investigation.findById(investigationId);
    if (!investigation) {
      throw new ApiError(404, `Investigation not found: ${investigationId}`);
    }

    // Save classification to investigation
    const classification = {
      severity,
      confidence,
      reasoning,
      uncertainties: uncertainties || [],
      classifiedAt: new Date(),
    };

    investigation.final_classification = classification;
    investigation.status = 'complete';
    investigation.completedAt = new Date();
    await investigation.save();

    console.log(
      `[InvestigationService] Classification saved: ${severity} (${Math.round(confidence * 100)}%)`
    );

    // Update parent incident's severity and status
    const incident = await Incident.findById(investigation.incidentId);
    if (incident) {
      incident.severity = severity;
      incident.status = 'complete';
      incident.final_investigation = investigation._id;
      await incident.save();

      console.log(`[InvestigationService] Updated incident ${incident.incidentId} status to complete`);
    }

    // Add established fact to memory
    try {
      await addSiteFact({
        fact: `Incident at ${incident?.correlation?.metadata?.locationName || 'unknown'} confirmed as ${severity}`,
        confidence,
        sourceInvestigation: investigation._id,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hr TTL
      });

      console.log(`[InvestigationService] Added site fact to memory`);
    } catch (memErr) {
      console.warn(`[InvestigationService] Failed to add site fact:`, memErr.message);
      // Don't fail the operation if memory update fails
    }

    return classification;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[InvestigationService] Error saving classification:`, error.message);
    throw new ApiError(500, 'Failed to save classification', [error.message]);
  }
};

/**
 * Get investigation with formatted evidence chain
 * Used for View 2 (Investigation Details)
 * @param {string} investigationId - Investigation ID
 * @returns {Promise<object>} formatted investigation with evidence
 */
export const getInvestigationWithEvidence = async (investigationId) => {
  try {
    console.log(`[InvestigationService] Fetching investigation ${investigationId} with evidence`);

    // Load investigation and related documents
    const investigation = await Investigation.findById(investigationId)
      .populate({
        path: 'incidentId',
        select: 'title description correlation severity priority',
      })
      .lean();

    if (!investigation) {
      throw new ApiError(404, `Investigation not found: ${investigationId}`);
    }

    // Load events from the investigation's incident
    const events = await Event.find({
      _id: { $in: investigation.incidentId?.eventIds || [] },
    }).lean();

    // Format tool call sequence as evidence chain for client
    const evidenceChain = (investigation.tool_call_sequence || [])
      .map((call, index) => ({
        stepNumber: index + 1,
        toolName: call.name,
        input: call.input,
        output: call.result,
        timestamp: call.timestamp,
        evidenceValue: extractEvidenceSummary(call),
      }));

    const formatted = {
      investigationId: investigation._id,
      incidentId: investigation.incidentId?._id,
      incidentTitle: investigation.incidentId?.title,
      severity: investigation.final_classification?.severity,
      confidence: investigation.final_classification?.confidence,
      reasoning: investigation.final_classification?.reasoning,
      uncertainties: investigation.final_classification?.uncertainties,
      status: investigation.status,
      startedAt: investigation.startedAt,
      completedAt: investigation.completedAt,
      tokenUsage: investigation.token_usage,
      eventCount: events.length,
      events: events.map((e) => ({
        eventId: e._id,
        type: e.event_type,
        detectedAt: e.detectedAt,
        location: e.location?.name,
        sourceType: e.sourceType,
      })),
      evidenceChain,
      toolCallCount: (investigation.tool_call_sequence || []).length,
    };

    console.log(
      `[InvestigationService] Formatted evidence chain (${evidenceChain.length} steps)`
    );

    return formatted;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[InvestigationService] Error getting investigation with evidence:`, error.message);
    throw new ApiError(500, 'Failed to retrieve investigation evidence', [error.message]);
  }
};

/**
 * Check if all incidents for night are complete; trigger briefing if so
 * @param {Date|string} nightDate - night to check
 * @returns {Promise<object>} { isComplete, incidentCount, completedCount, briefingId }
 */
export const checkNightComplete = async (nightDate) => {
  try {
    console.log(`[InvestigationService] Checking completion for ${nightDate}`);

    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all incidents for the night
    const incidents = await Incident.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    if (incidents.length === 0) {
      console.log(`[InvestigationService] No incidents for ${nightDate}`);
      return {
        isComplete: true,
        incidentCount: 0,
        completedCount: 0,
      };
    }

    // Check if all are complete
    const completedCount = incidents.filter((i) => i.status === 'complete').length;
    const isComplete = completedCount === incidents.length;

    console.log(
      `[InvestigationService] Progress: ${completedCount}/${incidents.length} incidents complete`
    );

    if (isComplete) {
      console.log(`[InvestigationService] All incidents complete! Generating briefing...`);

      // Trigger briefing generation
      let briefing = null;
      try {
        briefing = await briefingService.generateBriefing(nightDate);
        console.log(`[InvestigationService] Briefing generated: ${briefing.briefingId}`);
      } catch (briefErr) {
        console.warn(`[InvestigationService] Failed to generate briefing:`, briefErr.message);
        // Don't fail the check if briefing fails
      }

      return {
        isComplete: true,
        incidentCount: incidents.length,
        completedCount,
        briefingId: briefing?._id,
        briefingStatus: 'generated',
      };
    }

    return {
      isComplete: false,
      incidentCount: incidents.length,
      completedCount,
      remaining: incidents.length - completedCount,
    };
  } catch (error) {
    console.error(`[InvestigationService] Error checking night completion:`, error.message);
    throw new ApiError(500, 'Failed to check night completion', [error.message]);
  }
};

/**
 * Extract evidence summary from a tool call
 * Used to summarize tool results for the evidence chain
 */
const extractEvidenceSummary = (toolCall) => {
  const toolName = toolCall.name;
  const result = toolCall.result;

  if (!result) return null;

  // Summarize based on tool type
  if (toolName === 'get_overnight_alerts') {
    const alerts = Array.isArray(result) ? result : [];
    return `${alerts.length} alerts retrieved`;
  }

  if (toolName === 'get_vehicle_paths') {
    const paths = Array.isArray(result) ? result : [];
    return `${paths.length} vehicle movements tracked`;
  }

  if (toolName === 'get_badge_swipe_history') {
    const swipes = Array.isArray(result) ? result : [];
    return `${swipes.length} badge swipes found`;
  }

  if (toolName === 'get_drone_patrol_log') {
    return result.patrolCount ? `${result.patrolCount} drone patrols analyzed` : 'Drone data retrieved';
  }

  if (toolName === 'correlate_events_by_location') {
    return result.eventCount ? `${result.eventCount} co-located events` : 'Location correlation complete';
  }

  if (toolName === 'simulate_follow_up_mission') {
    return result.missionId ? `Follow-up mission planned` : 'Drone mission simulation complete';
  }

  if (toolName === 'classify_incident') {
    return `Classified as ${result.severity} (${Math.round(result.confidence * 100)}%)`;
  }

  return 'Tool executed';
};

/**
 * Get investigations awaiting Maya's review
 * For the morning dashboard
 * @param {Date|string} nightDate - night to retrieve
 * @returns {Promise<array>} investigations needing review
 */
export const getInvestigationsAwaitingReview = async (nightDate) => {
  try {
    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    const investigations = await Investigation.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'complete',
      $or: [
        { 'final_classification.severity': 'escalate' },
        { 'final_classification.severity': 'uncertain' },
      ],
    })
      .populate('incidentId', 'title description correlation')
      .lean()
      .sort({ 'final_classification.confidence': 1 }); // Sort by lowest confidence first

    console.log(
      `[InvestigationService] Found ${investigations.length} investigations awaiting review`
    );

    return investigations;
  } catch (error) {
    console.error(`[InvestigationService] Error getting awaiting review:`, error.message);
    throw new ApiError(500, 'Failed to retrieve investigations awaiting review', [error.message]);
  }
};

export default {
  startNightInvestigation,
  saveClassification,
  getInvestigationWithEvidence,
  checkNightComplete,
  getInvestigationsAwaitingReview,
};


/**
 * Start investigation for entire night (idempotent)
 * Plans incidents by priority and dispatches to job queue
 * @param {Date|string} nightDate - night to investigate
 * @returns {Promise<object>} { nightDate, totalJobs, jobIds, estimatedMinutes }
 */
export const startNightInvestigation = async (nightDate) => {
  try {
    console.log(`[InvestigationService] Starting night investigation for ${nightDate}`);

    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if jobs already exist (idempotency)
    const existingJobs = await Investigation.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    const existingStatuses = new Set(existingJobs.map((j) => j.status));
    if (existingStatuses.has('running') || existingStatuses.has('complete')) {
      console.log(
        `[InvestigationService] Investigation already in progress or complete for ${nightDate}`
      );
      return {
        nightDate,
        totalJobs: existingJobs.length,
        jobIds: existingJobs.map((j) => j._id),
        status: 'already_running',
      };
    }

    // Get incidents for the night
    const incidents = await Incident.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'pending',
    }).lean();

    if (incidents.length === 0) {
      console.log(`[InvestigationService] No pending incidents for ${nightDate}`);
      return {
        nightDate,
        totalJobs: 0,
        jobIds: [],
        estimatedMinutes: 0,
      };
    }

    // Plan investigations (scores and batches)
    const plan = await planInvestigations(incidents);

    // Dispatch jobs to queue (one per incident)
    const jobIds = [];
    let estimatedMinutes = 0;

    for (const plannedInc of plan.investigations) {
      // Create investigation record (queued state)
      const investigation = await Investigation.create({
        investigationId: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        incidentId: plannedInc._id || plannedInc.incidentId,
        nightDate: new Date(nightDate),
        status: 'queued',
        priority: plannedInc.priority || 5,
        startedAt: new Date(),
        evidence_chain: [],
        tool_call_sequence: [],
        final_classification: null,
        token_usage: { input: 0, output: 0, total: 0 },
      });

      // Dispatch to job queue
      const job = await investigationQueue.add(
        {
          investigationId: investigation._id,
          incidentId: plannedInc._id || plannedInc.incidentId,
          nightDate,
        },
        {
          priority: plannedInc.priority || 5,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }
      );

      jobIds.push(investigation._id);
      estimatedMinutes += plannedInc.estimatedMinutes || 5;

      console.log(
        `[InvestigationService] Dispatched job ${job.id} for incident ${plannedInc.incidentId} (priority ${plannedInc.priority})`
      );
    }

    console.log(
      `[InvestigationService] Night investigation started: ${jobIds.length} jobs queued, ~${estimatedMinutes} minutes`
    );

    return {
      nightDate,
      totalJobs: jobIds.length,
      jobIds,
      estimatedMinutes,
    };
  } catch (error) {
    console.error(`[InvestigationService] Error starting night investigation:`, error.message);
    throw new ApiError(500, 'Failed to start night investigation', [error.message]);
  }
};

/**
 * Save AI classification result
 * Called by classify_incident tool handler
 * Updates Investigation and parent Incident, records site fact
 * @param {object} classificationInput - { investigationId, severity, confidence, reasoning, uncertainties }
 * @returns {Promise<object>} saved classification
 */
export const saveClassification = async (classificationInput) => {
  try {
    const { investigationId, severity, confidence, reasoning, uncertainties } = classificationInput;

    if (!investigationId) {
      throw new ApiError(400, 'investigationId is required');
    }

    // Validate severity
    const validSeverities = ['harmless', 'monitor', 'escalate', 'uncertain'];
    if (!validSeverities.includes(severity)) {
      throw new ApiError(400, `Invalid severity: ${severity}`);
    }

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new ApiError(400, 'Confidence must be a number between 0 and 1');
    }

    console.log(`[InvestigationService] Saving classification for investigation ${investigationId}`);

    // Load investigation
    const investigation = await Investigation.findById(investigationId);
    if (!investigation) {
      throw new ApiError(404, `Investigation not found: ${investigationId}`);
    }

    // Save classification to investigation
    const classification = {
      severity,
      confidence,
      reasoning,
      uncertainties: uncertainties || [],
      classifiedAt: new Date(),
    };

    investigation.final_classification = classification;
    investigation.status = 'complete';
    investigation.completedAt = new Date();
    await investigation.save();

    console.log(
      `[InvestigationService] Classification saved: ${severity} (${Math.round(confidence * 100)}%)`
    );

    // Update parent incident's severity and status
    const incident = await Incident.findById(investigation.incidentId);
    if (incident) {
      incident.severity = severity;
      incident.status = 'complete';
      incident.final_investigation = investigation._id;
      await incident.save();

      console.log(`[InvestigationService] Updated incident ${incident.incidentId} status to complete`);
    }

    // Add established fact to memory
    try {
      await addSiteFact({
        fact: `Incident at ${incident?.correlation?.metadata?.locationName || 'unknown'} confirmed as ${severity}`,
        confidence,
        sourceInvestigation: investigation._id,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hr TTL
      });

      console.log(`[InvestigationService] Added site fact to memory`);
    } catch (memErr) {
      console.warn(`[InvestigationService] Failed to add site fact:`, memErr.message);
      // Don't fail the operation if memory update fails
    }

    return classification;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[InvestigationService] Error saving classification:`, error.message);
    throw new ApiError(500, 'Failed to save classification', [error.message]);
  }
};

/**
 * Get investigation with formatted evidence chain
 * Used for View 2 (Investigation Details)
 * @param {string} investigationId - Investigation ID
 * @returns {Promise<object>} formatted investigation with evidence
 */
export const getInvestigationWithEvidence = async (investigationId) => {
  try {
    console.log(`[InvestigationService] Fetching investigation ${investigationId} with evidence`);

    // Load investigation and related documents
    const investigation = await Investigation.findById(investigationId)
      .populate({
        path: 'incidentId',
        select: 'title description correlation severity priority',
      })
      .lean();

    if (!investigation) {
      throw new ApiError(404, `Investigation not found: ${investigationId}`);
    }

    // Load events from the investigation's incident
    const events = await Event.find({
      _id: { $in: investigation.incidentId?.eventIds || [] },
    }).lean();

    // Format tool call sequence as evidence chain for client
    const evidenceChain = (investigation.tool_call_sequence || [])
      .map((call, index) => ({
        stepNumber: index + 1,
        toolName: call.name,
        input: call.input,
        output: call.result,
        timestamp: call.timestamp,
        evidenceValue: extractEvidenceSummary(call),
      }));

    const formatted = {
      investigationId: investigation._id,
      incidentId: investigation.incidentId?._id,
      incidentTitle: investigation.incidentId?.title,
      severity: investigation.final_classification?.severity,
      confidence: investigation.final_classification?.confidence,
      reasoning: investigation.final_classification?.reasoning,
      uncertainties: investigation.final_classification?.uncertainties,
      status: investigation.status,
      startedAt: investigation.startedAt,
      completedAt: investigation.completedAt,
      tokenUsage: investigation.token_usage,
      eventCount: events.length,
      events: events.map((e) => ({
        eventId: e._id,
        type: e.event_type,
        detectedAt: e.detectedAt,
        location: e.location?.name,
        sourceType: e.sourceType,
      })),
      evidenceChain,
      toolCallCount: (investigation.tool_call_sequence || []).length,
    };

    console.log(
      `[InvestigationService] Formatted evidence chain (${evidenceChain.length} steps)`
    );

    return formatted;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[InvestigationService] Error getting investigation with evidence:`, error.message);
    throw new ApiError(500, 'Failed to retrieve investigation evidence', [error.message]);
  }
};

/**
 * Check if all incidents for night are complete; trigger briefing if so
 * @param {Date|string} nightDate - night to check
 * @returns {Promise<object>} { isComplete, incidentCount, completedCount, briefingId }
 */
export const checkNightComplete = async (nightDate) => {
  try {
    console.log(`[InvestigationService] Checking completion for ${nightDate}`);

    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all incidents for the night
    const incidents = await Incident.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    if (incidents.length === 0) {
      console.log(`[InvestigationService] No incidents for ${nightDate}`);
      return {
        isComplete: true,
        incidentCount: 0,
        completedCount: 0,
      };
    }

    // Check if all are complete
    const completedCount = incidents.filter((i) => i.status === 'complete').length;
    const isComplete = completedCount === incidents.length;

    console.log(
      `[InvestigationService] Progress: ${completedCount}/${incidents.length} incidents complete`
    );

    if (isComplete) {
      console.log(`[InvestigationService] All incidents complete! Generating briefing...`);

      // Trigger briefing generation
      let briefing = null;
      try {
        briefing = await briefingService.generateBriefing(nightDate);
        console.log(`[InvestigationService] Briefing generated: ${briefing.briefingId}`);
      } catch (briefErr) {
        console.warn(`[InvestigationService] Failed to generate briefing:`, briefErr.message);
        // Don't fail the check if briefing fails
      }

      return {
        isComplete: true,
        incidentCount: incidents.length,
        completedCount,
        briefingId: briefing?._id,
        briefingStatus: 'generated',
      };
    }

    return {
      isComplete: false,
      incidentCount: incidents.length,
      completedCount,
      remaining: incidents.length - completedCount,
    };
  } catch (error) {
    console.error(`[InvestigationService] Error checking night completion:`, error.message);
    throw new ApiError(500, 'Failed to check night completion', [error.message]);
  }
};

/**
 * Extract evidence summary from a tool call
 * Used to summarize tool results for the evidence chain
 */
const extractEvidenceSummary = (toolCall) => {
  const toolName = toolCall.name;
  const result = toolCall.result;

  if (!result) return null;

  // Summarize based on tool type
  if (toolName === 'get_overnight_alerts') {
    const alerts = Array.isArray(result) ? result : [];
    return `${alerts.length} alerts retrieved`;
  }

  if (toolName === 'get_vehicle_paths') {
    const paths = Array.isArray(result) ? result : [];
    return `${paths.length} vehicle movements tracked`;
  }

  if (toolName === 'get_badge_swipe_history') {
    const swipes = Array.isArray(result) ? result : [];
    return `${swipes.length} badge swipes found`;
  }

  if (toolName === 'get_drone_patrol_log') {
    return result.patrolCount ? `${result.patrolCount} drone patrols analyzed` : 'Drone data retrieved';
  }

  if (toolName === 'correlate_events_by_location') {
    return result.eventCount ? `${result.eventCount} co-located events` : 'Location correlation complete';
  }

  if (toolName === 'simulate_follow_up_mission') {
    return result.missionId ? `Follow-up mission planned` : 'Drone mission simulation complete';
  }

  if (toolName === 'classify_incident') {
    return `Classified as ${result.severity} (${Math.round(result.confidence * 100)}%)`;
  }

  return 'Tool executed';
};

/**
 * Get investigations awaiting Maya's review
 * For the morning dashboard
 * @param {Date|string} nightDate - night to retrieve
 * @returns {Promise<array>} investigations needing review
 */
export const getInvestigationsAwaitingReview = async (nightDate) => {
  try {
    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    const investigations = await Investigation.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'complete',
      $or: [
        { 'final_classification.severity': 'escalate' },
        { 'final_classification.severity': 'uncertain' },
      ],
    })
      .populate('incidentId', 'title description correlation')
      .lean()
      .sort({ 'final_classification.confidence': 1 }); // Sort by lowest confidence first

    console.log(
      `[InvestigationService] Found ${investigations.length} investigations awaiting review`
    );

    return investigations;
  } catch (error) {
    console.error(`[InvestigationService] Error getting awaiting review:`, error.message);
    throw new ApiError(500, 'Failed to retrieve investigations awaiting review', [error.message]);
  }
};

export default {
  startNightInvestigation,
  saveClassification,
  getInvestigationWithEvidence,
  checkNightComplete,
  getInvestigationsAwaitingReview,
};
