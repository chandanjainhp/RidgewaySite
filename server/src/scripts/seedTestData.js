/**
 * seedTestData.js — singleton Site seed (dev only).
 * Gated: ALLOW_SEED_DATA=true and NODE_ENV !== production
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/user.models.js';
import Site, { getSite } from '../models/site.model.js';
import Event from '../models/event.model.js';
import Incident from '../models/incident.model.js';
import Briefing from '../models/briefing.model.js';

if (process.env.NODE_ENV === 'production') {
  console.error('[seed] Refusing to run in production');
  process.exit(1);
}
if (process.env.ALLOW_SEED_DATA !== 'true') {
  console.error('[seed] Set ALLOW_SEED_DATA=true');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(MONGODB_URI);
  const site = await getSite();
  site.name = site.name || 'Test Site';
  site.coordinates = site.coordinates?.lat ? site.coordinates : { lat: 51.5074, lng: -0.1278 };
  await site.save();
  console.log('[seed] Site:', site._id.toString(), site.name);

  let admin = await User.findOne({ email: 'admin@test.local' });
  if (!admin) {
    admin = await User.create({
      email: 'admin@test.local',
      username: 'testadmin',
      password: 'Admin@1234',
      role: 'org_admin',
      isEmailVerified: true,
      firstLogin: false,
    });
  }
  console.log('[seed] Admin:', admin.email);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
