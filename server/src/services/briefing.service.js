/*
  Briefing Service — Generate Morning Intelligence Briefing

  Generates 5-section briefing from completed investigations.
  Formats findings for Maya's 8 AM review.
  Tracks Maya's approvals and overrides.
*/

import Briefing from '../models/briefing.model.js';
import Review from '../models/review.model.js';
import Investigation from '../models/investigation.model.js';
import Incident from '../models/incident.model.js';
import Event from '../models/event.model.js';
import { ApiError } from '../utils/api-error.js';

/**
 * Generate morning briefing for a given night
 * Aggregates all investigations + findings into 5-section format
 * @param {Date|string} nightDate - night to generate briefing for
 * @returns {Promise<object>} Briefing document
 */
export const generateBriefing = async (nightDate) => {
  try {
    console.log(`[BriefingService] Generating briefing for ${nightDate}`);

    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all investigations for the night
    const investigations = await Investigation.find({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'complete',
    })
      .populate('incidentId')
      .lean();

    if (investigations.length === 0) {
      console.log(`[BriefingService] No completed investigations for ${nightDate}`);
      return null;
    }

    // Categorize investigations by severity
    const byGrwavity = {
      escalate: [],
      monitor: [],
      harmless: [],
      uncertain: [],
    };

    for (const inv of investigations) {
      const severity = inv.final_classification?.severity || 'uncertain';
      if (byGrwavity[severity]) {
        byGrwavity[severity].push(inv);
      }
    }

    // ========== SECTION 1: EXECUTIVE SUMMARY ==========
    const summarySection = generateExecutiveSummary(nightDate, investigations, byGrwavity);

    // ========== SECTION 2: INCIDENTS ==========
    const incidentsSection = generateIncidentsSection(byGrwavity);

    // ========== SECTION 3: RECOMMENDATIONS ==========
    const recommendationsSection = generateRecommendationsSection(investigations);

    // ========== SECTION 4: ANOMALIES & PATTERNS ==========
    const anomaliesSection = await generateAnomaliesSection(investigations);

    // ========== SECTION 5: FOLLOW-UP ACTIONS ==========
    const followUpSection = generateFollowUpSection(investigations);

    // Create briefing document
    const briefing = await Briefing.create({
      briefingId: `BR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nightDate: new Date(nightDate),
      generatedAt: new Date(),
      status: 'pending_review',
      sections: {
        executive_summary: summarySection,
        incidents: incidentsSection,
        recommendations: recommendationsSection,
        anomalies: anomaliesSection,
        follow_up: followUpSection,
      },
      metadata: {
        investigationCount: investigations.length,
        incidentsAnalyzed: byGrwavity.escalate.length + byGrwavity.monitor.length,
        totalTokensUsed: investigations.reduce((sum, i) => sum + (i.token_usage?.total || 0), 0),
      },
    });

    console.log(`[BriefingService] Briefing created: ${briefing.briefingId}`);

    return briefing;
  } catch (error) {
    console.error(`[BriefingService] Error generating briefing:`, error.message);
    throw new ApiError(500, 'Failed to generate briefing', [error.message]);
  }
};

/**
 * Generate executive summary section
 */
const generateExecutiveSummary = (nightDate, investigations, byGrwavity) => {
  const escalateCount = byGrwavity.escalate.length;
  const monitorCount = byGrwavity.monitor.length;
  const harmlessCount = byGrwavity.harmless.length;

  let threatLevel = 'low';
  if (escalateCount >= 3) threatLevel = 'high';
  else if (escalateCount > 0 || monitorCount >= 2) threatLevel = 'medium';

  const summary = {
    nightDate: nightDate.toString(),
    threatLevel,
    keyMetrics: {
      totalInvestigations: investigations.length,
      escalations: escalateCount,
      monitoring: monitorCount,
      harmless: harmlessCount,
    },
    overview: `Overnight investigation completed. ${escalateCount} escalation events, ${monitorCount} for monitoring. Threat level: ${threatLevel}.`,
    criticalFindings: byGrwavity.escalate
      .slice(0, 3)
      .map((inv) => ({
        incidentId: inv.incidentId?.incidentId,
        classification: inv.final_classification?.severity,
        confidence: inv.final_classification?.confidence,
      })),
  };

  return summary;
};

/**
 * Generate incidents section with categorization
 */
const generateIncidentsSection = (byGrwavity) => {
  const incidents = {
    escalations: {
      count: byGrwavity.escalate.length,
      items: byGrwavity.escalate.map((inv) => ({
        investigationId: inv.investigationId,
        incidentId: inv.incidentId?.incidentId || inv.incidentId,
        title: inv.incidentId?.title || 'Unnamed incident',
        severity: inv.final_classification?.severity,
        confidence: inv.final_classification?.confidence,
        reasoning: inv.final_classification?.reasoning,
        requiredAction: 'Immediate review recommended',
      })),
    },
    monitoring: {
      count: byGrwavity.monitor.length,
      items: byGrwavity.monitor.map((inv) => ({
        investigationId: inv.investigationId,
        incidentId: inv.incidentId?.incidentId || inv.incidentId,
        title: inv.incidentId?.title || 'Unnamed incident',
        severity: inv.final_classification?.severity,
        confidence: inv.final_classification?.confidence,
        reasoning: inv.final_classification?.reasoning,
        requiredAction: 'Monitor for escalation',
      })),
    },
    harmless: {
      count: byGrwavity.harmless.length,
      summary: `${byGrwavity.harmless.length} incidents confirmed harmless (e.g., scheduled maintenance, expected equipment operation)`,
    },
  };

  return incidents;
};

/**
 * Generate recommendations section
 */
const generateRecommendationsSection = (investigations) => {
  const recommendations = {
    immediateActions: [],
    followUp: [],
    learnings: [],
  };

  for (const inv of investigations) {
    if (inv.final_classification?.severity === 'escalate') {
      recommendations.immediateActions.push({
        investigationId: inv.investigationId,
        action: 'Site security review',
        reason: inv.final_classification?.reasoning || 'AI classified as escalation',
        priority: 'high',
      });
    }

    // Extract uncertainties as learning opportunities
    if (inv.final_classification?.uncertainties && inv.final_classification.uncertainties.length > 0) {
      recommendations.learnings.push({
        investigationId: inv.investigationId,
        uncertainty: inv.final_classification.uncertainties[0],
        suggestion: 'Additional data collection or sensor placement recommended',
      });
    }
  }

  return recommendations;
};

/**
 * Generate anomalies section
 */
const generateAnomaliesSection = async (investigations) => {
  const anomalies = {
    patterns: [],
    outliers: [],
  };

  // Group by investigation time to find patterns
  const byHour = {};
  for (const inv of investigations) {
    const hour = Math.floor(inv.startedAt.getHours());
    byHour[hour] = (byHour[hour] || 0) + 1;
  }

  // Detect peak activity hours
  const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  if (peakHour && peakHour[1] > investigations.length / 3) {
    anomalies.patterns.push({
      type: 'temporal_clustering',
      description: `${peakHour[1]} investigations clustered around hour ${peakHour[0]}`,
      significance: 'May indicate coordinated activity',
    });
  }

  // Low confidence investigations as outliers
  const lowConfidence = investigations.filter(
    (i) => i.final_classification?.confidence < 0.6
  );
  if (lowConfidence.length > 0) {
    anomalies.outliers.push({
      type: 'uncertain_classifications',
      count: lowConfidence.length,
      description: `${lowConfidence.length} investigations with <60% confidence`,
      implication: 'May require human review or additional data collection',
    });
  }

  return anomalies;
};

/**
 * Generate follow-up actions section
 */
const generateFollowUpSection = (investigations) => {
  const followUp = {
    droneFollowUps: [],
    investigationGaps: [],
    scheduledReviews: [],
  };

  for (const inv of investigations) {
    // Check for investigations that flagged drone gaps
    if (
      inv.tool_call_sequence &&
      inv.tool_call_sequence.some((tc) => tc.name === 'simulate_follow_up_mission')
    ) {
      followUp.droneFollowUps.push({
        investigationId: inv.investigationId,
        incidentId: inv.incidentId,
        missionType: 'aerial_verification',
        priority: inv.final_classification?.severity === 'escalate' ? 'high' : 'medium',
      });
    }

    // Track uncertainties that need follow-up
    if (inv.final_classification?.uncertainties && inv.final_classification.uncertainties.length > 0) {
      followUp.investigationGaps.push({
        investigationId: inv.investigationId,
        gap: inv.final_classification.uncertainties[0],
        suggestedMethod: 'Additional sensor data or manual inspection',
      });
    }
  }

  return followUp;
};

/**
 * Get briefing by ID
 * @param {string} briefingId - Briefing ID
 * @returns {Promise<object>} Briefing document
 */
export const getBriefing = async (briefingId) => {
  try {
    const briefing = await Briefing.findById(briefingId).lean();

    if (!briefing) {
      throw new ApiError(404, `Briefing not found: ${briefingId}`);
    }

    return briefing;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[BriefingService] Error getting briefing:`, error.message);
    throw new ApiError(500, 'Failed to retrieve briefing', [error.message]);
  }
};

/**
 * Get latest briefing for a night
 * @param {Date|string} nightDate - night to get briefing for
 * @returns {Promise<object|null>} Briefing document or null
 */
export const getLatestBriefing = async (nightDate) => {
  try {
    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    const briefing = await Briefing.findOne({
      nightDate: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ generatedAt: -1 })
      .lean();

    return briefing || null;
  } catch (error) {
    console.error(`[BriefingService] Error getting latest briefing:`, error.message);
    throw new ApiError(500, 'Failed to retrieve latest briefing', [error.message]);
  }
};

/**
 * Apply Maya's review/approval to briefing
 * @param {string} briefingId - Briefing ID
 * @param {object} reviewData - { decision, overrides, notes }
 * @param {string} reviewerId - Ma user ID
 * @returns {Promise<object>} Updated briefing
 */
export const applyBriefingReview = async (briefingId, reviewData, reviewerId) => {
  try {
    const briefing = await Briefing.findById(briefingId);
    if (!briefing) {
      throw new ApiError(404, `Briefing not found: ${briefingId}`);
    }

    const validDecisions = ['approved', 'approved_with_notes', 'needs_revision'];
    if (!validDecisions.includes(reviewData.decision)) {
      throw new ApiError(400, `Invalid review decision: ${reviewData.decision}`);
    }

    // Create review record
    const review = await Review.create({
      reviewId: `REVIEW-${briefingId}-${Date.now()}`,
      briefingId,
      reviewer: reviewerId,
      verdict: reviewData.decision,
      comments: reviewData.notes || '',
      overrides: reviewData.overrides || {},
      reviewedAt: new Date(),
    });

    // Update briefing status
    let newStatus = 'approved';
    if (reviewData.decision === 'needs_revision') {
      newStatus = 'pending_revision';
    }

    const updated = await Briefing.findByIdAndUpdate(
      briefingId,
      {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        lastReview: review._id,
      },
      { new: true }
    ).lean();

    console.log(`[BriefingService] Briefing reviewed: ${briefingId} → ${newStatus}`);

    return updated;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[BriefingService] Error applying review:`, error.message);
    throw new ApiError(500, 'Failed to apply review', [error.message]);
  }
};

export default {
  generateBriefing,
  getBriefing,
  getLatestBriefing,
  applyBriefingReview,
};
