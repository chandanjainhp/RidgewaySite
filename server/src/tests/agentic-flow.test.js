/**
 * Minimal agentic-flow smoke — singleton Site (no Organisation).
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/sentinel_test';

describe('singleton site models', () => {
  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('Site.getSite creates singleton', async () => {
    const { getSite } = await import('../models/site.model.js');
    const a = await getSite();
    const b = await getSite();
    expect(a._id.toString()).toBe(b._id.toString());
  });

  test('Event schema has no org scoping field', async () => {
    const Event = (await import('../models/event.model.js')).default;
    const paths = Object.keys(Event.schema.paths);
    expect(paths.includes('orgId')).toBe(false);
  });
});
