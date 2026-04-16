/*
  IN-MEMORY GRAPH FOR SPATIAL AND RELATIONAL QUERIES
  Lightweight adjacency-list structure built from overnight data.
  Resets on server restart (seed data is deterministic).
*/

// Ridgeway Site location grid (UK industrial site, ~51.5°N, 0.1°W)
const SITE_LOCATIONS = [
  {
    id: 'loc:north_gate',
    name: 'North Gate',
    type: 'gate',
    coordinates: { lat: 51.5050, lng: -0.1005 },
  },
  {
    id: 'loc:south_gate',
    name: 'South Gate',
    type: 'gate',
    coordinates: { lat: 51.4950, lng: -0.1005 },
  },
  {
    id: 'loc:east_yard',
    name: 'East Yard',
    type: 'yard',
    coordinates: { lat: 51.5000, lng: -0.0950 },
  },
  {
    id: 'loc:west_yard',
    name: 'West Yard',
    type: 'yard',
    coordinates: { lat: 51.5000, lng: -0.1060 },
  },
  {
    id: 'loc:storage_block_a',
    name: 'Storage Block A',
    type: 'block',
    coordinates: { lat: 51.5025, lng: -0.0980 },
  },
  {
    id: 'loc:storage_block_b',
    name: 'Storage Block B',
    type: 'block',
    coordinates: { lat: 51.5000, lng: -0.1020 },
  },
  {
    id: 'loc:office_building',
    name: 'Office Building',
    type: 'accesspoint',
    coordinates: { lat: 51.4980, lng: -0.0990 },
  },
  {
    id: 'loc:warehouse',
    name: 'Warehouse',
    type: 'accesspoint',
    coordinates: { lat: 51.4970, lng: -0.1040 },
  },
];

// Graph adjacency structure
const graph = {
  nodes: new Map(), // nodeId -> { id, type, ...data }
  edges: new Map(), // "fromId->toId" -> { from, to, type, weight?, ...data }
  index: {
    nodesByType: new Map(), // type -> Set of nodeIds
    edgesByType: new Map(), // type -> Set of edge keys
  },
};

// Helper: Calculate distance between two coordinates (Haversine formula)
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

// Helper: Add node to graph
const addNode = (node) => {
  graph.nodes.set(node.id, node);

  if (!graph.index.nodesByType.has(node.type)) {
    graph.index.nodesByType.set(node.type, new Set());
  }
  graph.index.nodesByType.get(node.type).add(node.id);
};

// Helper: Add edge to graph
const addEdge = (fromId, toId, type, weight = null, data = {}) => {
  const edgeKey = `${fromId}->${toId}`;
  graph.edges.set(edgeKey, {
    from: fromId,
    to: toId,
    type,
    weight,
    ...data,
  });

  if (!graph.index.edgesByType.has(type)) {
    graph.index.edgesByType.set(type, new Set());
  }
  graph.index.edgesByType.get(type).add(edgeKey);
};

// Initialize graph from seed data
const initGraph = async () => {
  try {
    console.log('[Graph] Initializing in-memory graph...');

    // Add all location nodes
    SITE_LOCATIONS.forEach((loc) => {
      addNode(loc);
    });

    // Build NEAR edges for locations (bidirectional, within 600m radius)
    for (let i = 0; i < SITE_LOCATIONS.length; i++) {
      for (let j = i + 1; j < SITE_LOCATIONS.length; j++) {
        const dist = calculateDistance(
          SITE_LOCATIONS[i].coordinates,
          SITE_LOCATIONS[j].coordinates
        );

        if (dist <= 600) {
          addEdge(
            SITE_LOCATIONS[i].id,
            SITE_LOCATIONS[j].id,
            'NEAR',
            dist,
            { distance: dist }
          );
          addEdge(
            SITE_LOCATIONS[j].id,
            SITE_LOCATIONS[i].id,
            'NEAR',
            dist,
            { distance: dist }
          );
        }
      }
    }

    console.log(
      `[Graph] ✓ Initialized: ${graph.nodes.size} nodes, ${graph.edges.size} edges`
    );
    return graph;
  } catch (error) {
    console.error('[Graph] Initialization failed:', error.message);
    throw error;
  }
};

// Query: Get events within radius of a location
const getEventsNearLocation = (locationId, radiusMeters = 300) => {
  try {
    const events = [];
    const visited = new Set();

    const bfs = (currentId, remainingRadius) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = graph.nodes.get(currentId);
      if (node && node.type === 'event' && remainingRadius >= 0) {
        events.push(node);
      }

      // Follow NEAR edges within radius
      graph.edges.forEach((edge) => {
        if (
          edge.from === currentId &&
          edge.type === 'NEAR' &&
          edge.weight <= remainingRadius
        ) {
          bfs(edge.to, remainingRadius - edge.weight);
        }
      });
    };

    bfs(locationId, radiusMeters);
    return events;
  } catch (error) {
    console.error('[Graph] getEventsNearLocation failed:', error.message);
    return [];
  }
};

// Query: Get all events connected within 2 hops
const getRelatedEvents = (eventId) => {
  try {
    const relatedEvents = [];
    const visited = new Set();

    const dfs = (nodeId, depth = 0) => {
      if (visited.has(nodeId) || depth > 2) return;
      visited.add(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node && node.type === 'event' && nodeId !== eventId) {
        relatedEvents.push(node);
      }

      // Follow all edge types
      graph.edges.forEach((edge) => {
        if (edge.from === nodeId && !visited.has(edge.to)) {
          dfs(edge.to, depth + 1);
        }
      });
    };

    dfs(eventId);
    return relatedEvents;
  } catch (error) {
    console.error('[Graph] getRelatedEvents failed:', error.message);
    return [];
  }
};

// Query: Get timeline of events at and near a location
const getLocationTimeline = (locationId) => {
  try {
    const events = [];

    // Direct OCCURRED_AT events
    graph.edges.forEach((edge) => {
      if (edge.to === locationId && edge.type === 'OCCURRED_AT') {
        const event = graph.nodes.get(edge.from);
        if (event) events.push(event);
      }
    });

    // Events in nearby locations
    const nearbyEvents = getEventsNearLocation(locationId, 300);
    nearbyEvents.forEach((event) => {
      if (!events.find((e) => e.id === event.id)) {
        events.push(event);
      }
    });

    // Sort by timestamp
    return events.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });
  } catch (error) {
    console.error('[Graph] getLocationTimeline failed:', error.message);
    return [];
  }
};

// Query: Get drone observations near a location
const getDroneObservationsNear = (locationId, radiusMeters = 300) => {
  try {
    const observations = [];
    const visited = new Set();

    const bfs = (currentId, remainingRadius) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      // Check for OBSERVED_BY edges
      graph.edges.forEach((edge) => {
        if (edge.from === currentId && edge.type === 'OBSERVED_BY') {
          const waypoint = graph.nodes.get(edge.to);
          if (waypoint && waypoint.type === 'droneWaypoint') {
            observations.push(waypoint);
          }
        }
      });

      // Follow NEAR edges within radius
      graph.edges.forEach((edge) => {
        if (
          edge.from === currentId &&
          edge.type === 'NEAR' &&
          edge.weight <= remainingRadius
        ) {
          bfs(edge.to, remainingRadius - edge.weight);
        }
      });
    };

    bfs(locationId, radiusMeters);
    return observations;
  } catch (error) {
    console.error('[Graph] getDroneObservationsNear failed:', error.message);
    return [];
  }
};

// Mutation: Add event node and edges at runtime
const addEventNode = (event) => {
  try {
    // Add event node
    addNode({
      id: event.id,
      type: 'event',
      ...event,
    });

    // Add OCCURRED_AT edge if location is specified
    if (event.locationId && graph.nodes.has(event.locationId)) {
      addEdge(event.id, event.locationId, 'OCCURRED_AT');
    }

    // Add INVOLVES edges for vehicle or employee
    if (event.vehicleId) {
      if (!graph.nodes.has(event.vehicleId)) {
        addNode({
          id: event.vehicleId,
          type: 'vehicle',
          registrationHint: event.vehicleHint || 'Unknown',
        });
      }
      addEdge(event.id, event.vehicleId, 'INVOLVES');
    }

    if (event.employeeId) {
      if (!graph.nodes.has(event.employeeId)) {
        addNode({
          id: event.employeeId,
          type: 'employee',
          badgeId: event.badgeId || 'Unknown',
        });
      }
      addEdge(event.id, event.employeeId, 'INVOLVES');
    }

    console.log(`[Graph] Event node added: ${event.id}`);
  } catch (error) {
    console.error('[Graph] addEventNode failed:', error.message);
    throw error;
  }
};

// Utility: Get all nodes of a specific type
const getNodesByType = (type) => {
  const nodeIds = graph.index.nodesByType.get(type) || new Set();
  return Array.from(nodeIds).map((id) => graph.nodes.get(id));
};

const getGraph = () => graph;

export {
  initGraph,
  getEventsNearLocation,
  getRelatedEvents,
  getLocationTimeline,
  getDroneObservationsNear,
  addEventNode,
  getNodesByType,
  getGraph,
  SITE_LOCATIONS,
  calculateDistance,
};
