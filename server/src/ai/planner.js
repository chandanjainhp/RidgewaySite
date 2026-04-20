/*
  Investigation Planner — Incident Priority & Batching

  Plans the investigation order and batching strategy for a night's incidents.
  Ensures Maya sees the most important things resolved first.

  PRIORITY SCORING:
  - Base type scores (10 = highest concern)
  - Bonuses for: Raghav's flag, drone gap coverage, unidentified entities
  - Penalties for: drone confirmed harmless

  BATCHING STRATEGY:
  - Score < 4: batch into groups of max 3 (low-signal items)
  - Score >= 4: dedicated agent run per incident
*/

import Incident from '../models/incident.model.js';
import { initGraph, getDroneObservationsNear, SITE_LOCATIONS } from '../db/graph.js';

// Returns a {start, end} pair covering the full local calendar day for a given date.
// Accepts a Date object or a YYYY-MM-DD string.
const getDayRange = (dateInput) => {
  const base = new Date(dateInput);
  base.setHours(0, 0, 0, 0);
  const start = new Date(base);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Base priority scores by incident type/correlation
const BASE_SCORES = {
  escalation_candidate: 10,
  repeated_access_failure: 8,
  unidentified_entity: 10,
  fence_alert: 5,
  motion_sensor: 2,
  light_anomaly: 1,
};

/**
 * Score a single incident based on priority rules
 * @param {object} incident - incident document from MongoDB
 * @returns {number} priority score
 */
const scoreIncident = async (incident) => {
  let score = 0;

  // 1. Base score by correlation type or entity type
  if (incident.correlationType === 'cross_type' && incident.entityInvolved?.type === 'vehicle') {
    // Vehicle in multiple zones = escalation candidate
    score = BASE_SCORES.escalation_candidate;
  } else if (incident.correlationType === 'entity' && incident.entityInvolved?.type === 'employee') {
    // Repeated access failures
    score = BASE_SCORES.repeated_access_failure;
  } else if (incident.entityInvolved?.type === 'unknown') {
    // Unidentified entity (vehicle or person)
    score = BASE_SCORES.unidentified_entity;
  } else {
    // Fall back to event type scoring (check first event's type)
    const firstEventType = incident.title.toLowerCase();
    if (firstEventType.includes('fence') || firstEventType.includes('perimeter')) {
      score = BASE_SCORES.fence_alert;
    } else if (firstEventType.includes('motion') || firstEventType.includes('canteen')) {
      score = BASE_SCORES.motion_sensor;
    } else if (firstEventType.includes('light')) {
      score = BASE_SCORES.light_anomaly;
    } else {
      score = 5; // Default mid-range
    }
  }

  // 2. Raghav's note flag (+5 for Block C concerns)
  if (incident.raghavsNote === true) {
    score += 5;
  }

  // 3. Drone coverage analysis (+3 if gap, -3 if confirmed harmless)
  try {
    const locationId = incident.primaryLocation.name;
    const droneObs = getDroneObservationsNear(locationId, 300);

    if (droneObs.length === 0) {
      // Drone did not cover this location
      score += 3;
    } else {
      // Check if drone confirmed harmless at this location
      const hasHarmlessConfirmation = droneObs.some(obs =>
        obs.observation?.toLowerCase().includes('harmless') ||
        obs.observation?.toLowerCase().includes('animal') ||
        obs.observation?.toLowerCase().includes('false alarm')
      );

      if (hasHarmlessConfirmation) {
        score -= 3;
      }
    }
  } catch (droneError) {
    console.warn(`[Planner] Error checking drone coverage for ${incident.primaryLocation.name}:`, droneError.message);
    // Default: assume gap if we can't check
    score += 2;
  }

  // 4. Unidentified entity bonus (+2)
  if (incident.entityInvolved?.type === 'unknown') {
    score += 2;
  }

  return Math.max(1, score); // Ensure minimum score of 1
};

/**
 * Plan investigations for a night: score, prioritize, and batch incidents
 * @param {Date|string} nightDate - the night to plan for (date only, no time)
 * @returns {Promise<array>} plan array sorted by priority
 */
export const planInvestigations = async (nightDate) => {
  console.log(`[Planner] Beginning planning for night: ${new Date(nightDate).toISOString().split('T')[0]}`);

  try {
    // 1. Load all incidents for the night in pending or investigating status
    const { start, end } = getDayRange(nightDate);
    const incidents = await Incident.find({
      nightDate: { $gte: start, $lte: end },
      status: { $in: ['pending', 'investigating'] },
    });

    console.log(`[Planner] Found ${incidents.length} incidents for ${start.toISOString().split('T')[0]} (query: ${start.toISOString()} → ${end.toISOString()})`);

    if (incidents.length === 0) {
      console.log(`[Planner] No incidents to plan`);
      return [];
    }

    // Initialize graph for drone observations
    initGraph();

    // 2. Score each incident
    const scoredIncidents = [];
    for (const incident of incidents) {
      const score = await scoreIncident(incident);

      // Determine complexity
      let complexity = 'low';
      if (score >= 10) {
        complexity = 'high';
      } else if (score >= 6) {
        complexity = 'medium';
      }

      scoredIncidents.push({
        incidentId: incident._id.toString(),
        incident, // Keep reference for batching
        score,
        complexity,
        rawScore: score, // Save for logging
      });
    }

    // 3. Sort by score descending (highest score first)
    scoredIncidents.sort((a, b) => b.score - a.score);

    // 4. Batch low-score incidents
    const plan = [];
    const batchedIncidents = [];
    let batchCounter = 0;

    for (const scored of scoredIncidents) {
      if (scored.score < 4) {
        // Batch this incident
        batchedIncidents.push(scored);
      } else {
        // Dedicated run
        plan.push({
          incidentId: scored.incidentId,
          score: scored.score,
          complexity: scored.complexity,
          runType: 'dedicated',
          batchId: null,
        });
      }
    }

    // 5. Create batches from low-score incidents (max 3 per batch)
    for (let i = 0; i < batchedIncidents.length; i += 3) {
      const batch = batchedIncidents.slice(i, i + 3);
      const batchId = `batch_${nightDate.getTime()}_${batchCounter}`;
      batchCounter++;

      for (const scored of batch) {
        plan.push({
          incidentId: scored.incidentId,
          score: scored.score,
          complexity: scored.complexity,
          runType: 'batched',
          batchId,
        });
      }
    }

    // 6. Assign priorities (1 = highest)
    // Sort by dedicated first, then by score descending
    const dedicatedFirst = plan.filter(p => p.runType === 'dedicated');
    const batchedRest = plan.filter(p => p.runType === 'batched');

    dedicatedFirst.sort((a, b) => b.score - a.score);
    batchedRest.sort((a, b) => b.score - a.score);

    const prioritized = [...dedicatedFirst, ...batchedRest];

    for (let i = 0; i < prioritized.length; i++) {
      prioritized[i].priority = i + 1;
    }

    // 7. Log the full plan
    console.log(`[Planner] ========== INVESTIGATION PLAN FOR ${new Date(nightDate).toISOString().split('T')[0]} ==========`);
    for (const item of prioritized) {
      const incidentRef = scoredIncidents.find(s => s.incidentId === item.incidentId);
      console.log(`  Priority ${item.priority}: ${item.incidentId} | Score: ${item.score} | Type: ${item.runType} ${item.batchId ? `(${item.batchId})` : ''} | Complexity: ${item.complexity}`);
    }
    console.log(`[Planner] Total: ${prioritized.length} incidents (${dedicatedFirst.length} dedicated, ${batchedRest.length} batched into ${batchCounter} batches)`);
    console.log(`[Planner] ========== END PLAN ==========`);

    return prioritized;
  } catch (error) {
    console.error(`[Planner] Error during planning:`, error.message);
    throw error;
  }
};

export default {
  planInvestigations,
};
