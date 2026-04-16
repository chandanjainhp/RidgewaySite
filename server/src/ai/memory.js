/*
  Agent Memory Management — Conversation State & Site Facts

  Two responsibilities:
  1. Conversation state persistence (Redis, 3hr TTL) — enables SSE reconnection
  2. Site memory/knowledge base (Redis, 24hr TTL) — established facts shared across investigations
*/

import { getRedis } from '../db/redis.js';

// Redis key constants
const CONV_KEY_PREFIX = 'agent:conv:';
const FACTS_KEY_PREFIX = 'site:facts:';
const CONV_TTL = 3 * 60 * 60; // 3 hours in seconds
const FACTS_TTL = 24 * 60 * 60; // 24 hours in seconds

// ========== CONVERSATION STATE MANAGEMENT ==========

/**
 * Save conversation history to Redis for SSE reconnection resilience
 * @param {string} jobId - BullMQ job ID
 * @param {array} conversationHistory - full conversation array from Claude
 * @returns {Promise<boolean>} true if saved successfully
 */
export const saveConversationState = async (jobId, conversationHistory) => {
  const redisKey = `${CONV_KEY_PREFIX}${jobId}`;

  try {
    const redis = getRedis();
    const serialized = JSON.stringify(conversationHistory);

    await redis.setex(redisKey, CONV_TTL, serialized);
    console.log(`[Memory] Saved conversation state for job ${jobId} (${serialized.length} bytes)`);

    return true;
  } catch (error) {
    console.error(`[Memory] Error saving conversation state:`, error.message);
    return false;
  }
};

/**
 * Load conversation history from Redis
 * @param {string} jobId - BullMQ job ID
 * @returns {Promise<array|null>} conversation history or null if not found
 */
export const loadConversationState = async (jobId) => {
  const redisKey = `${CONV_KEY_PREFIX}${jobId}`;

  try {
    const redis = getRedis();
    const serialized = await redis.get(redisKey);

    if (!serialized) {
      console.log(`[Memory] No saved conversation state for job ${jobId}`);
      return null;
    }

    const conversationHistory = JSON.parse(serialized);
    console.log(`[Memory] Loaded conversation state for job ${jobId} (${conversationHistory.length} messages)`);

    return conversationHistory;
  } catch (error) {
    console.error(`[Memory] Error loading conversation state:`, error.message);
    return null;
  }
};

/**
 * Clear conversation history after investigation completes
 * @param {string} jobId - BullMQ job ID
 * @returns {Promise<boolean>} true if cleared successfully
 */
export const clearConversationState = async (jobId) => {
  const redisKey = `${CONV_KEY_PREFIX}${jobId}`;

  try {
    const redis = getRedis();
    await redis.del(redisKey);
    console.log(`[Memory] Cleared conversation state for job ${jobId}`);

    return true;
  } catch (error) {
    console.error(`[Memory] Error clearing conversation state:`, error.message);
    return false;
  }
};

// ========== SITE FACTS MANAGEMENT ==========

/**
 * Add an established fact to the site knowledge base
 * @param {Date|string} nightDate - the night (date only, no time)
 * @param {object} fact - { subject, predicate, object, confidence (0-1), source }
 * @returns {Promise<boolean>} true if added successfully
 */
export const addSiteFact = async (nightDate, fact) => {
  const nightDateStr = new Date(nightDate).toISOString().split('T')[0];
  const redisKey = `${FACTS_KEY_PREFIX}${nightDateStr}`;

  try {
    // Validate fact structure
    if (!fact.subject || !fact.predicate || !fact.object) {
      console.error(`[Memory] Invalid fact structure:`, fact);
      return false;
    }

    const redis = getRedis();
    const factEntry = {
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      confidence: fact.confidence || 0.5,
      source: fact.source || 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Add to Redis list (set will convert to list automatically)
    const serialized = JSON.stringify(factEntry);
    await redis.rpush(redisKey, serialized);

    // Set TTL on the list
    await redis.expire(redisKey, FACTS_TTL);

    console.log(
      `[Memory] Added fact for ${nightDateStr}: "${fact.subject} ${fact.predicate} ${fact.object}" (confidence: ${fact.confidence})`
    );

    return true;
  } catch (error) {
    console.error(`[Memory] Error adding site fact:`, error.message);
    return false;
  }
};

/**
 * Retrieve all established facts for a night
 * @param {Date|string} nightDate - the night (date only, no time)
 * @returns {Promise<array>} array of facts
 */
export const getSiteFacts = async (nightDate) => {
  const nightDateStr = new Date(nightDate).toISOString().split('T')[0];
  const redisKey = `${FACTS_KEY_PREFIX}${nightDateStr}`;

  try {
    const redis = getRedis();
    const factEntries = await redis.lrange(redisKey, 0, -1);

    if (!factEntries || factEntries.length === 0) {
      console.log(`[Memory] No facts for ${nightDateStr}`);
      return [];
    }

    const facts = factEntries.map(entry => JSON.parse(entry));
    console.log(`[Memory] Retrieved ${facts.length} facts for ${nightDateStr}`);

    return facts;
  } catch (error) {
    console.error(`[Memory] Error retrieving site facts:`, error.message);
    return [];
  }
};

/**
 * Build a formatted context injection for prepending to agent system prompt
 * @param {Date|string} nightDate - the night (date only, no time)
 * @returns {Promise<string>} formatted facts string (empty string if no facts)
 */
export const buildContextInjection = async (nightDate) => {
  return (async () => {
    const facts = await getSiteFacts(nightDate);

    if (facts.length === 0) {
      return '';
    }

    // Group facts by subject for clarity
    const factsBySubject = {};
    for (const fact of facts) {
      if (!factsBySubject[fact.subject]) {
        factsBySubject[fact.subject] = [];
      }
      factsBySubject[fact.subject].push(fact);
    }

    // Build formatted string
    let injection = '\n--- ESTABLISHED FACTS FROM EARLIER INVESTIGATIONS ---\n';

    for (const [subject, subjectFacts] of Object.entries(factsBySubject)) {
      injection += `\n${subject}:\n`;

      for (const fact of subjectFacts) {
        const confidenceLevel =
          fact.confidence >= 0.8 ? 'high' : fact.confidence >= 0.5 ? 'medium' : 'low';
        injection += `  • ${fact.predicate} ${fact.object} (confidence: ${confidenceLevel}, source: ${fact.source})\n`;
      }
    }

    injection += '\n--- END ESTABLISHED FACTS ---\n\n';
    injection += 'Use these established facts to inform your investigation. Do not re-verify facts marked as high confidence.\n';

    return injection;
  })();
};

export default {
  saveConversationState,
  loadConversationState,
  clearConversationState,
  addSiteFact,
  getSiteFacts,
  buildContextInjection,
};
