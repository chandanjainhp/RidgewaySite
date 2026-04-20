/*
  Logs Tool — Data Access Layer for Overnight Records

  Provides query functions for the Claude agent to access overnight events,
  vehicle tracking, badge swipes, and drone patrols. All functions return
  data formatted as plain English summaries suitable for agent reasoning.
*/

import Event from '../models/event.model.js';
import { getInstances } from '../db/index.js';
import { getDroneObservationsNear } from '../db/graph.js';

/**
 * Format a time as HH:MM string
 * @param {Date} date - date to format
 * @returns {string} HH:MM format
 */
const formatTime = (date) => {
  return date.toISOString().split('T')[1].substring(0, 5);
};

function getDayRange(dateString) {
  const start = new Date(dateString)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateString)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/**
 * Get all overnight security alerts for a given night
 * @param {Date|string} nightDate - the night to retrieve (date only, no time)
 * @returns {Promise<array>} formatted event summaries
 */
export const getOvernightAlerts = async (nightDate) => {
  try {
    const { start, end } = getDayRange(nightDate);

    // Query events from MongoDB
    const events = await Event.find({
      timestamp: { $gte: start, $lte: end },
    }).sort({ timestamp: 1 });

    console.log(
      `[LogsTool] getOvernightAlerts nightDate=${start.toISOString().split('T')[0]} count=${events.length}`
    );

    // Format for agent consumption
    const alerts = events.map((event) => {
      // Create human-readable summary from event type and raw data
      let rawSummary = '';
      switch (event.type) {
        case 'badge_fail':
          rawSummary = `Badge access attempt failed at ${event.location.name}`;
          if (event.rawData?.employeeId) {
            rawSummary += ` by ${event.rawData.employeeId}`;
          }
          break;
        case 'fence_alert':
          rawSummary = `Fence sensor alert at ${event.location.name}`;
          if (event.rawData?.alertType) {
            rawSummary += `: ${event.rawData.alertType}`;
          }
          break;
        case 'motion_sensor':
          rawSummary = `Motion detected at ${event.location.name}`;
          break;
        case 'vehicle_detected':
          rawSummary = `Vehicle detected at ${event.location.name}`;
          if (event.rawData?.vehicleId) {
            rawSummary += `: ${event.rawData.vehicleId}`;
          }
          break;
        case 'light_anomaly':
          rawSummary = `Light timing anomaly at ${event.location.name}`;
          break;
        case 'drone_observation':
          rawSummary = `Drone observation at ${event.location.name}`;
          if (event.rawData?.observation) {
            rawSummary += `: ${event.rawData.observation}`;
          }
          break;
        default:
          rawSummary = `${event.type} at ${event.location.name}`;
      }

      return {
        id: event._id.toString(),
        type: event.type,
        location: event.location.name,
        time: formatTime(event.timestamp),
        severity: event.severity || 'unknown',
        rawSummary,
      };
    });

    return alerts;
  } catch (error) {
    console.error(`[LogsTool] Error in getOvernightAlerts:`, error.message);
    return [];
  }
};

/**
 * Get vehicle movement paths for the night (or specific vehicle)
 * @param {string} vehicleId - optional specific vehicle ID
 * @param {Date|string} nightDate - optional night date
 * @returns {Promise<array>} vehicle path summaries
 */
export const getVehiclePaths = async (vehicleId = null, nightDate) => {
  try {
    const { start, end } = getDayRange(nightDate);

    // Query vehicle events
    const query = {
      type: 'vehicle_detected',
      timestamp: { $gte: start, $lte: end },
    };

    if (vehicleId) {
      query['rawData.vehicleId'] = vehicleId;
    }

    const events = await Event.find(query).sort({ timestamp: 1 });

    console.log(
      `[LogsTool] getVehiclePaths nightDate=${start.toISOString().split('T')[0]} count=${events.length}`
    );

    // Group by vehicle ID
    const vehicleMap = {};

    for (const event of events) {
      const vId = event.rawData?.vehicleId || 'UNKNOWN';

      if (!vehicleMap[vId]) {
        vehicleMap[vId] = {
          vehicleId: vId,
          registrationHint: event.rawData?.registrationPlate || 'unknown',
          locations: [],
          timestamps: [],
        };
      }

      vehicleMap[vId].locations.push({
        name: event.location.name,
        time: formatTime(event.timestamp),
        zone: event.location.zone,
      });
      vehicleMap[vId].timestamps.push(event.timestamp);
    }

    // Format paths
    const paths = Object.values(vehicleMap).map((vehicle) => {
      let pathSummary = `${vehicle.vehicleId}`;

      if (vehicle.locations.length > 0) {
        const locationNames = [...new Set(vehicle.locations.map((l) => l.name))];
        pathSummary += ` traveled ${locationNames.join(' → ')}`;

        const startTime = formatTime(vehicle.timestamps[0]);
        const endTime = formatTime(vehicle.timestamps[vehicle.timestamps.length - 1]);
        const durationMinutes = Math.round(
          (vehicle.timestamps[vehicle.timestamps.length - 1] - vehicle.timestamps[0]) / 60000
        );

        pathSummary += ` between ${startTime}–${endTime} (${durationMinutes} min)`;
      }

      return {
        vehicleId: vehicle.vehicleId,
        registrationHint: vehicle.registrationHint,
        pathSummary,
        locations: vehicle.locations,
        durationMinutes: vehicle.timestamps.length > 1
          ? Math.round(
              (vehicle.timestamps[vehicle.timestamps.length - 1] - vehicle.timestamps[0]) / 60000
            )
          : 0,
      };
    });

    return paths;
  } catch (error) {
    console.error(`[LogsTool] Error in getVehiclePaths:`, error.message);
    return [];
  }
};

/**
 * Get badge swipe history grouped by employee
 * @param {object} filters - optional {locationName, employeeId}
 * @param {Date|string} nightDate - optional night date
 * @returns {Promise<array>} grouped badge swipe summaries
 */
export const getBadgeSwipeHistory = async (filters = {}, nightDate) => {
  try {
    const { start, end } = getDayRange(nightDate);

    // Query badge events
    const query = {
      type: 'badge_fail',
      timestamp: { $gte: start, $lte: end },
    };

    if (filters.locationName) {
      query['location.name'] = filters.locationName;
    }

    if (filters.employeeId) {
      query['rawData.employeeId'] = filters.employeeId;
    }

    const events = await Event.find(query).sort({ timestamp: 1 });

    console.log(
      `[LogsTool] getBadgeSwipeHistory nightDate=${start.toISOString().split('T')[0]} count=${events.length}`
    );

    // Group by employee
    const employeeMap = {};

    for (const event of events) {
      const empId = event.rawData?.employeeId || 'UNKNOWN';
      const displayName = event.rawData?.displayName || empId;

      if (!employeeMap[empId]) {
        employeeMap[empId] = {
          employeeId: empId,
          displayName,
          attempts: [],
          failureCount: 0,
        };
      }

      // Record the attempt
      const attempt = {
        gate: event.location.name,
        time: formatTime(event.timestamp),
        result: event.severity === 'escalate' ? 'failure' : 'failure',
      };

      employeeMap[empId].attempts.push(attempt);
      employeeMap[empId].failureCount++;
    }

    // Analyze patterns
    const history = Object.values(employeeMap).map((employee) => {
      let pattern = '';

      if (employee.failureCount >= 3) {
        // Check for consecutive failures at same location
        const locationCounts = {};
        for (const attempt of employee.attempts) {
          locationCounts[attempt.gate] = (locationCounts[attempt.gate] || 0) + 1;
        }

        const maxLocation = Object.entries(locationCounts).sort(([, a], [, b]) => b - a)[0];

        if (maxLocation && maxLocation[1] >= 3) {
          const timeRange = Math.round(
            (new Date(`1970-01-01T${employee.attempts[employee.attempts.length - 1].time}`) -
              new Date(`1970-01-01T${employee.attempts[0].time}`)) /
              60000
          );
          pattern = `${employee.failureCount} failures (${maxLocation[1]} at ${maxLocation[0]} in ${timeRange} minutes)`;
        } else {
          pattern = `${employee.failureCount} failures across multiple gates`;
        }
      } else if (employee.failureCount > 0) {
        pattern = `${employee.failureCount} failure(s) at ${employee.attempts[0].gate}`;
      }

      return {
        employeeId: employee.employeeId,
        displayName: employee.displayName,
        attempts: employee.attempts,
        failureCount: employee.failureCount,
        pattern,
      };
    });

    return history;
  } catch (error) {
    console.error(`[LogsTool] Error in getBadgeSwipeHistory:`, error.message);
    return [];
  }
};

/**
 * Get the complete drone patrol log for the night
 * @param {Date|string} nightDate - optional night date
 * @returns {Promise<object>} drone patrol summary
 */
export const getDronePatrolLog = async (nightDate) => {
  try {
    const { start, end } = getDayRange(nightDate);

    // Query drone observation events
    const events = await Event.find({
      type: 'drone_observation',
      timestamp: { $gte: start, $lte: end },
    }).sort({ timestamp: 1 });

    console.log(
      `[LogsTool] getDronePatrolLog nightDate=${start.toISOString().split('T')[0]} count=${events.length}`
    );

    if (events.length === 0) {
      return {
        patrolId: 'NONE',
        startTime: null,
        endTime: null,
        routeSummary: 'No drone patrol data available for this night',
        waypoints: [],
        locationsNotCovered: [],
      };
    }

    // Build route summary
    const locations = events.map((e) => e.location.name);
    const uniqueLocations = [...new Set(locations)];
    const routeSummary = `Drone patrol covered ${uniqueLocations.length} locations: ${uniqueLocations.join(', ')}`;

    // Build waypoints
    const waypoints = events.map((event) => ({
      location: event.location.name,
      arrivalTime: formatTime(event.timestamp),
      observation: event.rawData?.observation || 'no notable observations',
      coverageConfidence: event.rawData?.confidence || 'partial',
    }));

    // Determine locations not covered
    // This would be compared against known site locations
    // For now, use a simple heuristic
    const locationsNotCovered = [];

    // Import site locations from graph
    const { initGraph, SITE_LOCATIONS } = await import('../db/graph.js');
    initGraph();

    for (const loc of SITE_LOCATIONS) {
      if (!uniqueLocations.includes(loc.name)) {
        locationsNotCovered.push(loc.name);
      }
    }

    return {
      patrolId: `PATROL-${start.getTime()}`,
      startTime: formatTime(events[0].timestamp),
      endTime: formatTime(events[events.length - 1].timestamp),
      routeSummary,
      waypoints,
      locationsNotCovered,
    };
  } catch (error) {
    console.error(`[LogsTool] Error in getDronePatrolLog:`, error.message);
    return {
      patrolId: 'ERROR',
      startTime: null,
      endTime: null,
      routeSummary: 'Error retrieving drone patrol log',
      waypoints: [],
      locationsNotCovered: [],
    };
  }
};

export default {
  getOvernightAlerts,
  getVehiclePaths,
  getBadgeSwipeHistory,
  getDronePatrolLog,
};
