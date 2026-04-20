/*
  OVERNIGHT SEED DATA FOR RIDGEWAY SITE

  Represents one night's security data that Maya investigates at 6:10 AM.
  The seed tells a complete story through realistic midnight→early morning events.
*/

import mongoose from 'mongoose';
import { User } from '../models/user.models.js';
import Incident from '../models/incident.model.js';
import Event from '../models/event.model.js';

// Get or create collections (bypassing models for seed flexibility)
const getCollection = (collectionName) => {
  return mongoose.connection.collection(collectionName);
};

const getLocalYesterdayDateString = () => {
  const now = new Date();
  now.setDate(now.getDate() - 1);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// Base date: local yesterday at midnight using local date components.
const getSeedDate = () => {
  const dateString = getLocalYesterdayDateString();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

// Helper: Create timestamp for the night
const createTimestamp = (hour, minute, second = 0) => {
  const date = getSeedDate();
  date.setHours(hour, minute, second, 0);
  return date;
};

// Coordinates matching graph.js locations
const SEED_LOCATIONS = {
  gate3: { id: 'loc:gate_3', lat: 51.5050, lng: -0.1005, name: 'Gate 3' },
  southGate: { id: 'loc:south_gate', lat: 51.4950, lng: -0.1005, name: 'South Gate' },
  accessPoint7: { id: 'loc:access_point_7', lat: 51.4980, lng: -0.0990, name: 'Access Point 7' },
  blockC: { id: 'loc:block_c', lat: 51.5025, lng: -0.0980, name: 'Block C' },
  storageYardB: { id: 'loc:storage_yard_b', lat: 51.5000, lng: -0.1020, name: 'Storage Yard B' },
  road4: { id: 'loc:road_4_checkpoint', lat: 51.5000, lng: -0.0950, name: 'Road 4 Checkpoint' },
  adminBlock: { id: 'loc:admin_block', lat: 51.4980, lng: -0.0990, name: 'Admin Block' },
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
        lat: SEED_LOCATIONS.accessPoint7.lat,
        lng: SEED_LOCATIONS.accessPoint7.lng,
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
      name: 'Gate 3',
      coordinates: {
        lat: SEED_LOCATIONS.gate3.lat,
        lng: SEED_LOCATIONS.gate3.lng,
      },
      zone: 'perimeter',
    },
    rawData: {
      sensorId: 'FENCE-NG-01',
      detectionSignal: 'vibration_detected',
      initialAssessment: 'likely_mechanical',
    },
    description: 'Fence sensor alert at Gate 3',
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
      name: 'Block C',
      coordinates: {
        lat: SEED_LOCATIONS.blockC.lat,
        lng: SEED_LOCATIONS.blockC.lng,
      },
      zone: 'block',
    },
    rawData: {
      droneId: 'D-Night-04',
      patrolId: 'PATROL-2026-04-15-N01',
      observations: [
        { location: 'Gate 3', finding: 'loose_wire on perimeter sensor' },
        { location: 'Block C', finding: 'untagged_vehicle near loading bay' },
        { location: 'Storage Yard B', finding: 'authorized contractor vehicle V-09 unlogged' },
        { location: 'Access Point 7', finding: 'multiple badge failures, no tailgating observed' },
      ],
      unresolvedVehicle: 'V-UNKNOWN-01',
    },
    description: 'Drone patrol observation - untagged vehicle near Block C loading bay',
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
        lat: SEED_LOCATIONS.road4.lat,
        lng: SEED_LOCATIONS.road4.lng,
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
      name: 'Storage Yard B',
      coordinates: {
        lat: SEED_LOCATIONS.storageYardB.lat,
        lng: SEED_LOCATIONS.storageYardB.lng,
      },
      zone: 'block',
    },
    rawData: {
      vehicleId: 'V-09',
      destination: 'Storage Yard B',
      status: 'parked',
      durationMinutes: 12,
    },
    description: 'Vehicle arrival at Storage Yard B',
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
        lat: SEED_LOCATIONS.adminBlock.lat,
        lng: SEED_LOCATIONS.adminBlock.lng,
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
        location: 'Gate 3',
        coordinates: { lat: SEED_LOCATIONS.gate3.lat, lng: SEED_LOCATIONS.gate3.lng },
        timestamp: createTimestamp(3, 5, 0),
        observation: 'Fence sensor with loose wire detected',
      },
      {
        sequence: 2,
        location: 'Block C',
        coordinates: { lat: SEED_LOCATIONS.blockC.lat, lng: SEED_LOCATIONS.blockC.lng },
        timestamp: createTimestamp(3, 12, 0),
        observation: 'ALERT: Untagged vehicle near loading bay - V-UNKNOWN-01',
      },
      {
        sequence: 3,
        location: 'Storage Yard B',
        coordinates: { lat: SEED_LOCATIONS.storageYardB.lat, lng: SEED_LOCATIONS.storageYardB.lng },
        timestamp: createTimestamp(3, 25, 0),
        observation: 'Authorized contractor vehicle observed, pre-log missing',
      },
      {
        sequence: 4,
        location: 'Access Point 7',
        coordinates: { lat: SEED_LOCATIONS.accessPoint7.lat, lng: SEED_LOCATIONS.accessPoint7.lng },
        timestamp: createTimestamp(3, 29, 0),
        observation: 'Three badge failures reviewed, employee likely at wrong gate',
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

// Check if seed data already exists for this date using nightDate field
const seedDataExists = async () => {
  try {
    const nightDate = getSeedDate();
    const existing = await Event.findOne({ nightDate });
    return !!existing;
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

    // IDEMPOTENCY CHECK: Only seed if data for this nightDate doesn't exist
    const nightDate = getSeedDate();
    const dataExists = await seedDataExists();
    if (dataExists) {
      const dateStr = nightDate.toISOString().split('T')[0];
      console.log(`[Seed] ✓ Data already exists for ${dateStr} — skipping seed`);
      return;
    }

    console.log('[Seed] Starting seed data insertion...');

    // Replace deterministic event IDs to keep seed idempotent across restarts.
    const seedEventIds = seedEvents.map((event) => event.eventId);
    const eventsCollection = getCollection('events');
    await eventsCollection.deleteMany({ eventId: { $in: seedEventIds } });
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

    console.log(`[Seed] ✓ nightDate used: ${nightDate.toISOString()} → YYYY-MM-DD: ${nightDate.toISOString().split('T')[0]}`);
    console.log('[Seed] ✓ All overnight data seeded successfully');
  } catch (error) {
    console.error('[Seed] Failed to seed overnight data:', error.message);
    // Do not crash server startup on seed issues.
    return;
  }
};

export const seedTestUsers = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('[Seed] Skipped test users in production');
      return;
    }

    console.log('[Seed] Seeding test users...');

    // Clear existing test users (avoid duplicate unique key errors)
    // const usersCollection = getCollection('users');
    // await usersCollection.deleteMany({
    //   email: { $in: ['maya@ridgeway.com', 'operator@ridgeway.com'] }
    // });

    // Create test users - password will be hashed by schema pre-save hook
    const testUsers = [
      {
        username: 'maya',
        email: 'maya@ridgeway.com',
        fullName: 'Maya Operations',
        password: 'password123', // Will be hashed by User.create
        isEmailVerified: true,
      },
      {
        username: 'operator',
        email: 'operator@ridgeway.com',
        fullName: 'Site Operator',
        password: 'password123',
        isEmailVerified: true,
      },
    ];

    // Use User model to save (triggers password hashing in pre-save middleware)
    for (const userData of testUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`[Seed]   ✓ Created user: ${userData.email}`);
      }
    }

    console.log('[Seed] ✓ Test users ready');
  } catch (error) {
    console.error('[Seed] Failed to seed test users:', error.message);
    // Don't throw - test users are optional
  }
};

export const seedIncidents = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('[Seed] Skipped incidents in production');
      return;
    }

    console.log('[Seed] Seeding incidents...');

    const eventsCollection = getCollection('events');
    const incidentsCollection = getCollection('incidents');

    // Clear existing seed incidents
    await incidentsCollection.deleteMany({
      title: { $in: [
        'Untagged vehicle near Block C',
        'Perimeter security alerts',
        'Access badge failure pattern',
        'Noise and facility anomalies'
      ]}
    });

    // Get event IDs to reference
    const evt004 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-004' });
    const evt001 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-001' });
    const evt005 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-005' });
    const evt006 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-006' });
    const evt007 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-007' });
    const evt002 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-002' });
    const evt003 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-003' });
    const evt008 = await eventsCollection.findOne({ eventId: 'EVT-2026-04-15-008' });

    const seedDate = getSeedDate();

    const seedIncidentsData = [
      {
        nightDate: seedDate,
        title: 'Untagged vehicle near Block C',
        description: 'Drone observed untagged vehicle near Block C loading bay; requires leadership-ready explanation',
        eventIds: evt004 && evt005 && evt006 && evt007 ? [evt004._id, evt005._id, evt006._id, evt007._id] : [],
        primaryLocation: {
          name: 'Block C',
          coordinates: { lat: SEED_LOCATIONS.blockC.lat, lng: SEED_LOCATIONS.blockC.lng },
          zone: 'block',
        },
        correlationType: 'entity',
        entityInvolved: {
          type: 'vehicle',
          id: 'V-09',
          displayName: 'Contractor Vehicle V-09',
        },
        status: 'pending',
        priority: 1,
        severity: 'escalate',
        finalSeverity: 'escalate',
        raghavsNote: true,
      },
      {
        nightDate: seedDate,
        title: 'Perimeter security alerts',
        description: 'Fence sensor alert at Gate 3 likely caused by loose wire; drone confirmed harmless',
        eventIds: evt002 ? [evt002._id] : [],
        primaryLocation: {
          name: 'Gate 3',
          coordinates: { lat: SEED_LOCATIONS.gate3.lat, lng: SEED_LOCATIONS.gate3.lng },
          zone: 'perimeter',
        },
        correlationType: 'spatial',
        status: 'pending',
        priority: 3,
        severity: 'monitor',
        finalSeverity: 'monitor',
      },
      {
        nightDate: seedDate,
        title: 'Access badge failure pattern',
        description: 'Three badge failures at Access Point 7 between 01:10 and 01:13 by employee at wrong gate',
        eventIds: evt001 ? [evt001._id] : [],
        primaryLocation: {
          name: 'Access Point 7',
          coordinates: { lat: SEED_LOCATIONS.accessPoint7.lat, lng: SEED_LOCATIONS.accessPoint7.lng },
          zone: 'access_point',
        },
        correlationType: 'temporal',
        status: 'pending',
        priority: 4,
        severity: 'monitor',
        finalSeverity: 'monitor',
      },
      {
        nightDate: seedDate,
        title: 'Noise and facility anomalies',
        description: 'Canteen motion sensor triggered by fox and admin lighting timer malfunction',
        eventIds: evt003 && evt008 ? [evt003._id, evt008._id] : [],
        primaryLocation: {
          name: 'Admin Block',
          coordinates: { lat: SEED_LOCATIONS.adminBlock.lat, lng: SEED_LOCATIONS.adminBlock.lng },
          zone: 'access_point',
        },
        correlationType: 'spatial',
        status: 'pending',
        priority: 5,
        severity: 'harmless',
        finalSeverity: 'harmless',
      },
    ];

    const incidentResult = await incidentsCollection.insertMany(seedIncidentsData);
    console.log(`[Seed] ✓ Inserted ${incidentResult.insertedCount} incidents`);
  } catch (error) {
    console.error('[Seed] Failed to seed incidents:', error.message);
    // Don't throw - incidents are optional
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

    // Clear events - both by seed date AND by hardcoded eventId patterns
    const eventsCollection = getCollection('events');
    const eventDeleteResult = await eventsCollection.deleteMany({
      $or: [
        // Events from the seed date range
        {
          timestamp: {
            $gte: seedDate,
            $lt: nextDate,
          },
        },
        // Hardcoded seed event IDs (regardless of date)
        {
          eventId: { $regex: '^EVT-2026-04-' },
        },
      ],
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

    // Clear incidents with seed data
    const incidentsCollection = getCollection('incidents');
    const incidentDeleteResult = await incidentsCollection.deleteMany({
      nightDate: {
        $gte: seedDate,
        $lt: nextDate,
      },
    });
    console.log(`[Seed] ✓ Deleted ${incidentDeleteResult.deletedCount} incidents`);

    console.log('[Seed] ✓ Seed data cleared');
  } catch (error) {
    console.error('[Seed] Failed to clear seed data:', error.message);
    throw error;
  }
};
