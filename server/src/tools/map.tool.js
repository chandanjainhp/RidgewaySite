/*
  Map Tool — Spatial Queries & Client Map Data

  Provides:
  1. Spatial queries for the agent (what events are near location X?)
  2. Map geometry for the client (locations, roads, boundaries, event pins)
  3. Drone route playback (polyline with timestamps)
*/

import Event from '../models/event.model.js';
import { getEventsNearLocation as queryGraphNearLocation, SITE_LOCATIONS } from '../db/graph.js';
import { getRedis } from '../db/redis.js';

const CACHE_KEY_MAP_DATA = 'site:map_data';
const CACHE_KEY_DRONE_ROUTE = 'site:drone_route:';
const CACHE_TTL = 60 * 60; // 1 hour in seconds

/**
 * Get events near a specific location within a radius
 * @param {string} locationName - name of the location (e.g., "North Gate")
 * @param {number} radiusMeters - search radius (default 200)
 * @returns {Promise<object>} events and nearest drone waypoint
 */
export const getEventsNearLocation = async (locationName, radiusMeters = 200) => {
  try {
    // Find location by name
    const location = SITE_LOCATIONS.find(
      (loc) => loc.name.toLowerCase() === locationName.toLowerCase()
    );

    if (!location) {
      console.warn(`[MapTool] Location not found: ${locationName}`);
      return {
        location: locationName,
        radiusMeters,
        eventsNearby: [],
        nearestDroneWaypoint: null,
        error: `Location "${locationName}" not found in site database`,
      };
    }

    // Use graph function to get nearby events
    const nearbyEvents = queryGraphNearLocation(location.id, radiusMeters);

    console.log(
      `[MapTool] Found ${nearbyEvents.length} events near ${locationName} (${radiusMeters}m)`
    );

    return {
      location: locationName,
      coordinates: location.coordinates,
      radiusMeters,
      eventsNearby: nearbyEvents.map((event) => ({
        id: event._id?.toString() || event.id,
        type: event.type,
        time: event.timestamp?.toISOString?.() || event.timestamp,
        severity: event.severity || 'unknown',
        description: event.description || `${event.type} event`,
      })),
      nearestDroneWaypoint: null, // Would be populated from drone observations if available
    };
  } catch (error) {
    console.error(`[MapTool] Error in getEventsNearLocation:`, error.message);
    return {
      location: locationName,
      radiusMeters,
      eventsNearby: [],
      error: error.message,
    };
  }
};

/**
 * Get complete site map data (locations, roads, boundaries)
 * Cached in Redis for 1 hour
 * @returns {Promise<object>} map geometry for client
 */
export const getSiteMapData = async () => {
  try {
    const redis = getRedis();

    // Try to load from Redis cache
    try {
      const cached = await redis.get(CACHE_KEY_MAP_DATA);
      if (cached) {
        console.log(`[MapTool] Loaded site map data from cache`);
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      console.warn(`[MapTool] Cache miss, regenerating map data:`, cacheError.message);
    }

    // Build map data from site locations
    const locations = SITE_LOCATIONS.map((loc) => ({
      id: loc.id,
      name: loc.name,
      type: loc.type, // 'gate' | 'yard' | 'block' | 'accesspoint'
      coordinates: loc.coordinates,
      zone: mapTypeToZone(loc.type),
    }));

    // Generate roads (connections between adjacent locations)
    const roads = generateRoadConnections(locations);

    // Generate perimeter boundary
    const boundaries = generateBoundaries(locations);

    const mapData = {
      timestamp: new Date().toISOString(),
      locations,
      roads,
      boundaries,
    };

    // Cache in Redis
    try {
      await redis.setex(CACHE_KEY_MAP_DATA, CACHE_TTL, JSON.stringify(mapData));
    } catch (cacheError) {
      console.warn(`[MapTool] Failed to cache map data:`, cacheError.message);
    }

    console.log(
      `[MapTool] Generated site map: ${locations.length} locations, ${roads.length} roads, ${boundaries.length} boundaries`
    );

    return mapData;
  } catch (error) {
    console.error(`[MapTool] Error in getSiteMapData:`, error.message);
    return {
      locations: [],
      roads: [],
      boundaries: [],
      error: error.message,
    };
  }
};

/**
 * Get drone patrol route as a polyline with timestamps
 * @param {string} patrolId - patrol ID (e.g., 'PATROL-{timestamp}')
 * @param {Date|string} nightDate - optional night date
 * @returns {Promise<array>} ordered waypoints for route playback
 */
export const getDroneRouteGeometry = async (patrolId, nightDate = new Date()) => {
  try {
    const cacheKey = `${CACHE_KEY_DRONE_ROUTE}${patrolId}`;
    const redis = getRedis();

    // Try cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[MapTool] Loaded drone route from cache: ${patrolId}`);
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      // Cache miss is fine, regenerate
    }

    // Query drone observations sorted by time
    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    const droneEvents = await Event.find({
      type: 'drone_observation',
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ timestamp: 1 });

    console.log(`[MapTool] Retrieved ${droneEvents.length} drone observations for route`);

    // Build waypoint sequence
    const waypoints = droneEvents.map((event, index) => {
      const location = SITE_LOCATIONS.find(
        (loc) => loc.name.toLowerCase() === event.location.name.toLowerCase()
      );

      return {
        index,
        location: event.location.name,
        coordinates: location?.coordinates || event.location.coordinates,
        timestamp: event.timestamp.toISOString(),
        time: event.timestamp.toISOString().split('T')[1].substring(0, 5),
        observation: event.rawData?.observation || 'patrol waypoint',
        confidence: event.rawData?.confidence || 'partial',
      };
    });

    // Cache the route
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(waypoints));
    } catch (cacheError) {
      console.warn(`[MapTool] Failed to cache drone route:`, cacheError.message);
    }

    return waypoints;
  } catch (error) {
    console.error(`[MapTool] Error in getDroneRouteGeometry:`, error.message);
    return [];
  }
};

/**
 * Get all events for the night as map pins
 * @param {Date|string} nightDate - the night to retrieve
 * @returns {Promise<array>} event pins for map
 */
export const getEventPins = async (nightDate = new Date()) => {
  try {
    const startOfDay = new Date(nightDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(nightDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Query all events for the night
    const events = await Event.find({
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ timestamp: 1 });

    console.log(`[MapTool] Retrieved ${events.length} events for pins`);

    // Convert to pins
    const pins = events.map((event) => ({
      id: event._id.toString(),
      type: event.type,
      coordinates: event.location.coordinates,
      location: event.location.name,
      severity: event.severity || 'unknown',
      incidentId: event.incidentId ? event.incidentId.toString() : null,
      tooltip: `${formatEventType(event.type)} — ${event.location.name} — ${event.timestamp
        .toISOString()
        .split('T')[1]
        .substring(0, 5)}`,
      timestamp: event.timestamp.toISOString(),
      investigated: !!event.investigationId,
    }));

    return pins;
  } catch (error) {
    console.error(`[MapTool] Error in getEventPins:`, error.message);
    return [];
  }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Map location type to zone name
 */
const mapTypeToZone = (type) => {
  const typeToZone = {
    gate: 'perimeter',
    yard: 'yard',
    block: 'block',
    accesspoint: 'access_point',
  };
  return typeToZone[type] || 'yard';
};

/**
 * Generate road connections between nearby locations
 */
const generateRoadConnections = (locations) => {
  const roads = [];
  const R = 6371e3; // Earth's radius in meters

  const calculateDistance = (coord1, coord2) => {
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

  // Connect locations within 500 meters
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const distance = calculateDistance(locations[i].coordinates, locations[j].coordinates);

      if (distance < 500) {
        roads.push({
          id: `road_${i}_${j}`,
          name: `${locations[i].name} to ${locations[j].name}`,
          path: [locations[i].coordinates, locations[j].coordinates],
          distance,
        });
      }
    }
  }

  return roads;
};

/**
 * Generate boundary polygons for the site
 */
const generateBoundaries = (locations) => {
  // Find perimeter locations (gates, outermost points)
  const perimeter = locations.filter((loc) => loc.type === 'gate').map((loc) => loc.coordinates);

  // Sort by angle to create a proper polygon
  if (perimeter.length > 0) {
    const centerLat = perimeter.reduce((sum, p) => sum + p.lat, 0) / perimeter.length;
    const centerLng = perimeter.reduce((sum, p) => sum + p.lng, 0) / perimeter.length;

    perimeter.sort((a, b) => {
      const angleA = Math.atan2(a.lat - centerLat, a.lng - centerLng);
      const angleB = Math.atan2(b.lat - centerLat, b.lng - centerLng);
      return angleA - angleB;
    });
  }

  return [
    {
      id: 'boundary_perimeter',
      name: 'Site Perimeter',
      type: 'perimeter',
      coordinates: perimeter.length > 0 ? perimeter : locations.map((loc) => loc.coordinates),
    },
  ];
};

/**
 * Format event type as human-readable string
 */
const formatEventType = (type) => {
  const typeNames = {
    badge_fail: 'Badge Failure',
    fence_alert: 'Fence Alert',
    motion_sensor: 'Motion Detected',
    vehicle_detected: 'Vehicle Detected',
    light_anomaly: 'Light Anomaly',
    drone_observation: 'Drone Observation',
  };
  return typeNames[type] || type;
};

export default {
  getEventsNearLocation,
  getSiteMapData,
  getDroneRouteGeometry,
  getEventPins,
};
