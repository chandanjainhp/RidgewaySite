/**
 * bootstrap-admin.js
 * Wipes all collections and creates a fresh super_admin.
 *
 * Usage:
 *   MONGODB_URL=<url> ADMIN_EMAIL=<email> ADMIN_PASSWORD=<pass> bun run src/scripts/bootstrap-admin.js
 *
 * Env vars (falls back to .env):
 *   MONGODB_URL       — MongoDB connection string
 *   ADMIN_EMAIL       — super_admin email (required)
 *   ADMIN_PASSWORD    — super_admin password (required, min 8 chars)
 *   WIPE_ALL=true     — required safety flag to prevent accidental runs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const WIPE_ALL = process.env.WIPE_ALL;

if (!MONGODB_URI) {
  console.error('[bootstrap] MONGODB_URL not set');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('[bootstrap] ADMIN_EMAIL and ADMIN_PASSWORD are required');
  process.exit(1);
}
if (WIPE_ALL !== 'true') {
  console.error('[bootstrap] Set WIPE_ALL=true to confirm you want to wipe all data');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error('[bootstrap] ADMIN_PASSWORD must be at least 8 characters');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('[bootstrap] Connected:', MONGODB_URI.replace(/:\/\/[^@]+@/, '://***@'));

  const db = mongoose.connection.db;

  // List and drop all collections
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).drop();
    console.log(`[bootstrap] Dropped collection: ${col.name}`);
  }
  console.log(`[bootstrap] Wiped ${collections.length} collections`);

  // Define minimal inline schema so we don't need the full model chain
  const userSchema = new mongoose.Schema({
    email: String,
    username: String,
    password: String,
    role: String,
    orgId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    firstLogin: { type: Boolean, default: false },
  });

  const User = mongoose.model('User', userSchema);

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const username = ADMIN_EMAIL.split('@')[0];

  const admin = await User.create({
    email: ADMIN_EMAIL,
    username,
    password: hash,
    role: 'super_admin',
    orgId: null,
    isActive: true,
    isEmailVerified: true,
    tokenVersion: 0,
    firstLogin: false,
  });

  console.log('[bootstrap] Super admin created:');
  console.log(`  _id:   ${admin._id}`);
  console.log(`  email: ${admin.email}`);
  console.log(`  role:  ${admin.role}`);

  await mongoose.disconnect();
  console.log('[bootstrap] Done — ready to log in at /admin/login');
}

run().catch((err) => {
  console.error('[bootstrap] Fatal:', err.message);
  process.exit(1);
});
