import 'dotenv/config';
import mongoose from 'mongoose';
import Organisation from '../models/organisation.model.js';
import { User } from '../models/user.models.js';
import Event from '../models/event.model.js';
import Incident from '../models/incident.model.js';
import Briefing from '../models/briefing.model.js';

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[clear] MONGODB_URI / MONGODB_URL not set');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('[clear] Connected to MongoDB:', MONGODB_URI.replace(/:\/\/.*@/, '://***@'));

  const seedOrgSlug = 'test-org';
  const org = await Organisation.findOne({ slug: seedOrgSlug });

  if (!org) {
    console.log('[clear] No seed org found (slug=test-org) — nothing to delete');
    await mongoose.disconnect();
    return;
  }

  const orgId = org._id;
  console.log(`[clear] Found seed org: "${org.name}" (${orgId})`);

  const [events, incidents, briefings, users] = await Promise.all([
    Event.deleteMany({ orgId }),
    Incident.deleteMany({ orgId }),
    Briefing.deleteMany({ orgId }),
    User.deleteMany({ orgId }),
  ]);

  console.log(`[clear] Events deleted:    ${events.deletedCount}`);
  console.log(`[clear] Incidents deleted: ${incidents.deletedCount}`);
  console.log(`[clear] Briefings deleted: ${briefings.deletedCount}`);
  console.log(`[clear] Users deleted:     ${users.deletedCount}`);

  await Organisation.deleteOne({ _id: orgId });
  console.log('[clear] Seed org deleted');

  await mongoose.disconnect();
  console.log('[clear] Done');
}

run().catch((err) => {
  console.error('[clear] Error:', err.message);
  process.exit(1);
});
