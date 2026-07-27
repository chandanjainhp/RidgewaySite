/*
  AI Client Configuration - Supports both Anthropic and OpenRouter

  This module provides a singleton AI client that can use either:
  1. OpenRouter API (100+ models) - Recommended for testing
  2. Anthropic Claude API - If preferred

  Configuration:
  - For OpenRouter: Set OPENROUTER_API_KEY and OPENROUTER_MODEL in .env
  - For Anthropic: Set ANTHROPIC_API_KEY in .env
*/

import Anthropic from '@anthropic-ai/sdk';
import mongoose from 'mongoose';

let clientInstance = null;
let aiProvider = null;

const normalizeOpenRouterBaseURL = (rawBaseURL) => {
  const fallback = 'https://openrouter.ai/api/v1';
  const input = (rawBaseURL || fallback).trim();

  try {
    const url = new URL(input);
    // OpenRouter chat completions live under /api/v1/chat/completions.
    // Normalize configured values like:
    // - https://openrouter.ai
    // - https://openrouter.ai/v1
    // - https://openrouter.ai/api/v1
    // to a stable API base.
    url.pathname = '/api/v1';
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
};

const anthropicToolsToOpenAITools = (tools = []) => {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema || { type: 'object', properties: {} },
    },
  }));
};

const anthropicMessagesToOpenAIMessages = (messages = []) => {
  const mapped = [];

  for (const message of messages) {
    const { role, content } = message;

    if (typeof content === 'string') {
      mapped.push({ role, content });
      continue;
    }

    if (!Array.isArray(content)) {
      continue;
    }

    if (role === 'assistant') {
      const textBlocks = content.filter((block) => block?.type === 'text' && block?.text);
      const toolUseBlocks = content.filter((block) => block?.type === 'tool_use');

      const assistantMessage = {
        role: 'assistant',
        content: textBlocks.length > 0 ? textBlocks.map((block) => block.text).join('\n') : null,
      };

      if (toolUseBlocks.length > 0) {
        assistantMessage.tool_calls = toolUseBlocks.map((block) => ({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {}),
          },
        }));
      }

      mapped.push(assistantMessage);
      continue;
    }

    if (role === 'user') {
      const textBlocks = content.filter((block) => block?.type === 'text' && block?.text);
      if (textBlocks.length > 0) {
        mapped.push({ role: 'user', content: textBlocks.map((block) => block.text).join('\n') });
      }

      for (const block of content) {
        if (block?.type !== 'tool_result') {
          continue;
        }

        const toolContent =
          typeof block.content === 'string' ? block.content : JSON.stringify(block.content || {});

        mapped.push({
          role: 'tool',
          tool_call_id: block.tool_use_id,
          content: toolContent,
        });
      }
    }
  }

  return mapped;
};

const openAIResponseToAnthropicShape = (payload) => {
  const choice = payload?.choices?.[0] || {};
  const message = choice?.message || {};
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const contentBlocks = [];

  if (typeof message.content === 'string' && message.content.trim()) {
    contentBlocks.push({
      type: 'text',
      text: message.content,
    });
  }

  for (const toolCall of toolCalls) {
    let parsedInput = {};
    const rawArgs = toolCall?.function?.arguments;

    if (typeof rawArgs === 'string' && rawArgs.trim()) {
      try {
        parsedInput = JSON.parse(rawArgs);
      } catch {
        parsedInput = { _raw: rawArgs };
      }
    }

    contentBlocks.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall?.function?.name,
      input: parsedInput,
    });
  }

  const finishReason = choice?.finish_reason;
  const stopReason = finishReason === 'tool_calls' ? 'tool_use' : 'end_turn';

  return {
    id: payload?.id,
    model: payload?.model,
    stop_reason: stopReason,
    content: contentBlocks,
    usage: {
      input_tokens: payload?.usage?.prompt_tokens || 0,
      output_tokens: payload?.usage?.completion_tokens || 0,
    },
  };
};

const OPENROUTER_TOOL_MODELS = new Set([
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3-haiku',
  'anthropic/claude-3.5-sonnet',
]);

const createOpenRouterCompatClient = ({ apiKey, baseURL }) => {
  const normalizedBase = normalizeOpenRouterBaseURL(baseURL);

  return {
    messages: {
      create: async ({ model, max_tokens, system, tools, tool_choice, messages }) => {
        const openAIMessages = [
          { role: 'system', content: system || '' },
          ...anthropicMessagesToOpenAIMessages(messages || []),
        ];

        const payload = {
          model,
          messages: openAIMessages,
          max_tokens,
        };

        if (Array.isArray(tools) && tools.length > 0) {
          payload.tools = anthropicToolsToOpenAITools(tools);
          payload.tool_choice = tool_choice?.type || 'auto';
        }

        const response = await fetch(`${normalizedBase}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(process.env.OPENROUTER_HTTP_REFERER
              ? { 'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER }
              : {}),
            ...(process.env.OPENROUTER_X_TITLE
              ? { 'X-Title': process.env.OPENROUTER_X_TITLE }
              : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`OpenRouter error (${response.status}): ${text.slice(0, 500)}`);
        }

        const data = await response.json();
        return openAIResponseToAnthropicShape(data);
      },
    },
  };
};

const createLMStudioClient = ({ baseURL, apiKey }) => {
  const base = (baseURL || 'http://localhost:1234/v1').replace(/\/$/, '');
  const maxTokensCap = parseInt(process.env.LMSTUDIO_MAX_TOKENS || '800', 10);

  return {
    messages: {
      create: async ({ model, max_tokens, system, tools, tool_choice, messages }) => {
        max_tokens = Math.min(max_tokens, maxTokensCap);
        const openAIMessages = [
          { role: 'system', content: system || '' },
          ...anthropicMessagesToOpenAIMessages(messages || []),
        ];

        const payload = { model, messages: openAIMessages, max_tokens };

        if (Array.isArray(tools) && tools.length > 0) {
          payload.tools = anthropicToolsToOpenAITools(tools);
          payload.tool_choice = tool_choice?.type || 'auto';
        }

        const body = JSON.stringify(payload);
        console.log(`[LMStudio] sending payload chars=${body.length} prompt_msgs=${openAIMessages.length} max_tokens=${max_tokens}`);
        const response = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey || 'lm-studio'}`,
            'Content-Type': 'application/json',
          },
          body,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`LM Studio error (${response.status}): ${text.slice(0, 500)}`);
        }

        const data = await response.json();
        return openAIResponseToAnthropicShape(data);
      },
    },
  };
};

const createMockAIClient = () => {
  return {
    messages: {
      create: async ({ messages }) => {
        const assistantMsgs = messages.filter(m => m.role === 'assistant');
        const count = assistantMsgs.length;

        if (count === 0) {
          return {
            id: `msg_mock_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            stop_reason: 'tool_use',
            content: [
              {
                type: 'text',
                text: 'Starting investigation. I will gather the overnight alerts first.'
              },
              {
                type: 'tool_use',
                id: `toolu_mock_alerts_${Date.now()}`,
                name: 'get_overnight_alerts',
                input: {}
              }
            ],
            usage: { input_tokens: 100, output_tokens: 50 }
          };
        } else if (count === 1) {
          const Incident = mongoose.model('Incident');
          const incident = await Incident.findOne({ nightDate: '2026-07-11' }).lean();
          const realIncidentId = incident ? incident._id.toString() : '6a4a05b5955079335b85f5f6';

          return {
            id: `msg_mock_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            stop_reason: 'tool_use',
            content: [
              {
                type: 'text',
                text: 'Based on the alerts, the activity is harmless. I will submit the classification.'
              },
              {
                type: 'tool_use',
                id: `toolu_mock_submit_${Date.now()}`,
                name: 'submit_classification',
                input: {
                  incidentId: realIncidentId,
                  severity: 'harmless',
                  confidence: 0.95,
                  reasoning: 'Sensor alert was investigated and found to be normal baseline activity.',
                  uncertainties: []
                }
              }
            ],
            usage: { input_tokens: 200, output_tokens: 80 }
          };
        } else {
          return {
            id: `msg_mock_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            stop_reason: 'end_turn',
            content: [
              {
                type: 'text',
                text: 'Investigation is complete.\n\n```json\n{\n  "severity": "harmless",\n  "confidence": 0.95,\n  "reasoning": "Sensor alert was investigated and found to be normal baseline activity.",\n  "uncertainties": []\n}\n```'
              }
            ],
            usage: { input_tokens: 300, output_tokens: 100 }
          };
        }
      }
    }
  };
};

/**
 * Determine which AI provider to use based on environment variables
 * @returns {'openrouter' | 'anthropic' | 'lmstudio' | 'mock'} The configured AI provider
 */
const getAIProvider = () => {
  if (process.env.MOCK_AI === 'true') {
    return 'mock';
  }
  if (process.env.OPENROUTER_API_KEY) {
    return 'openrouter';
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  if (process.env.OPENAI_BASE_URL) {
    return 'lmstudio';
  }
  throw new Error(
    'No AI provider configured. Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_BASE_URL in .env'
  );
};

/**
 * Get or create the AI client singleton
 * Supports both OpenRouter and Anthropic Claude APIs
 * @returns {Anthropic} AI API client (compatible Anthropic SDK)
 */
export const getAIClient = () => {
  if (!clientInstance) {
    aiProvider = getAIProvider();

    if (aiProvider === 'mock') {
      console.log('[AI] Initializing Mock AI Client...');
      clientInstance = createMockAIClient();
    } else if (aiProvider === 'openrouter') {
      console.log('[AI] Initializing OpenRouter client...');
      const baseURL = normalizeOpenRouterBaseURL(process.env.OPENROUTER_BASE_URL);
      clientInstance = createOpenRouterCompatClient({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL,
      });
      console.log(
        `[AI] ✅ OpenRouter initialized - Model: ${
          process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo'
        } | Base URL: ${baseURL}`
      );
    } else if (aiProvider === 'anthropic') {
      console.log('[AI] Initializing Anthropic Claude client...');
      clientInstance = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('[AI] ✅ Anthropic Claude initialized');
    } else if (aiProvider === 'lmstudio') {
      console.log('[AI] Initializing LM Studio client...');
      clientInstance = createLMStudioClient({
        baseURL: process.env.OPENAI_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log(
        `[AI] ✅ LM Studio initialized - Model: ${
          process.env.LMSTUDIO_MODEL || 'openai/gpt-oss-20b'
        } | Base URL: ${process.env.OPENAI_BASE_URL}`
      );
    }
  }
  return clientInstance;
};

/**
 * Get the current AI provider name for logging/debugging
 * @returns {'openrouter' | 'anthropic'} The AI provider in use
 */
export const getAIProviderName = () => {
  if (!aiProvider) {
    aiProvider = getAIProvider();
  }
  return aiProvider;
};

/**
 * Get the model name being used
 * @returns {string} Model identifier
 */
export const getModelName = () => {
  const provider = getAIProviderName();

  if (provider === 'openrouter') {
    const configuredModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';

    if (!OPENROUTER_TOOL_MODELS.has(configuredModel)) {
      console.warn(
        `[AI] OPENROUTER_MODEL ${configuredModel} may not satisfy tool-calling constraints here. Falling back to anthropic/claude-sonnet-4`
      );
      return 'anthropic/claude-sonnet-4';
    }

    return configuredModel;
  }

  if (provider === 'lmstudio') {
    return process.env.LMSTUDIO_MODEL || 'openai/gpt-oss-20b';
  }

  // Anthropic uses claude-3-sonnet by default
  return 'claude-3-sonnet-20240229';
};

// Backwards compatibility
export const getClaudeClient = getAIClient;

export default {
  getAIClient,
  getClaudeClient,
  getAIProviderName,
  getModelName,
};
