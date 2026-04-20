/*
  Event Service — Business Logic for Event Operations

  Primary interface for reading and writing event data.
  Delegates to logs tool for data access, handles classifications and reviews.
*/

import Event from '../models/event.model.js';
import Review from '../models/review.model.js';
import { ApiError } from '../utils/api-error.js';
import {
  getOvernightAlerts as queryOvernightAlerts,
  getVehiclePaths as queryVehiclePaths,
  getBadgeSwipeHistory as queryBadgeSwipeHistory,
  getDronePatrolLog as queryDronePatrolLog,
} from '../tools/logs.tool.js';

function getDayRange(dateString) {
  const start = new Date(dateString)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateString)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

// ========== DELEGATION TO LOGS TOOL ==========

/**
 * Get all overnight security alerts
 * @param {Date|string} nightDate - the night to retrieve
 * @returns {Promise<array>} formatted alerts
 */
export const getOvernightAlerts = async (nightDate) => {
  try {
    const alerts = await queryOvernightAlerts(nightDate);
    console.log(`[EventService] Retrieved ${alerts.length} overnight alerts`);
    return alerts;
  } catch (error) {
    console.error(`[EventService] Error getting overnight alerts:`, error.message);
    throw new ApiError(500, 'Failed to retrieve overnight alerts', [error.message]);
  }
};

/**
 * Get vehicle movement paths
 * @param {string} vehicleId - optional specific vehicle ID
 * @returns {Promise<array>} vehicle paths
 */
export const getVehiclePaths = async (vehicleId = null, nightDate) => {
  try {
    const paths = await queryVehiclePaths(vehicleId, nightDate);
    console.log(`[EventService] Retrieved ${paths.length} vehicle paths`);
    return paths;
  } catch (error) {
    console.error(`[EventService] Error getting vehicle paths:`, error.message);
    throw new ApiError(500, 'Failed to retrieve vehicle paths', [error.message]);
  }
};

/**
 * Get badge swipe history
 * @param {object} filters - optional {locationName, employeeId}
 * @returns {Promise<array>} badge swipe history
 */
export const getBadgeSwipeHistory = async (filters = {}, nightDate) => {
  try {
    const history = await queryBadgeSwipeHistory(filters, nightDate);
    console.log(`[EventService] Retrieved badge swipe history`);
    return history;
  } catch (error) {
    console.error(`[EventService] Error getting badge swipe history:`, error.message);
    throw new ApiError(500, 'Failed to retrieve badge swipe history', [error.message]);
  }
};

/**
 * Get drone patrol log
 * @returns {Promise<object>} drone patrol summary
 */
export const getDronePatrolLog = async (nightDate) => {
  try {
    const log = await queryDronePatrolLog(nightDate);
    console.log(`[EventService] Retrieved drone patrol log`);
    return log;
  } catch (error) {
    console.error(`[EventService] Error getting drone patrol log:`, error.message);
    throw new ApiError(500, 'Failed to retrieve drone patrol log', [error.message]);
  }
};

// ========== DIRECT DATABASE OPERATIONS ==========

/**
 * Get all events for a given night, grouped by incident
 * @param {Date|string} nightDate - the night to retrieve
 * @returns {Promise<object>} { byIncident: {incidentId: [events]}, unincorporated: [events] }
 */
export const getEventsForNight = async (nightDate) => {
  try {
    const { start, end } = getDayRange(nightDate);

    // Query all events for the night
    const events = await Event.find({
      nightDate: { $gte: start, $lte: end },
    })
      .populate('incidentId', 'title status')
      .lean();

    console.log(`[EventService] Retrieved ${events.length} events for ${nightDate}`);

    // Group by incident
    const grouped = {
      byIncident: {},
      unincorporated: [],
    };

    for (const event of events) {
      if (event.incidentId) {
        const incId = event.incidentId._id.toString();
        if (!grouped.byIncident[incId]) {
          grouped.byIncident[incId] = [];
        }
        grouped.byIncident[incId].push(event);
      } else {
        grouped.unincorporated.push(event);
      }
    }

    return grouped;
  } catch (error) {
    console.error(`[EventService] Error getting events for night:`, error.message);
    throw new ApiError(500, 'Failed to retrieve events for night', [error.message]);
  }
};

/**
 * Update agent classification on an event
 * @param {string} eventId - MongoDB event ID
 * @param {object} classificationData - { severity, confidence, reasoning, uncertainties }
 * @returns {Promise<object>} updated event
 */
export const updateEventClassification = async (eventId, classificationData) => {
  try {
    // Validate classification data
    const required = ['severity', 'confidence', 'reasoning'];
    const missing = required.filter((key) => !(key in classificationData));

    if (missing.length > 0) {
      throw new ApiError(400, 'Missing required classification fields', missing);
    }

    // Validate severity enum
    const validSeverities = ['harmless', 'monitor', 'escalate', 'uncertain'];
    if (!validSeverities.includes(classificationData.severity)) {
      throw new ApiError(400, `Invalid severity: ${classificationData.severity}`, [
        'Must be one of: ' + validSeverities.join(', '),
      ]);
    }

    // Validate confidence range
    if (
      typeof classificationData.confidence !== 'number' ||
      classificationData.confidence < 0 ||
      classificationData.confidence > 1
    ) {
      throw new ApiError(400, 'Confidence must be a number between 0 and 1');
    }

    // Update the event
    const updated = await Event.findByIdAndUpdate(
      eventId,
      {
        agentClassification: {
          severity: classificationData.severity,
          confidence: classificationData.confidence,
          reasoning: classificationData.reasoning,
          uncertainties: classificationData.uncertainties || [],
          classifiedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new ApiError(404, `Event not found: ${eventId}`);
    }

    console.log(`[EventService] Updated classification for event ${eventId}`);
    return updated;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[EventService] Error updating classification:`, error.message);
    throw new ApiError(500, 'Failed to update event classification', [error.message]);
  }
};

/**
 * Apply Maya's review to an event
 * @param {string} eventId - MongoDB event ID
 * @param {object} reviewData - { decision, overrideSeverity?, note }
 * @param {string} userId - reviewer user ID
 * @returns {Promise<object>} updated event with review
 */
export const applyMayaReview = async (eventId, reviewData, userId) => {
  try {
    // Validate review data
    const validDecisions = ['agreed', 'overridden', 'flagged'];
    if (!validDecisions.includes(reviewData.decision)) {
      throw new ApiError(400, `Invalid decision: ${reviewData.decision}`, [
        'Must be one of: ' + validDecisions.join(', '),
      ]);
    }

    // Load the event
    const event = await Event.findById(eventId);
    if (!event) {
      throw new ApiError(404, `Event not found: ${eventId}`);
    }

    // Prepare review data
    const review = {
      decision: reviewData.decision,
      note: reviewData.note || '',
      reviewedAt: new Date(),
      reviewedBy: userId,
    };

    // If overridden, update severity
    let updateData = {
      mayaReview: review,
    };

    if (reviewData.decision === 'overridden' && reviewData.overrideSeverity) {
      const validSeverities = ['harmless', 'monitor', 'escalate'];
      if (!validSeverities.includes(reviewData.overrideSeverity)) {
        throw new ApiError(400, `Invalid override severity: ${reviewData.overrideSeverity}`);
      }
      updateData.severity = reviewData.overrideSeverity;
    }

    // Update the event
    const updated = await Event.findByIdAndUpdate(eventId, updateData, { new: true }).lean();

    console.log(`[EventService] Applied review to event ${eventId}: ${reviewData.decision}`);

    // Create a Review record for audit trail
    try {
      await Review.create({
        reviewId: `REVIEW-${eventId}-${Date.now()}`,
        eventId,
        reviewer: userId,
        verdict: reviewData.decision,
        comments: reviewData.note,
        reviewedAt: new Date(),
      });
    } catch (reviewError) {
      console.warn(`[EventService] Failed to create Review record:`, reviewError.message);
      // Don't fail the whole operation if audit record fails
    }

    return updated;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[EventService] Error applying Maya review:`, error.message);
    throw new ApiError(500, 'Failed to apply review', [error.message]);
  }
};

export default {
  getOvernightAlerts,
  getVehiclePaths,
  getBadgeSwipeHistory,
  getDronePatrolLog,
  getEventsForNight,
  updateEventClassification,
  applyMayaReview,
};
