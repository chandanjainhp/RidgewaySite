import mongoose from 'mongoose';

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
    site = await Site.create({ name: 'Site', timezone: 'UTC' });
  }
  return site;
}

export default Site;
