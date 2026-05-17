/*
  cleanup-orphan-data.js

  Deletes documents whose orgId is null OR points to a non-existent
  Organisation. Dry-run by default; pass --apply to actually delete.

  Usage:
    bun run src/scripts/cleanup-orphan-data.js          # dry run
    bun run src/scripts/cleanup-orphan-data.js --apply  # delete
*/

import 'dotenv/config';
import mongoose from 'mongoose';
import Organisation from '../models/organisation.model.js';
import Event from '../models/event.model.js';
import Incident from '../models/incident.model.js';
import Briefing from '../models/briefing.model.js';

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('[cleanup] MONGODB_URI / MONGODB_URL not set');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const COLLECTIONS = [
  { name: 'Event', model: Event },
  { name: 'Incident', model: Incident },
  { name: 'Briefing', model: Briefing },
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`[cleanup] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const orgs = await Organisation.find({}, '_id').lean();
  const validOrgIds = new Set(orgs.map((o) => String(o._id)));
  console.log(`[cleanup] ${validOrgIds.size} valid orgs`);

  let totalDeleted = 0;

  for (const { name, model } of COLLECTIONS) {
    const docs = await model.find({}, '_id orgId').lean();
    const orphans = docs.filter(
      (d) => !d.orgId || !validOrgIds.has(String(d.orgId))
    );

    console.log(`[cleanup] ${name}: ${docs.length} total, ${orphans.length} orphan`);

    if (orphans.length === 0) continue;

    if (APPLY) {
      const ids = orphans.map((o) => o._id);
      const result = await model.deleteMany({ _id: { $in: ids } });
      console.log(`[cleanup]   deleted ${result.deletedCount}`);
      totalDeleted += result.deletedCount;
    } else {
      orphans.slice(0, 5).forEach((o) => {
        console.log(`[cleanup]   would delete ${name} ${o._id} (orgId=${o.orgId})`);
      });
      if (orphans.length > 5) {
        console.log(`[cleanup]   ... +${orphans.length - 5} more`);
      }
    }
  }

  console.log(`[cleanup] ${APPLY ? 'deleted' : 'would delete'} ${totalDeleted} total`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[cleanup] Fatal:', err.message);
  process.exit(1);
});
