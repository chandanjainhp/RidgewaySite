import crypto from 'crypto';
import mongoose from 'mongoose';

export function hashIngestionSecret(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateIngestionSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Singleton site config. One document for the whole deployment.
 * Use getSite() — never filter by site id elsewhere.
 */
const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Site',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    // Human-readable location label (e.g. "North Gate Plant")
    locationLabel: {
      type: String,
      default: null,
    },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    // Optional outbound webhook
    webhookUrl: {
      type: String,
      default: null,
    },
    webhookSecret: {
      type: String,
      default: null,
    },
    webhookEnabled: {
      type: Boolean,
      default: true,
    },
    ingestionSecret: {
      type: String,
      default: null,
      description: 'SHA-256 hash of the drone event ingestion secret',
    },
    // 2D map polygons / zones (GeoJSON-ish mixed)
    siteGeometry: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

const Site = mongoose.model('Site', siteSchema);

/** Return the singleton Site, creating a default doc if missing. */
export async function getSite() {
  let site = await Site.findOne();
  if (!site) {
    const raw = process.env.INGESTION_SECRET || generateIngestionSecret();
    site = await Site.create({
      name: 'Site',
      timezone: 'UTC',
      ingestionSecret: hashIngestionSecret(raw),
    });
  } else if (!site.ingestionSecret) {
    const raw = process.env.INGESTION_SECRET || generateIngestionSecret();
    site.ingestionSecret = hashIngestionSecret(raw);
    await site.save();
    // ponytail: raw secret not logged — set INGESTION_SECRET or use POST /site/rotate-secret
  }
  return site;
}

export default Site;
