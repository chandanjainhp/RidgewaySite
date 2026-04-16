/*
  Shared Anthropic Claude client configuration
  Used by agent.js and any other modules that need to call Claude API
*/

import Anthropic from '@anthropic-ai/sdk';

let clientInstance = null;

/**
 * Get or create the Anthropic client singleton
 * @returns {Anthropic} Claude API client
 */
export const getClaudeClient = () => {
  if (!clientInstance) {
    clientInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return clientInstance;
};

export default {
  getClaudeClient,
};
