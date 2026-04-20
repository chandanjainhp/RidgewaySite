/*
  Correlation Service — Group Events into Incidents

  Bridges raw sensor data and agent investigation targets.
  Runs three clustering strategies to identify meaningful incident groups.
  Uses graph.js spatial queries for location correlation.
*/

import Event from '../models/event.model.js';
import Incident from '../models/incident.model.js';
import { ApiError } from '../utils/api-error.js';
import { getEventsNearLocation } from '../tools/map.tool.js';

// Clustering constants
const SPATIAL_DISTANCE_M = 200;          // 200m proximity threshold
const SPATIAL_TIME_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const TEMPORAL_TIME_WINDOW_MS = 30 * 60 * 1000;   // 30 minutes
const CROSS_TYPE_TIME_WINDOW_MS = 45 * 60 * 1000; // 45 minutes

function getDayRange(dateString) {
  const start = new Date(dateString)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateString)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}


/**
 * Main entry point — Correlate all events for a night into incidents
 * Runs all three clustering strategies and deduplicates overlapping clusters
 * @param {Date|string} nightDate - night to correlate
 * @returns {Promise<array>} created Incident IDs
 */
export const correlateNightEvents = async (nightDate) => {
  try {
    console.log(`[CorrelationService] Correlating events for ${nightDate}`);

    const { start, end } = getDayRange(nightDate);

    // Fetch all events for the night
    const events = await Event.find({
      nightDate: { $gte: start, $lte: end },
    }).lean();

    if (events.length === 0) {
      console.log(`[CorrelationService] No events found for ${nightDate}`);
      return [];
    }

    console.log(`[CorrelationService] Processing ${events.length} events`);

    // Run all three clustering strategies
    const spatialClusters = await spatialClustering(events);
    const temporalClusters = await temporalChaining(events);
    const crossTypeClusters = await crossTypeCorrelation(events);

    // Combine all clusters
    const allClusters = [
      ...spatialClusters,
      ...temporalClusters,
      ...crossTypeClusters,
    ];

    console.log(`[CorrelationService] Found ${allClusters.length} total clusters`);

    // Deduplicate overlapping clusters (merge if they share 50%+ of events)
    const deduplicatedClusters = deduplicateClusters(allClusters);

    console.log(
      `[CorrelationService] After deduplication: ${deduplicatedClusters.length} clusters`
    );

    // Create incident documents
    const incidentIds = [];
    for (const cluster of deduplicatedClusters) {
      const incident = await Incident.create({
        incidentId: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nightDate: start,
        title: generateIncidentTitle(cluster),
        description: generateIncidentDescription(cluster),
        eventIds: cluster.eventIds,
        correlation: {
          type: cluster.correlationType,
          strategy: cluster.strategy,
          metadata: cluster.metadata || {},
        },
        severity: 'uncertain', // AI determines severity
        priority: calculateInitialPriority(cluster),
        status: 'pending',
        raghavsNote: cluster.metadata?.blockC ? true : false,
      });

      // Update events to link to incident
      await Event.updateMany(
        { _id: { $in: cluster.eventIds } },
        { incidentId: incident._id }
      );

      incidentIds.push(incident._id);
      console.log(
        `[CorrelationService] Created incident ${incident.incidentId} (${cluster.correlationType})`
      );
    }

    console.log(
      `[CorrelationService] Correlation complete: ${incidentIds.length} incidents created`
    );

    return incidentIds;
  } catch (error) {
    console.error(`[CorrelationService] Error correlating events:`, error.message);
    throw new ApiError(500, 'Failed to correlate events', [error.message]);
  }
};

/**
 * Spatial clustering — events within 200m of each other within 2 hours
 * @param {array} events - Event documents
 * @returns {Promise<array>} clusters with correlationType: 'spatial'
 */
export const spatialClustering = async (events) => {
  try {
    const clusters = [];
    const processed = new Set();

    console.log(`[CorrelationService] Spatial clustering: ${events.length} events`);

    for (const event of events) {
      if (processed.has(event._id.toString())) continue;

      const locationName = event.location?.name;
      if (!locationName) continue;

      // Find all events within 200m occurring within 2 hours
      const cluster = [event];
      processed.add(event._id.toString());

      for (const otherEvent of events) {
        if (processed.has(otherEvent._id.toString())) continue;
        if (!otherEvent.location?.name) continue;

        // Check time window
        const timeDiff = Math.abs(event.detectedAt - otherEvent.detectedAt);
        if (timeDiff > SPATIAL_TIME_WINDOW_MS) continue;

        // Check spatial proximity
        try {
          const nearby = await getEventsNearLocation(
            otherEvent.location,
            SPATIAL_DISTANCE_M
          );

          if (nearby.some((e) => e._id.toString() === event._id.toString())) {
            cluster.push(otherEvent);
            processed.add(otherEvent._id.toString());
          }
        } catch (err) {
          continue;
        }
      }

      // Add cluster if 2+ events
      if (cluster.length >= 2) {
        clusters.push({
          eventIds: cluster.map((e) => e._id),
          correlationType: 'spatial',
          strategy: 'spatial_clustering',
          metadata: {
            locationName,
            eventCount: cluster.length,
            timeSpanMs: Math.max(...cluster.map((e) => e.detectedAt)) -
              Math.min(...cluster.map((e) => e.detectedAt)),
          },
        });
      }
    }

    console.log(`[CorrelationService] Spatial clustering found ${clusters.length} clusters`);
    return clusters;
  } catch (error) {
    console.error(`[CorrelationService] Error in spatial clustering:`, error.message);
    return [];
  }
};

/**
 * Temporal chaining — 2+ events of same type by same entity within 30 minutes
 * Catches badge failure patterns (same employeeId, same gate)
 * @param {array} events - Event documents
 * @returns {Promise<array>} clusters with correlationType: 'temporal'
 */
export const temporalChaining = async (events) => {
  try {
    const clusters = [];
    const entityEvents = {};

    console.log(`[CorrelationService] Temporal chaining: ${events.length} events`);

    // Group events by entity
    for (const event of events) {
      let entityKey = null;
      let entityType = null;
      let entityId = null;

      if (event.sourceType === 'badge' && event.employeeId) {
        entityKey = `badge:${event.employeeId}:${event.location?.name}`;
        entityType = 'badge';
        entityId = event.employeeId;
      } else if (event.sourceType === 'vehicle' && event.vehicleId) {
        entityKey = `vehicle:${event.vehicleId}`;
        entityType = 'vehicle';
        entityId = event.vehicleId;
      } else if (event.sourceType === 'fence' && event.location?.name) {
        entityKey = `fence:${event.location.name}`;
        entityType = 'fence';
        entityId = event.location.name;
      }

      if (entityKey) {
        if (!entityEvents[entityKey]) {
          entityEvents[entityKey] = [];
        }
        entityEvents[entityKey].push(event);
      }
    }

    // Find temporal chains (2+ events within 30 mins)
    for (const [entityKey, entityEventList] of Object.entries(entityEvents)) {
      if (entityEventList.length < 2) continue;

      // Sort by time
      entityEventList.sort((a, b) => a.detectedAt - b.detectedAt);

      // Find chains within 30 minutes
      for (let i = 0; i < entityEventList.length - 1; i++) {
        const chain = [entityEventList[i]];

        for (let j = i + 1; j < entityEventList.length; j++) {
          const timeDiff = entityEventList[j].detectedAt - entityEventList[i].detectedAt;
          if (timeDiff <= TEMPORAL_TIME_WINDOW_MS) {
            chain.push(entityEventList[j]);
          } else {
            break;
          }
        }

        if (chain.length >= 2) {
          // Detect if it's a badge failure pattern (multiple failed attempts)
          const pattern = entityKey.includes('badge')
            ? `badge_failed_attempts:${chain.length}`
            : `repeated_${entityKey.split(':')[0]}`;

          clusters.push({
            eventIds: chain.map((e) => e._id),
            correlationType: 'temporal',
            strategy: 'temporal_chaining',
            metadata: {
              entityKey,
              entityType: entityKey.split(':')[0],
              entityId: entityKey.split(':')[1],
              pattern,
              eventCount: chain.length,
              timeSpanMs: chain[chain.length - 1].detectedAt - chain[0].detectedAt,
            },
          });
        }
      }
    }

    console.log(`[CorrelationService] Temporal chaining found ${clusters.length} clusters`);
    return clusters;
  } catch (error) {
    console.error(`[CorrelationService] Error in temporal chaining:`, error.message);
    return [];
  }
};

/**
 * Cross-type correlation
 * Finds vehicle_detected + fence_alert at same location within 45 mins
 * Also flags events at locations where drone found something notable
 * @param {array} events - Event documents
 * @returns {Promise<array>} clusters with correlationType: 'cross_type'
 */
export const crossTypeCorrelation = async (events) => {
  try {
    const clusters = [];
    const eventsByLocation = {};

    console.log(`[CorrelationService] Cross-type correlation: ${events.length} events`);

    // Group events by location
    for (const event of events) {
      const locationName = event.location?.name;
      if (!locationName) continue;

      if (!eventsByLocation[locationName]) {
        eventsByLocation[locationName] = [];
      }
      eventsByLocation[locationName].push(event);
    }

    // Find cross-type patterns at same location
    for (const [locationName, locationEvents] of Object.entries(eventsByLocation)) {
      if (locationEvents.length < 2) continue;

      // Look for vehicle + fence combinations within 45 minutes
      const vehicles = locationEvents.filter((e) => e.sourceType === 'vehicle');
      const fences = locationEvents.filter((e) => e.sourceType === 'fence');
      const drones = locationEvents.filter((e) => e.sourceType === 'drone');

      // Vehicle + fence within 45 minutes
      for (const vEvent of vehicles) {
        for (const fEvent of fences) {
          const timeDiff = Math.abs(vEvent.detectedAt - fEvent.detectedAt);
          if (timeDiff <= CROSS_TYPE_TIME_WINDOW_MS) {
            clusters.push({
              eventIds: [vEvent._id, fEvent._id],
              correlationType: 'cross_type',
              strategy: 'cross_type_correlation',
              metadata: {
                locationName,
                types: ['vehicle', 'fence'],
                suspicionLevel: 'medium',
                description: 'Vehicle detected with fence breach in proximity',
              },
            });
          }
        }
      }

      // Flag events at locations where drone spotted something
      if (drones.length > 0) {
        const nonDroneEvents = locationEvents.filter((e) => e.sourceType !== 'drone');
        for (const event of nonDroneEvents) {
          // Check if event is near drone observation time
          const nearDrone = drones.some(
            (d) => Math.abs(d.detectedAt - event.detectedAt) <= CROSS_TYPE_TIME_WINDOW_MS
          );

          if (nearDrone) {
            clusters.push({
              eventIds: [event._id],
              correlationType: 'cross_type',
              strategy: 'drone_proximity',
              metadata: {
                locationName,
                droneObservation: true,
                description: 'Event occurred near drone observation',
                suspicionLevel: 'high',
              },
            });
          }
        }
      }

      // Block C flag
      if (locationName.includes('Block C') || locationName.includes('BlockC')) {
        for (const cluster of clusters) {
          if (cluster.metadata.locationName === locationName) {
            cluster.metadata.blockC = true;
          }
        }
      }
    }

    console.log(`[CorrelationService] Cross-type correlation found ${clusters.length} clusters`);
    return clusters;
  } catch (error) {
    console.error(`[CorrelationService] Error in cross-type correlation:`, error.message);
    return [];
  }
};

/**
 * Get events by location (used by correlate_events_by_location tool)
 * @param {string} locationName - location name
 * @param {number} radiusMeters - search radius in meters
 * @returns {Promise<array>} formatted events with drone observations
 */
export const getEventsByLocation = async (locationName, radiusMeters = 200, nightDate) => {
  try {
    const { start, end } = getDayRange(nightDate);
    console.log(
      `[CorrelationService] Fetching events for ${locationName} within ${radiusMeters}m on ${start.toISOString().split('T')[0]}`
    );

    const events = await Event.find({
      'location.name': locationName,
      timestamp: { $gte: start, $lte: end },
    })
      .lean()
      .sort({ timestamp: -1 });

    const sourceTypeFromEventType = (type) => {
      if (type === 'vehicle_detected') return 'vehicle';
      if (type === 'badge_fail') return 'badge';
      if (type === 'fence_alert') return 'fence';
      if (type === 'drone_observation') return 'drone';
      if (type === 'motion_sensor') return 'motion';
      if (type === 'light_anomaly') return 'light';
      return 'unknown';
    };

    // Format for Claude
    const formatted = events.map((e) => ({
      eventId: e._id,
      type: e.type,
      sourceType: sourceTypeFromEventType(e.type),
      detectedAt: e.timestamp,
      location: e.location?.name,
      details: {
        vehicleId: e.rawData?.vehicleId || null,
        employeeId: e.rawData?.employeeId || null,
        description: e.description,
      },
    }));

    // Add drone observations
    const drones = await Event.find({
      'location.name': locationName,
      type: 'drone_observation',
      timestamp: { $gte: start, $lte: end },
    })
      .lean();

    const droneObservations = drones.length > 0 ? {
      droneActivity: true,
      droneEventCount: drones.length,
      latestObservation: drones[0]?.description,
    } : null;

    console.log(
      `[CorrelationService] getEventsByLocation nightDate=${start.toISOString().split('T')[0]} count=${formatted.length} droneCount=${drones.length}`
    );

    return {
      location: locationName,
      eventCount: formatted.length,
      events: formatted,
      droneObservations,
    };
  } catch (error) {
    console.error(`[CorrelationService] Error getting events by location:`, error.message);
    throw new ApiError(500, 'Failed to get events by location', [error.message]);
  }
};

/**
 * Deduplicate overlapping clusters
 * Merges clusters that share 50%+ of events
 */
const deduplicateClusters = (clusters) => {
  const result = [];
  const used = new Set();

  for (let i = 0; i < clusters.length; i++) {
    if (used.has(i)) continue;

    const primary = clusters[i];
    const primarySet = new Set(primary.eventIds.map((e) => e.toString()));
    let merged = { ...primary };

    for (let j = i + 1; j < clusters.length; j++) {
      if (used.has(j)) continue;

      const secondary = clusters[j];
      const secondarySet = new Set(secondary.eventIds.map((e) => e.toString()));

      // Calculate overlap
      const intersection = [...primarySet].filter((e) => secondarySet.has(e)).length;
      const overlapRatio = intersection / Math.min(primarySet.size, secondarySet.size);

      if (overlapRatio >= 0.5) {
        // Merge clusters
        merged.eventIds = [...new Set([...merged.eventIds.map((e) => e.toString()), ...secondary.eventIds.map((e) => e.toString())])];
        used.add(j);
      }
    }

    result.push(merged);
    used.add(i);
  }

  return result;
};

/**
 * Generate incident title from cluster
 */
const generateIncidentTitle = (cluster) => {
  const { correlationType, metadata } = cluster;

  switch (correlationType) {
    case 'spatial':
      return `Co-located events at ${metadata.locationName}`;
    case 'temporal':
      return `Repeated ${metadata.pattern} by ${metadata.entityId}`;
    case 'cross_type':
      return `Cross-type correlation at ${metadata.locationName}`;
    default:
      return 'Correlated incident';
  }
};

/**
 * Generate incident description from cluster
 */
const generateIncidentDescription = (cluster) => {
  const { correlationType, metadata, eventIds } = cluster;

  switch (correlationType) {
    case 'spatial':
      return `${metadata.eventCount} events detected within ${metadata.timeSpanMs}ms at ${metadata.locationName}`;
    case 'temporal':
      return `${metadata.pattern}: ${metadata.eventCount} events within ${metadata.timeSpanMs}ms`;
    case 'cross_type':
      return `Cross-type event: ${metadata.description}`;
    default:
      return `${eventIds.length} correlated events`;
  }
};

/**
 * Calculate initial priority based on cluster characteristics
 */
const calculateInitialPriority = (cluster) => {
  const { correlationType, metadata } = cluster;

  // High priority: cross-type with drone, vehicle+fence, block C
  if (correlationType === 'cross_type') {
    if (metadata.droneObservation) return 1; // Highest
    if (metadata.blockC) return 2;
    return 3;
  }

  // Medium: temporal (repeated patterns)
  if (correlationType === 'temporal') {
    if (metadata.pattern?.includes('badge_failed')) return 2;
    return 3;
  }

  // Lower: spatial
  if (correlationType === 'spatial') {
    return 4;
  }

  return 5;
};

export default {
  correlateNightEvents,
  spatialClustering,
  temporalChaining,
  crossTypeCorrelation,
  getEventsByLocation,
};
