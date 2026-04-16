/*
  Drone Simulator Tool — Patrol Replay & Follow-Up Planning

  Two functions:
  1. Replay: Where was the drone at time T?
  2. Follow-up simulation: What would a follow-up patrol look like?

  Used by the client's timeline slider and follow-up incident planning.
*/

import Event from '../models/event.model.js';
import { SITE_LOCATIONS } from '../db/graph.js';

const DRONE_SPEED_M_S = 15; // meters per second

/**
 * Helper: Calculate Haversine distance between two coordinates
 */
const calculateDistance = (coord1, coord2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

/**
 * Helper: Interpolate position between two coordinates
 */
const interpolatePosition = (from, to, fraction) => {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  };
};

/**
 * Helper: Parse time string to minutes from midnight
 */
const parseTime = (timeStr) => {
  if (typeof timeStr === 'string' && timeStr.includes(':')) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  } else if (timeStr instanceof Date) {
    return timeStr.getHours() * 60 + timeStr.getMinutes();
  }
  return 0;
};

/**
 * Get drone state (position + observations) at a specific time
 * @param {string} patrolId - patrol ID (e.g., 'PATROL-{timestamp}')
 * @param {Date|string} targetTime - target time (Date or 'HH:MM')
 * @param {Date|string} nightDate - the night of the patrol
 * @returns {Promise<object>} drone state at target time
 */
export const getDroneStateAtTime = async (patrolId, targetTime, nightDate = new Date()) => {
  try {
    // Load all drone observations for this night
    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    const droneEvents = await Event.find({
      type: 'drone_observation',
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ timestamp: 1 });

    console.log(`[DroneSimulator] Loaded ${droneEvents.length} drone waypoints`);

    if (droneEvents.length === 0) {
      return {
        patrolId,
        targetTime: targetTime.toString(),
        currentPosition: null,
        lastWaypoint: null,
        nextWaypoint: null,
        observationsToDate: [],
        percentComplete: 0,
        error: 'No drone observations found for this night',
      };
    }

    const targetMinutes = parseTime(targetTime);

    // Find waypoints before and after target time
    let lastWaypoint = null;
    let nextWaypoint = null;
    let waypointsBefore = [];

    for (const event of droneEvents) {
      const eventMinutes = event.timestamp.getHours() * 60 + event.timestamp.getMinutes();

      if (eventMinutes <= targetMinutes) {
        lastWaypoint = event;
        waypointsBefore.push(event);
      } else if (!nextWaypoint) {
        nextWaypoint = event;
      }
    }

    // Build observations up to target time
    const observationsToDate = waypointsBefore.map((event) => ({
      location: event.location.name,
      finding: event.rawData?.observation || 'patrol waypoint',
      time: event.timestamp.toISOString().split('T')[1].substring(0, 5),
    }));

    // Calculate current position (interpolate between last and next waypoint)
    let currentPosition = null;

    if (lastWaypoint && nextWaypoint) {
      const lastCoord = lastWaypoint.location.coordinates;
      const nextCoord = nextWaypoint.location.coordinates;
      const distance = calculateDistance(lastCoord, nextCoord);
      const travelTime = distance / DRONE_SPEED_M_S;

      const lastMinutes = lastWaypoint.timestamp.getHours() * 60 + lastWaypoint.timestamp.getMinutes();
      const nextMinutes = nextWaypoint.timestamp.getHours() * 60 + nextWaypoint.timestamp.getMinutes();
      const timeInLeg = targetMinutes - lastMinutes;
      const fraction = Math.min(1, Math.max(0, timeInLeg / (nextMinutes - lastMinutes)));

      currentPosition = interpolatePosition(lastCoord, nextCoord, fraction);
    } else if (lastWaypoint) {
      // Target time is after last waypoint, stay at last position
      currentPosition = lastWaypoint.location.coordinates;
    } else if (nextWaypoint) {
      // Target time is before first waypoint
      currentPosition = nextWaypoint.location.coordinates;
    }

    // Calculate percent complete
    const totalWaypoints = droneEvents.length;
    const completeWaypoints = waypointsBefore.length;
    const percentComplete = Math.round((completeWaypoints / totalWaypoints) * 100);

    return {
      patrolId,
      targetTime: targetTime.toString(),
      currentPosition,
      lastWaypoint: lastWaypoint
        ? {
            location: lastWaypoint.location.name,
            observation: lastWaypoint.rawData?.observation || 'patrol waypoint',
            time: lastWaypoint.timestamp.toISOString().split('T')[1].substring(0, 5),
          }
        : null,
      nextWaypoint: nextWaypoint
        ? {
            location: nextWaypoint.location.name,
            estimatedArrival: nextWaypoint.timestamp.toISOString().split('T')[1].substring(0, 5),
          }
        : null,
      observationsToDate,
      percentComplete,
    };
  } catch (error) {
    console.error(`[DroneSimulator] Error in getDroneStateAtTime:`, error.message);
    return {
      patrolId,
      targetTime: targetTime.toString(),
      error: error.message,
      currentPosition: null,
      lastWaypoint: null,
      nextWaypoint: null,
      observationsToDate: [],
      percentComplete: 0,
    };
  }
};

/**
 * Simulate a follow-up drone mission for flagged locations
 * @param {array} flaggedLocations - [{name, coordinates, priority}]
 * @returns {Promise<object>} simulated mission plan
 */
export const simulateFollowUpMission = async (flaggedLocations) => {
  try {
    if (!flaggedLocations || flaggedLocations.length === 0) {
      return {
        missionId: `D-Followup-ERROR`,
        error: 'No flagged locations provided',
        estimatedDeparture: null,
        estimatedDuration: null,
        route: [],
        coverageMap: [],
        routeGeometry: [],
      };
    }

    console.log(
      `[DroneSimulator] Planning follow-up mission for ${flaggedLocations.length} locations`
    );

    // Route optimization: nearest-neighbor greedy algorithm
    const optimizedRoute = optimizeRoute(flaggedLocations);

    // Calculate route geometry and timings
    let totalDistance = 0;
    let currentPosition = optimizedRoute[0]?.coordinates || { lat: 51.5, lng: -0.1 };
    const routeGeometry = [currentPosition];

    const route = optimizedRoute.map((location, index) => {
      const distance = calculateDistance(currentPosition, location.coordinates);
      totalDistance += distance;
      const travelTime = distance / DRONE_SPEED_M_S; // seconds
      const arrivalMinutes = Math.floor(travelTime / 60);

      currentPosition = location.coordinates;
      routeGeometry.push(currentPosition);

      return {
        index,
        location: location.name,
        coordinates: location.coordinates,
        estimatedArrival: `T+${arrivalMinutes}m`,
        objective: `Assess ${location.name} (Priority: ${location.priority})`,
        estimatedObservationTime: '3m',
      };
    });

    // Build coverage map
    const allLocations = SITE_LOCATIONS.map((loc) => loc.name);
    const flaggedLocationNames = flaggedLocations.map((loc) => loc.name);
    const coverageMap = allLocations.map((locName) => ({
      locationName: locName,
      covered: flaggedLocationNames.includes(locName),
    }));

    // Estimate mission times
    const totalTime = totalDistance / DRONE_SPEED_M_S + route.length * 180; // 3min per waypoint
    const totalMinutes = Math.ceil(totalTime / 60);

    const departurTime = new Date();
    departurTime.setMinutes(departurTime.getMinutes() + 30); // 30 min from now

    return {
      missionId: `D-Followup-${Date.now().toString().slice(-5)}`,
      estimatedDeparture: departurTime.toISOString().split('T')[1].substring(0, 5),
      estimatedDuration: `${totalMinutes} minutes`,
      totalDistance: `${Math.round(totalDistance)} meters`,
      route,
      coverageMap,
      routeGeometry,
    };
  } catch (error) {
    console.error(`[DroneSimulator] Error in simulateFollowUpMission:`, error.message);
    return {
      missionId: `D-Followup-ERROR`,
      error: error.message,
      estimatedDeparture: null,
      estimatedDuration: null,
      route: [],
      coverageMap: [],
      routeGeometry: [],
    };
  }
};

/**
 * Optimize route using nearest-neighbor greedy algorithm
 * @param {array} locations - [{name, coordinates, priority}]
 * @returns {array} optimized route (list of locations)
 */
const optimizeRoute = (locations) => {
  if (locations.length <= 1) {
    return locations;
  }

  // Sort by priority first (highest priority = smallest number)
  const sorted = [...locations].sort((a, b) => (a.priority || 999) - (b.priority || 999));

  // Greedy nearest-neighbor from first location
  const route = [sorted[0]];
  const remaining = sorted.slice(1);

  while (remaining.length > 0) {
    const current = route[route.length - 1];
    let nearest = remaining[0];
    let minDistance = calculateDistance(current.coordinates, remaining[0].coordinates);

    for (const location of remaining) {
      const distance = calculateDistance(current.coordinates, location.coordinates);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = location;
      }
    }

    route.push(nearest);
    remaining.splice(remaining.indexOf(nearest), 1);
  }

  return route;
};

export default {
  getDroneStateAtTime,
  simulateFollowUpMission,
};
