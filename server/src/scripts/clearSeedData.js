/**
 * clearSeedData.js — wipe events/incidents/briefings for the singleton site.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Event from '../models/event.model.js';
import Incident from '../models/incident.model.js';
import Briefing from '../models/briefing.model.js';
import Investigation from '../models/investigation.model.js';

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(MONGODB_URI);
  const [e, i, b, inv] = await Promise.all([
    Event.deleteMany({}),
    Incident.deleteMany({}),
    Briefing.deleteMany({}),
    Investigation.deleteMany({}),
  ]);
  console.log('[clear]', { events: e.deletedCount, incidents: i.deletedCount, briefings: b.deletedCount, investigations: inv.deletedCount });
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
