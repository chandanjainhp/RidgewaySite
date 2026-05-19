/**
 * Phase 2 canonical schema migration.
 *
 * Dry-run by default — prints counts and diffs. Pass --apply to write.
 * Idempotent: re-running on already-migrated data is a no-op.
 *
 * Usage:
 *   bun run server/src/scripts/migrate-canonical-schema.js
 *   bun run server/src/scripts/migrate-canonical-schema.js --apply
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/sentinel';
const BATCH = 500;

// ── Vocabulary maps ──────────────────────────────────────────────────────────

const SEVERITY_MAP = {
  escalate: 'serious',
  monitor: 'minor',
  unknown: 'uncertain',
  // passthrough (already canonical)
  serious: 'serious',
  minor: 'minor',
  harmless: 'harmless',
  uncertain: 'uncertain',
};

const INCIDENT_STATUS_MAP = {
  pending: 'open',
  complete: 'reviewed',
  needs_followup: 'escalated',
  // passthrough
  open: 'open',
  investigating: 'investigating',
  reviewed: 'reviewed',
  escalated: 'escalated',
  closed: 'closed',
};

const INVESTIGATION_STATUS_MAP = {
  incomplete: 'failed',
  // passthrough
  queued: 'queued',
  running: 'running',
  complete: 'complete',
  failed: 'failed',
};

const EVENT_TYPE_MAP = {
  vehicle_detected: 'vehicle_entry',
  badge_fail: 'badge_swipe_fail',
  motion_sensor: 'motion_detected',
  light_anomaly: 'environmental',
  drone_observation: 'environmental',
  // passthrough
  motion_detected: 'motion_detected',
  badge_swipe_fail: 'badge_swipe_fail',
  vehicle_entry: 'vehicle_entry',
  fence_alert: 'fence_alert',
  environmental: 'environmental',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const toDateString = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

let totalUpdated = 0;

async function batchUpdate(collection, filter, update, label) {
  const col = mongoose.connection.collection(collection);
  const count = await col.countDocuments(filter);
  console.log(`  [${label}] ${count} document(s) to update`);
  if (count === 0) return 0;
  if (!APPLY) return count;

  let updated = 0;
  let skip = 0;
  while (updated < count) {
    const docs = await col.find(filter).skip(skip).limit(BATCH).toArray();
    if (docs.length === 0) break;
    for (const doc of docs) {
      const $set = typeof update === 'function' ? update(doc) : update;
      if ($set && Object.keys($set).length > 0) {
        await col.updateOne({ _id: doc._id }, { $set });
        updated++;
      }
    }
    skip += docs.length;
    console.log(`    ${updated}/${count} updated`);
  }
  totalUpdated += updated;
  return updated;
}

// ── Collections ──────────────────────────────────────────────────────────────

async function migrateEvents() {
  console.log('\n── events ──');
  const col = mongoose.connection.collection('events');

  // Check for unmapped types
  const distinctTypes = await col.distinct('type');
  const unmapped = distinctTypes.filter((t) => !(t in EVENT_TYPE_MAP));
  if (unmapped.length > 0) {
    console.error(`ABORT: unmapped event types: ${unmapped.join(', ')}`);
    process.exit(1);
  }

  // nightDate Date → String
  await batchUpdate(
    'events',
    { nightDate: { $type: 'date' } },
    (doc) => ({ nightDate: toDateString(doc.nightDate) }),
    'nightDate Date→String'
  );

  // severity unknown → uncertain
  for (const [from, to] of Object.entries(SEVERITY_MAP)) {
    if (from === to) continue;
    await batchUpdate(
      'events',
      { severity: from },
      { severity: to },
      `severity ${from}→${to}`
    );
  }

  // type remaps
  for (const [from, to] of Object.entries(EVENT_TYPE_MAP)) {
    if (from === to) continue;
    await batchUpdate(
      'events',
      { type: from },
      { type: to },
      `type ${from}→${to}`
    );
  }
}

async function migrateIncidents() {
  console.log('\n── incidents ──');
  const col = mongoose.connection.collection('incidents');

  // nightDate Date → String
  await batchUpdate(
    'incidents',
    { nightDate: { $type: 'date' } },
    (doc) => ({ nightDate: toDateString(doc.nightDate) }),
    'nightDate Date→String'
  );

  // severity enum
  for (const [from, to] of Object.entries(SEVERITY_MAP)) {
    if (from === to) continue;
    await batchUpdate('incidents', { severity: from }, { severity: to }, `severity ${from}→${to}`);
    // also finalSeverity field (old docs)
    await batchUpdate('incidents', { finalSeverity: from }, { finalSeverity: to }, `finalSeverity ${from}→${to}`);
  }

  // finalSeverity → severity (copy value, drop field)
  await batchUpdate(
    'incidents',
    { finalSeverity: { $exists: true } },
    (doc) => {
      const mapped = SEVERITY_MAP[doc.finalSeverity] || doc.finalSeverity || 'uncertain';
      return { severity: mapped };
    },
    'finalSeverity→severity'
  );
  if (APPLY) {
    await col.updateMany({ finalSeverity: { $exists: true } }, { $unset: { finalSeverity: '' } });
    console.log('  [finalSeverity unset] done');
  }

  // primaryLocation → location
  await batchUpdate(
    'incidents',
    { primaryLocation: { $exists: true }, location: { $exists: false } },
    (doc) => ({ location: doc.primaryLocation }),
    'primaryLocation→location'
  );
  if (APPLY) {
    await col.updateMany({ primaryLocation: { $exists: true } }, { $unset: { primaryLocation: '' } });
    console.log('  [primaryLocation unset] done');
  }

  // correlationType → correlation.type
  await batchUpdate(
    'incidents',
    { correlationType: { $exists: true } },
    (doc) => ({ 'correlation.type': doc.correlationType }),
    'correlationType→correlation.type'
  );
  if (APPLY) {
    await col.updateMany({ correlationType: { $exists: true } }, { $unset: { correlationType: '' } });
    console.log('  [correlationType unset] done');
  }

  // raghavsNote → delete
  if (APPLY) {
    const r = await col.updateMany({ raghavsNote: { $exists: true } }, { $unset: { raghavsNote: '' } });
    console.log(`  [raghavsNote unset] ${r.modifiedCount} docs`);
  } else {
    const count = await col.countDocuments({ raghavsNote: { $exists: true } });
    console.log(`  [raghavsNote delete] ${count} document(s) to update`);
  }

  // status enum
  for (const [from, to] of Object.entries(INCIDENT_STATUS_MAP)) {
    if (from === to) continue;
    await batchUpdate('incidents', { status: from }, { status: to }, `status ${from}→${to}`);
  }
}

async function migrateInvestigations() {
  console.log('\n── investigations ──');
  const col = mongoose.connection.collection('investigations');

  // nightDate Date → String
  await batchUpdate(
    'investigations',
    { nightDate: { $type: 'date' } },
    (doc) => ({ nightDate: toDateString(doc.nightDate) }),
    'nightDate Date→String'
  );

  // finalClassification → classification
  await batchUpdate(
    'investigations',
    { finalClassification: { $exists: true } },
    (doc) => ({ classification: doc.finalClassification }),
    'finalClassification→classification'
  );
  if (APPLY) {
    await col.updateMany(
      { finalClassification: { $exists: true } },
      { $unset: { finalClassification: '' } }
    );
    console.log('  [finalClassification unset] done');
  }

  // classification.severity enum
  for (const [from, to] of Object.entries(SEVERITY_MAP)) {
    if (from === to) continue;
    await batchUpdate(
      'investigations',
      { 'classification.severity': from },
      { 'classification.severity': to },
      `classification.severity ${from}→${to}`
    );
  }

  // status enum
  for (const [from, to] of Object.entries(INVESTIGATION_STATUS_MAP)) {
    if (from === to) continue;
    await batchUpdate(
      'investigations',
      { status: from },
      { status: to },
      `status ${from}→${to}`
    );
  }
}

async function migrateBriefings() {
  console.log('\n── briefings ──');
  const col = mongoose.connection.collection('briefings');

  // nightDate Date → String
  await batchUpdate(
    'briefings',
    { nightDate: { $type: 'date' } },
    (doc) => ({ nightDate: toDateString(doc.nightDate) }),
    'nightDate Date→String'
  );

  // sections object → array
  // Detect old shape: sections is a plain object (not array) with known keys
  const OLD_SECTION_KEYS = ['executive_summary', 'incidents', 'recommendations', 'anomalies', 'follow_up'];
  const sampleDoc = await col.findOne({ sections: { $type: 'object' } });
  const isOldShape =
    sampleDoc &&
    !Array.isArray(sampleDoc.sections) &&
    OLD_SECTION_KEYS.some((k) => k in (sampleDoc.sections || {}));

  if (isOldShape || !APPLY) {
    const filter = {
      sections: { $type: 'object' },
      'sections.0': { $exists: false }, // not already an array
    };
    const count = await col.countDocuments(filter);
    console.log(`  [sections obj→array] ${count} document(s) to update`);

    if (APPLY && count > 0) {
      const docs = await col.find(filter).toArray();
      for (const doc of docs) {
        if (!doc.sections || Array.isArray(doc.sections)) continue;
        const sections = OLD_SECTION_KEYS
          .filter((k) => k in doc.sections)
          .map((k) => {
            const sec = doc.sections[k];
            const content =
              sec?.mayaVersion || sec?.agentDraft || '';
            return { name: k, content, lastEditedAt: doc.updatedAt || null };
          });
        await col.updateOne({ _id: doc._id }, { $set: { sections } });
      }
      console.log(`    ${docs.length} briefings converted`);
      totalUpdated += docs.length;
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);
  console.log(`Connecting to ${MONGODB_URL.replace(/\/\/.*@/, '//***@')}`);

  await mongoose.connect(MONGODB_URL);
  console.log('Connected.\n');

  await migrateEvents();
  await migrateIncidents();
  await migrateInvestigations();
  await migrateBriefings();

  console.log(`\n── done ──`);
  if (APPLY) {
    console.log(`Total documents updated: ${totalUpdated}`);
  } else {
    console.log('Dry run complete. Run with --apply to execute.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
