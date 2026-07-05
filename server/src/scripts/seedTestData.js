import "dotenv/config";
import mongoose from "mongoose";

if (process.env.NODE_ENV === "production") {
  console.error("FATAL: seedTestData.js cannot run in production");
  process.exit(1);
}
if (!process.env.ALLOW_SEED_DATA) {
  console.error("Set ALLOW_SEED_DATA=true to run this script");
  process.exit(1);
}
import bcrypt from "bcrypt";
import Organisation from "../models/organisation.model.js";
import { User } from "../models/user.models.js";
import Event from "../models/event.model.js";
import Incident from "../models/incident.model.js";
import Briefing from "../models/briefing.model.js";

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("[seed] MONGODB_URI / MONGODB_URL not set");
  process.exit(1);
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const LOCATIONS = [
  {
    name: "Gate A",
    coordinates: { lat: 51.5074, lng: -0.1278 },
    zone: "access_point",
  },
  {
    name: "Gate B",
    coordinates: { lat: 51.508, lng: -0.1265 },
    zone: "access_point",
  },
  {
    name: "Perimeter North",
    coordinates: { lat: 51.509, lng: -0.127 },
    zone: "perimeter",
  },
  {
    name: "Yard East",
    coordinates: { lat: 51.5068, lng: -0.1255 },
    zone: "yard",
  },
  { name: "Block C", coordinates: { lat: 51.506, lng: -0.128 }, zone: "block" },
  {
    name: "Road Entrance",
    coordinates: { lat: 51.5055, lng: -0.129 },
    zone: "road",
  },
];

const EVENT_TEMPLATES = [
  { type: "motion_detected", location: LOCATIONS[0], hour: 2, min: 15 },
  { type: "fence_alert", location: LOCATIONS[2], hour: 2, min: 30 },
  { type: "vehicle_entry", location: LOCATIONS[5], hour: 3, min: 0 },
  { type: "badge_swipe_fail", location: LOCATIONS[1], hour: 3, min: 20 },
  { type: "motion_detected", location: LOCATIONS[3], hour: 3, min: 45 },
  { type: "environmental", location: LOCATIONS[4], hour: 4, min: 0 },
  { type: "fence_alert", location: LOCATIONS[2], hour: 4, min: 25 },
  { type: "vehicle_entry", location: LOCATIONS[5], hour: 4, min: 50 },
  { type: "badge_swipe_fail", location: LOCATIONS[1], hour: 5, min: 10 },
  { type: "motion_detected", location: LOCATIONS[0], hour: 5, min: 30 },
];

async function findOrCreateOrg() {
  let org = await Organisation.findOne({});
  if (org) {
    console.log(`[seed] Org found: "${org.name}" (${org._id})`);
    return org;
  }
  org = await Organisation.create({
    name: "Test Organisation",
    slug: "test-org",
    status: "active",
    plan: "trial",
  });
  console.log(`[seed] Org created: "${org.name}" (${org._id})`);
  return org;
}

async function findOrCreateUser({ email, username, role, orgId }) {
  let user = await User.findOne({ $or: [{ email }, { username }] });
  if (user) {
    console.log(`[seed] User exists: ${email} (${user.role}). Force updating password and active status...`);
    user.password = "Admin123!";
    user.role = role;
    user.orgId = orgId || null;
    user.isActive = true;
    user.isEmailVerified = true;
    await user.save(); // pre-save hook will hash this plain text
    return user;
  }
  try {
    user = await User.create({
      email,
      username,
      password: "Admin123!",
      role,
      orgId: orgId || null,
      isActive: true,
      isEmailVerified: true,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Retry with email-derived username to avoid collisions
      const fallbackUsername = email
        .split("@")[0]
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
      user = await User.create({
        email,
        username: `${fallbackUsername}-seed`,
        password: "Admin123!",
        role,
        orgId: orgId || null,
        isActive: true,
        isEmailVerified: true,
      });
    } else {
      throw err;
    }
  }
  console.log(`[seed] User created: ${email} (${role})`);
  return user;
}

async function createEvents(orgId) {
  const dateStr = TODAY.toISOString().split("T")[0].replace(/-/g, "");
  const created = [];

  for (let i = 0; i < EVENT_TEMPLATES.length; i++) {
    const tmpl = EVENT_TEMPLATES[i];
    const eventId = `EVT-${dateStr}-${String(i + 1).padStart(3, "0")}`;

    const exists = await Event.findOne({ eventId });
    if (exists) {
      console.log(`[seed] Event exists: ${eventId}`);
      created.push(exists);
      continue;
    }

    const ts = new Date(TODAY);
    ts.setHours(tmpl.hour, tmpl.min, 0, 0);

    const evt = await Event.create({
      eventId,
      orgId,
      nightDate: TODAY.toISOString().split("T")[0],
      type: tmpl.type,
      location: tmpl.location,
      timestamp: ts,
      severity: "uncertain",
    });
    console.log(
      `[seed] Event created: ${eventId} — ${tmpl.type} @ ${tmpl.location.name}`,
    );
    created.push(evt);
  }

  return created;
}

async function createIncidents(orgId, events) {
  const dateStr = TODAY.toISOString().split("T")[0].replace(/-/g, "");

  const templates = [
    {
      incidentId: `INC-${dateStr}-001`,
      title: "Perimeter breach attempt — North Fence",
      eventSlice: [0, 1, 2],
      priority: 1,
      location: LOCATIONS[2],
      correlationKind: "spatial",
      severity: "serious",
    },
    {
      incidentId: `INC-${dateStr}-002`,
      title: "Unauthorised vehicle at road entrance",
      eventSlice: [2, 7],
      priority: 3,
      location: LOCATIONS[5],
      correlationKind: "temporal",
      severity: "minor",
    },
    {
      incidentId: `INC-${dateStr}-003`,
      title: "Repeated badge failures — Gate B",
      eventSlice: [3, 8],
      priority: 4,
      location: LOCATIONS[1],
      correlationKind: "entity",
      severity: "harmless",
    },
  ];

  const created = [];

  for (const tmpl of templates) {
    const exists = await Incident.findOne({ incidentId: tmpl.incidentId });
    if (exists) {
      console.log(`[seed] Incident exists: ${tmpl.incidentId}`);
      created.push(exists);
      continue;
    }

    const linkedEvents = tmpl.eventSlice.map((i) => events[i]._id);

    const inc = await Incident.create({
      orgId,
      incidentId: tmpl.incidentId,
      title: tmpl.title,
      nightDate: TODAY.toISOString().split("T")[0],
      eventIds: linkedEvents,
      location: tmpl.location,
      correlation: {
        type: tmpl.correlationKind,
        strategy: `${tmpl.correlationKind}_clustering`,
        metadata: {},
      },
      priority: tmpl.priority,
      status: "open",
      severity: tmpl.severity,
    });
    console.log(
      `[seed] Incident created: ${tmpl.incidentId} — "${tmpl.title}"`,
    );
    created.push(inc);
  }

  return created;
}

async function createBriefing(orgId) {
  const dateStr = TODAY.toISOString().split("T")[0].replace(/-/g, "");
  const briefingId = `BRF-${dateStr}-001`;

  const exists = await Briefing.findOne({ briefingId });
  if (exists) {
    console.log(`[seed] Briefing exists: ${briefingId}`);
    return exists;
  }

  const briefing = await Briefing.create({
    briefingId,
    orgId,
    nightDate: TODAY.toISOString().split("T")[0],
    status: "draft",
    sections: [
      { name: "executive_summary", content: null, lastEditedAt: null },
      { name: "incidents", content: null, lastEditedAt: null },
      { name: "recommendations", content: null, lastEditedAt: null },
      { name: "anomalies", content: null, lastEditedAt: null },
      { name: "follow_up", content: null, lastEditedAt: null },
    ],
  });
  console.log(`[seed] Briefing created: ${briefingId}`);
  return briefing;
}

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log("[seed] Connected to MongoDB");

  const org = await findOrCreateOrg();

  await findOrCreateUser({
    email: "admin@example.com",
    username: "admin",
    role: "super_admin",
    orgId: null,
  });
  await findOrCreateUser({
    email: "orgadmin@example.com",
    username: "orgadmin",
    role: "org_admin",
    orgId: org._id,
  });
  await findOrCreateUser({
    email: "operator@example.com",
    username: "operator",
    role: "operator",
    orgId: org._id,
  });

  const events = await createEvents(org._id);
  const incidents = await createIncidents(org._id, events);
  const briefing = await createBriefing(org._id);

  console.log("\n[seed] ✅ Done");
  console.log(`  Org:       ${org.name}`);
  console.log(
    `  Users:     admin@example.com, orgadmin@example.com, operator@example.com`,
  );
  console.log(`  Events:    ${events.length}`);
  console.log(`  Incidents: ${incidents.length}`);
  console.log(`  Briefing:  ${briefing.briefingId}`);
  console.log(`  NightDate: ${TODAY.toISOString().split("T")[0]}`);
  console.log(`  Password:  Admin123!`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("[seed] Fatal:", err.message);
  process.exit(1);
});
