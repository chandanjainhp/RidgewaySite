/**
 * Minimal agentic-flow smoke — singleton Site (no Organisation).
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import { getAIProviderName, getModelName, resetAIClient } from '../utils/anthropic.js';

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

describe('LLM provider resolution', () => {
  afterAll(() => {
    resetAIClient();
    delete process.env.LLM_PROVIDER;
    delete process.env.MISTRAL_API_KEY;
  });

  test('LLM_PROVIDER=mistral wins over USE_LOCAL_LLM', () => {
    resetAIClient();
    process.env.LLM_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-key';
    process.env.USE_LOCAL_LLM = 'true';
    expect(getAIProviderName()).toBe('mistral');
    expect(getModelName()).toBe(process.env.MISTRAL_MODEL || 'mistral-large-latest');
  });

  test('LLM_PROVIDER=local (and legacy lmstudio alias)', () => {
    resetAIClient();
    process.env.LLM_PROVIDER = 'local';
    expect(getAIProviderName()).toBe('local');
    resetAIClient();
    process.env.LLM_PROVIDER = 'lmstudio';
    expect(getAIProviderName()).toBe('local');
  });
});
