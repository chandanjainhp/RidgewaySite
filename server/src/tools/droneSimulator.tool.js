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

const SEEDED_PATROL = {
  patrolId: 'D-Night-04',
  waypoints: [
    {
      location: 'Gate 3',
      lat: 51.5065,
      lng: -0.0890,
      time: '03:12',
      observation: 'Loose wire on fence sensor. No physical breach.',
    },
    {
      location: 'Block C',
      lat: 51.5055,
      lng: -0.0870,
      time: '03:28',
      observation: 'One untagged vehicle near loading bay. Plate unreadable.',
    },
    {
      location: 'Storage Yard B',
      lat: 51.5045,
      lng: -0.0910,
      time: '03:45',
      observation: 'No anomaly detected at time of flyover.',
    },
    {
      location: 'Access Point 7',
      lat: 51.5035,
      lng: -0.0925,
      time: '04:05',
      observation: 'Badge reader functioning normally. No persons present.',
    },
  ],
};

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
const timeToMinutes = (timeStr) => {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return Number.NaN;
  }
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

const formatHHMM = (dateValue, offsetMinutes = 0) => {
  const d = new Date(dateValue);
  d.setMinutes(d.getMinutes() + offsetMinutes);
  return d.toISOString().substring(11, 16);
};

const getPatrolWaypoints = async (patrolId, nightDate = new Date()) => {
  const patrolEvent = await Event.findOne({
    type: 'drone_observation',
    $or: [
      { 'rawData.patrolId': patrolId },
      { 'rawData.droneId': patrolId },
      { 'rawData.patrol': patrolId },
    ],
  }).sort({ timestamp: 1 });

  if (patrolEvent && Array.isArray(patrolEvent.rawData?.observations)) {
    const waypoints = patrolEvent.rawData.observations
      .map((obs, idx) => {
        const locationName = obs.location || patrolEvent.location?.name;
        const siteLocation = SITE_LOCATIONS.find(
          (loc) => loc.name.toLowerCase() === String(locationName || '').toLowerCase()
        );

        return {
          location: locationName || 'Unknown',
          lat: siteLocation?.coordinates?.lat ?? patrolEvent.location?.coordinates?.lat ?? null,
          lng: siteLocation?.coordinates?.lng ?? patrolEvent.location?.coordinates?.lng ?? null,
          time:
            typeof obs.time === 'string' && obs.time.includes(':')
              ? obs.time
              : formatHHMM(patrolEvent.timestamp, idx * 16),
          observation: obs.finding || obs.observation || 'Drone observation',
        };
      })
      .filter((wp) => wp.lat !== null && wp.lng !== null);

    if (waypoints.length > 0) {
      return {
        patrolId,
        waypoints,
      };
    }
  }

  const startOfDay = new Date(nightDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(nightDate);
  endOfDay.setHours(23, 59, 59, 999);

  const droneEvents = await Event.find({
    type: 'drone_observation',
    timestamp: { $gte: startOfDay, $lte: endOfDay },
  }).sort({ timestamp: 1 });

  if (droneEvents.length > 0) {
    return {
      patrolId,
      waypoints: droneEvents.map((event) => ({
        location: event.location.name,
        lat: event.location.coordinates.lat,
        lng: event.location.coordinates.lng,
        time: event.timestamp.toISOString().substring(11, 16),
        observation: event.rawData?.observation || 'Drone observation',
      })),
    };
  }

  return SEEDED_PATROL;
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
    const normalizedTime =
      typeof targetTime === 'string' && targetTime.includes(':')
        ? targetTime
        : new Date(targetTime || Date.now()).toISOString().substring(11, 16);
    const targetMinutes = timeToMinutes(normalizedTime);

    if (Number.isNaN(targetMinutes)) {
      return {
        patrolId,
        targetTime: String(targetTime || ''),
        currentPosition: null,
        lastWaypoint: null,
        nextWaypoint: null,
        observationsToDate: [],
        percentComplete: 0,
        error: 'Invalid time format. Use HH:MM (e.g. 03:28).',
      };
    }

    const patrol = await getPatrolWaypoints(patrolId, nightDate);
    const waypoints = (patrol?.waypoints || [])
      .map((wp) => ({ ...wp, minutes: timeToMinutes(wp.time) }))
      .filter((wp) => !Number.isNaN(wp.minutes))
      .sort((a, b) => a.minutes - b.minutes);

    if (waypoints.length === 0) {
      return {
        patrolId,
        targetTime: normalizedTime,
        currentPosition: null,
        lastWaypoint: null,
        nextWaypoint: null,
        observationsToDate: [],
        percentComplete: 0,
        error: 'No drone observations found for this night',
      };
    }

    let lastWaypoint = null;
    let nextWaypoint = null;
    let waypointsBefore = [];

    for (const waypoint of waypoints) {
      if (waypoint.minutes <= targetMinutes) {
        lastWaypoint = waypoint;
        waypointsBefore.push(waypoint);
      } else if (!nextWaypoint) {
        nextWaypoint = waypoint;
      }
    }

    const observationsToDate = waypointsBefore.map((waypoint) => ({
      location: waypoint.location,
      finding: waypoint.observation,
      time: waypoint.time,
    }));

    let currentPosition = null;

    if (lastWaypoint && nextWaypoint) {
      const lastCoord = { lat: lastWaypoint.lat, lng: lastWaypoint.lng };
      const nextCoord = { lat: nextWaypoint.lat, lng: nextWaypoint.lng };
      const distance = calculateDistance(lastCoord, nextCoord);
      const travelTime = distance / DRONE_SPEED_M_S;

      const lastMinutes = lastWaypoint.minutes;
      const nextMinutes = nextWaypoint.minutes;
      const timeInLeg = targetMinutes - lastMinutes;
      const legMinutes = Math.max(1, nextMinutes - lastMinutes);
      const fraction = Math.min(1, Math.max(0, timeInLeg / legMinutes));

      currentPosition = interpolatePosition(lastCoord, nextCoord, fraction);
    } else if (lastWaypoint) {
      currentPosition = { lat: lastWaypoint.lat, lng: lastWaypoint.lng };
    } else if (nextWaypoint) {
      currentPosition = { lat: nextWaypoint.lat, lng: nextWaypoint.lng };
    }

    const totalWaypoints = waypoints.length;
    const completeWaypoints = waypointsBefore.length;
    const percentComplete = Math.round((completeWaypoints / totalWaypoints) * 100);

    return {
      patrolId,
      targetTime: normalizedTime,
      currentPosition,
      lastWaypoint: lastWaypoint
        ? {
            location: lastWaypoint.location,
            observation: lastWaypoint.observation,
            time: lastWaypoint.time,
          }
        : null,
      nextWaypoint: nextWaypoint
        ? {
            location: nextWaypoint.location,
            estimatedArrival: nextWaypoint.time,
          }
        : null,
      observationsToDate,
      percentComplete,
    };
  } catch (error) {
    console.error(`[DroneSimulator] Error in getDroneStateAtTime:`, error.message);
    return {
      patrolId,
      targetTime: String(targetTime || ''),
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
