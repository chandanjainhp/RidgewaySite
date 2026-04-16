/*
  OVERNIGHT SEED DATA FOR RIDGEWAY SITE

  Represents one night's security data that Maya investigates at 6:10 AM.
  The seed tells a complete story through realistic midnight→early morning events.
*/

import mongoose from 'mongoose';

// Get or create collections (bypassing models for seed flexibility)
const getCollection = (collectionName) => {
  return mongoose.connection.collection(collectionName);
};

// Base date: yesterday (or configurable via SEED_DATE env)
const getSeedDate = () => {
  if (process.env.SEED_DATE) {
    return new Date(process.env.SEED_DATE);
  }
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
};

// Helper: Create timestamp for the night
const createTimestamp = (hour, minute, second = 0) => {
  const date = getSeedDate();
  date.setHours(hour, minute, second, 0);
  return date;
};

// Coordinates matching graph.js locations
const SEED_LOCATIONS = {
  northGate: { id: 'loc:north_gate', lat: 51.5050, lng: -0.1005, name: 'North Gate' },
  southGate: { id: 'loc:south_gate', lat: 51.4950, lng: -0.1005, name: 'South Gate' },
  eastYard: { id: 'loc:east_yard', lat: 51.5000, lng: -0.0950, name: 'East Yard' },
  westYard: { id: 'loc:west_yard', lat: 51.5000, lng: -0.1060, name: 'West Yard' },
  storageBlockA: { id: 'loc:storage_block_a', lat: 51.5025, lng: -0.0980, name: 'Storage Block A' },
  storageBlockB: { id: 'loc:storage_block_b', lat: 51.5000, lng: -0.1020, name: 'Storage Block B' },
  officeBuilding: { id: 'loc:office_building', lat: 51.4980, lng: -0.0990, name: 'Office Building' },
  warehouse: { id: 'loc:warehouse', lat: 51.4970, lng: -0.1040, name: 'Warehouse' },
};

// THE NIGHT'S EVENTS (told through data)
const seedEvents = [
  // 01:10 — Badge swipe failures (employee at wrong gate)
  {
    eventId: 'EVT-2026-04-15-001',
    nightDate: getSeedDate(),
    type: 'badge_fail',
    severity: 'harmless',
    timestamp: createTimestamp(1, 10, 0),
    location: {
      name: 'Access Point 7',
      coordinates: {
        lat: SEED_LOCATIONS.officeBuilding.lat,
        lng: SEED_LOCATIONS.officeBuilding.lng,
      },
      zone: 'access_point',
    },
    rawData: {
      attempts: 3,
      employeeId: 'E-112',
      employeeName: 'Arjun Mehra',
      badgeId: 'BDG-7741',
      reason: 'Usual gate under maintenance',
    },
    description: 'Badge swipe failed - employee at wrong access point',
  },

  // 02:14 — Fence sensor alert (loose wire, harmless)
  {
    eventId: 'EVT-2026-04-15-002',
    nightDate: getSeedDate(),
    type: 'fence_alert',
    severity: 'monitor',
    timestamp: createTimestamp(2, 14, 0),
    location: {
      name: 'North Gate',
      coordinates: {
        lat: SEED_LOCATIONS.northGate.lat,
        lng: SEED_LOCATIONS.northGate.lng,
      },
      zone: 'perimeter',
    },
    rawData: {
      sensorId: 'FENCE-NG-01',
      detectionSignal: 'vibration_detected',
      initialAssessment: 'likely_mechanical',
    },
    description: 'Fence sensor alert at North Gate',
  },

  // 03:10 — Motion sensor near canteen (fox - noise)
  {
    eventId: 'EVT-2026-04-15-003',
    nightDate: getSeedDate(),
    type: 'motion_sensor',
    severity: 'harmless',
    timestamp: createTimestamp(3, 10, 0),
    location: {
      name: 'Canteen Perimeter',
      coordinates: {
        lat: SEED_LOCATIONS.warehouse.lat + 0.0005,
        lng: SEED_LOCATIONS.warehouse.lng + 0.0005,
      },
      zone: 'yard',
    },
    rawData: {
      sensorId: 'MOTION-CANT-02',
      confidence: 'low_signal',
      likelySource: 'wildlife',
    },
    description: 'Motion detected near canteen facility',
  },

  // 03:12 — Drone patrol flyover with observations
  {
    eventId: 'EVT-2026-04-15-004',
    nightDate: getSeedDate(),
    type: 'drone_observation',
    severity: 'escalate',
    timestamp: createTimestamp(3, 12, 0),
    location: {
      name: 'Storage Block A',
      coordinates: {
        lat: SEED_LOCATIONS.storageBlockA.lat,
        lng: SEED_LOCATIONS.storageBlockA.lng,
      },
      zone: 'block',
    },
    rawData: {
      droneId: 'D-Night-04',
      patrolId: 'PATROL-2026-04-15-N01',
      observations: [
        { location: 'Gate 3', finding: 'loose_wire on perimeter sensor' },
        { location: 'Storage Block A', finding: 'untagged_vehicle near loading bay' },
        { location: 'Storage Block B', finding: 'no_anomaly' },
      ],
      unresolvedVehicle: 'V-UNKNOWN-01',
    },
    description: 'Drone patrol observation - untagged vehicle at Block A',
  },

  // 03:40 — Vehicle V-09 enters site (contractor, not pre-logged)
  {
    eventId: 'EVT-2026-04-15-005',
    nightDate: getSeedDate(),
    type: 'vehicle_detected',
    severity: 'escalate',
    timestamp: createTimestamp(3, 40, 0),
    location: {
      name: 'South Gate',
      coordinates: {
        lat: SEED_LOCATIONS.southGate.lat,
        lng: SEED_LOCATIONS.southGate.lng,
      },
      zone: 'perimeter',
    },
    rawData: {
      vehicleId: 'V-09',
      registrationPlate: 'CONTRACTOR-FLEET-3',
      vehicleType: 'white transit van',
      driver: 'Unknown',
      preAuthorized: false,
      notes: 'Contractor vehicle without advance notice',
    },
    description: 'Vehicle entry - contractor fleet, not pre-authorized',
  },

  // 03:45 — Vehicle V-09 at Road 4 checkpoint (in transit)
  {
    eventId: 'EVT-2026-04-15-006',
    nightDate: getSeedDate(),
    type: 'vehicle_detected',
    severity: 'monitor',
    timestamp: createTimestamp(3, 45, 0),
    location: {
      name: 'Road 4 Checkpoint',
      coordinates: {
        lat: SEED_LOCATIONS.eastYard.lat,
        lng: SEED_LOCATIONS.eastYard.lng,
      },
      zone: 'road',
    },
    rawData: {
      vehicleId: 'V-09',
      checkpoint: 'road_4',
      status: 'in_transit',
    },
    description: 'Vehicle checkpoint crossing',
  },

  // 03:52 — Vehicle V-09 arrives at Storage Block B (destination)
  {
    eventId: 'EVT-2026-04-15-007',
    nightDate: getSeedDate(),
    type: 'vehicle_detected',
    severity: 'monitor',
    timestamp: createTimestamp(3, 52, 0),
    location: {
      name: 'Storage Block B',
      coordinates: {
        lat: SEED_LOCATIONS.storageBlockB.lat,
        lng: SEED_LOCATIONS.storageBlockB.lng,
      },
      zone: 'block',
    },
    rawData: {
      vehicleId: 'V-09',
      destination: 'Storage Yard B',
      status: 'parked',
      durationMinutes: 12,
    },
    description: 'Vehicle arrival at Storage Block B',
  },

  // 04:15 — Light timer malfunction (noise event)
  {
    eventId: 'EVT-2026-04-15-008',
    nightDate: getSeedDate(),
    type: 'light_anomaly',
    severity: 'harmless',
    timestamp: createTimestamp(4, 15, 0),
    location: {
      name: 'Admin Block',
      coordinates: {
        lat: SEED_LOCATIONS.officeBuilding.lat,
        lng: SEED_LOCATIONS.officeBuilding.lng,
      },
      zone: 'access_point',
    },
    rawData: {
      systemId: 'LIGHT-TIMER-ADM-03',
      issue: 'timer_malfunction',
      lights: 'unexpected_cycle',
    },
    description: 'Light timer malfunction near Admin Block',
  },
];

const seedVehicles = [
  {
    vehicleId: 'V-09',
    registrationPlate: 'CONTRACTOR-FLEET-3',
    type: 'white transit van',
    owner: 'Skylark Contractors Inc.',
    status: 'active',
    notes: 'Contractor vehicle - night deliveries authorized',
    lastSeen: createTimestamp(3, 52, 0),
  },
  {
    vehicleId: 'V-UNKNOWN-01',
    registrationPlate: null,
    type: 'untagged',
    owner: 'Unknown',
    status: 'unidentified',
    notes: 'Untagged vehicle observed near Storage Block A by drone',
    firstSeen: createTimestamp(3, 12, 0),
  },
];

const seedEmployees = [
  {
    employeeId: 'E-112',
    name: 'Arjun Mehra',
    badgeId: 'BDG-7741',
    role: 'Night Maintenance Crew',
    department: 'Facilities',
    accessLevel: 'restricted',
    notes: 'Usually accesses via East Gate; West Gate under maintenance tonight',
  },
];

const seedDronePatrols = [
  {
    patrolId: 'PATROL-2026-04-15-N01',
    droneId: 'D-Night-04',
    date: getSeedDate(),
    startTime: createTimestamp(3, 0, 0),
    endTime: createTimestamp(3, 30, 0),
    waypoints: [
      {
        sequence: 1,
        location: 'North Gate',
        coordinates: { lat: SEED_LOCATIONS.northGate.lat, lng: SEED_LOCATIONS.northGate.lng },
        timestamp: createTimestamp(3, 5, 0),
        observation: 'Fence sensor with loose wire detected',
      },
      {
        sequence: 2,
        location: 'Storage Block A',
        coordinates: { lat: SEED_LOCATIONS.storageBlockA.lat, lng: SEED_LOCATIONS.storageBlockA.lng },
        timestamp: createTimestamp(3, 12, 0),
        observation: 'ALERT: Untagged vehicle near loading bay - V-UNKNOWN-01',
      },
      {
        sequence: 3,
        location: 'Storage Block B',
        coordinates: { lat: SEED_LOCATIONS.storageBlockB.lat, lng: SEED_LOCATIONS.storageBlockB.lng },
        timestamp: createTimestamp(3, 25, 0),
        observation: 'No anomalies detected',
      },
    ],
    status: 'completed',
  },
];

const seedSiteNotes = [
  {
    noteId: 'NOTE-2026-04-15-001',
    author: 'Raghav Kumar',
    authorRole: 'Night Security Supervisor',
    timestamp: createTimestamp(5, 0, 0),
    content: 'Please check Block C before leadership asks. Drone spotted untagged vehicle near loading bay at 03:12. Need clarification on V-09 arrival — not in advance log.',
    priority: 'high',
    category: 'investigation_note',
  },
];

// Check if seed data already exists for this date
const seedDataExists = async () => {
  try {
    const seedDate = getSeedDate();
    const nextDate = new Date(seedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const eventsCollection = getCollection('events');
    const count = await eventsCollection.countDocuments({
      timestamp: {
        $gte: seedDate,
        $lt: nextDate,
      },
    });

    return count > 0;
  } catch (error) {
    console.error('[Seed] Error checking if seed data exists:', error.message);
    return false;
  }
};

export const seedOvernightData = async () => {
  try {
    // Never run in production
    if (process.env.NODE_ENV === 'production') {
      console.log('[Seed] Skipped: production environment');
      return;
    }

    // Check if data already exists
    if (await seedDataExists()) {
      console.log('[Seed] Data already exists for this date, skipping seed');
      return;
    }

    console.log('[Seed] Starting seed data insertion...');

    // Insert events
    const eventsCollection = getCollection('events');
    const eventResult = await eventsCollection.insertMany(seedEvents);
    console.log(`[Seed] ✓ Inserted ${eventResult.insertedCount} events`);

    // Insert vehicles
    const vehiclesCollection = getCollection('vehicles');
    const vehicleResult = await vehiclesCollection.insertMany(seedVehicles);
    console.log(`[Seed] ✓ Inserted ${vehicleResult.insertedCount} vehicles`);

    // Insert employees
    const employeesCollection = getCollection('employees');
    const employeeResult = await employeesCollection.insertMany(seedEmployees);
    console.log(`[Seed] ✓ Inserted ${employeeResult.insertedCount} employees`);

    // Insert drone patrols
    const patrolsCollection = getCollection('dronePatrols');
    const patrolResult = await patrolsCollection.insertMany(seedDronePatrols);
    console.log(`[Seed] ✓ Inserted ${patrolResult.insertedCount} drone patrols`);

    // Insert site notes
    const notesCollection = getCollection('siteNotes');
    const notesResult = await notesCollection.insertMany(seedSiteNotes);
    console.log(`[Seed] ✓ Inserted ${notesResult.insertedCount} site notes`);

    console.log('[Seed] ✓ All overnight data seeded successfully');
  } catch (error) {
    console.error('[Seed] Failed to seed overnight data:', error.message);
    throw error;
  }
};

export const clearSeedData = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clear seed data in production');
    }

    console.log('[Seed] Clearing seed data...');

    const seedDate = getSeedDate();
    const nextDate = new Date(seedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Clear events from seed date
    const eventsCollection = getCollection('events');
    const eventDeleteResult = await eventsCollection.deleteMany({
      timestamp: {
        $gte: seedDate,
        $lt: nextDate,
      },
    });
    console.log(`[Seed] ✓ Deleted ${eventDeleteResult.deletedCount} events`);

    // Clear other collections (full clear for test cleanup)
    const vehiclesCollection = getCollection('vehicles');
    const vehicleDeleteResult = await vehiclesCollection.deleteMany({});
    console.log(`[Seed] ✓ Deleted ${vehicleDeleteResult.deletedCount} vehicles`);

    const employeesCollection = getCollection('employees');
    const employeeDeleteResult = await employeesCollection.deleteMany({});
    console.log(`[Seed] ✓ Deleted ${employeeDeleteResult.deletedCount} employees`);

    const patrolsCollection = getCollection('dronePatrols');
    const patrolDeleteResult = await patrolsCollection.deleteMany({});
    console.log(`[Seed] ✓ Deleted ${patrolDeleteResult.deletedCount} drone patrols`);

    const notesCollection = getCollection('siteNotes');
    const notesDeleteResult = await notesCollection.deleteMany({});
    console.log(`[Seed] ✓ Deleted ${notesDeleteResult.deletedCount} site notes`);

    console.log('[Seed] ✓ Seed data cleared');
  } catch (error) {
    console.error('[Seed] Failed to clear seed data:', error.message);
    throw error;
  }
};
