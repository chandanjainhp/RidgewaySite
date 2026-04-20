/*
  ReAct Agent Loop — Core Investigation Engine

  Implements the investigation loop for a single incident:
  1. Load incident and events from MongoDB
  2. Initialize Claude conversation with system prompt
  3. Loop through tool calls (max 12 iterations)
  4. Stream progress events to client via callback
  5. Save complete investigation record to MongoDB
*/

import { getClaudeClient, getModelName } from '../utils/anthropic.js';
import { buildSystemPrompt } from './prompts/system.js';
import { TOOLS_FOR_CLAUDE, executeTool } from './tools-registry.js';
import Incident from '../models/incident.model.js';

const MAX_TOOL_CALLS = 12;
const DEFAULT_MODEL = getModelName();

const toUsageNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const extractTokenUsage = (response) => {
  const usage = response?.usage || {};

  return {
    input: toUsageNumber(
      usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens ?? usage.promptTokens
    ),
    output: toUsageNumber(
      usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens ?? usage.completionTokens
    ),
  };
};

/**
 * Main investigation orchestrator
 * @param {string} incidentId - MongoDB incident ID
 * @param {string} jobId - BullMQ job ID for SSE channel
 * @param {function} emitProgress - callback(progressEvent) for real-time streaming
 * @returns {Promise<object>} investigation record
 */
export const runInvestigation = async (
  incidentId,
  jobId,
  emitProgress,
  investigationRecord = null
) => {
  const startTime = Date.now();
  let investigation = null;
  let conversationHistory = [];
  const toolCallSequence = [];
  const evidenceChain = [];
  let finalClassification = null;
  let toolCallCount = 0;
  let tokenUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    // ========== PHASE 1: SETUP ==========
    console.log(`[Agent] Starting investigation for incident: ${incidentId}`);

    // Load incident and associated events
    const incident = await Incident.findById(incidentId).populate('eventIds');
    if (!incident) {
      const error = `Incident not found: ${incidentId}`;
      console.error(`[Agent] ${error}`);
      await emitProgress({
        type: 'error',
        jobId,
        timestamp: new Date(),
        data: { summary: error },
      });
      throw new Error(error);
    }

    const events = incident.eventIds || [];
    const investigationNightDate = incident.nightDate;
    if (!investigationNightDate) {
      throw new Error(`Incident ${incidentId} is missing nightDate`);
    }
    console.log(`[Agent] Loaded incident with ${events.length} events`);

    investigation = investigationRecord;
    if (!investigation) {
      throw new Error('Investigation record is required before running the agent');
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(incident, events);

    // Build initial user message
    const eventSummary = events
      .map(e => `• ${e.type} at ${e.location.name} (${e.timestamp.toISOString()})`)
      .join('\n');

    const initialMessage = `Investigate incident: ${incident.title}

Primary Location: ${incident.primaryLocation.name}
Correlation Type: ${incident.correlationType}

Events to investigate:
${eventSummary}

Begin by gathering all available data for this location and these event types. Once you have sufficient evidence, call classify_incident with your severity assessment.`;

    conversationHistory.push({
      role: 'user',
      content: initialMessage,
    });

    console.log(`[Agent] System prompt built, conversation initialized`);

    // ========== PHASE 2: REACT LOOP ==========
    const claude = getClaudeClient();
    let loopComplete = false;

    while (toolCallCount < MAX_TOOL_CALLS && !loopComplete) {
      console.log(`[Agent] Iteration ${toolCallCount + 1}/${MAX_TOOL_CALLS}`);

      try {
        const model = DEFAULT_MODEL;
        const tools = TOOLS_FOR_CLAUDE;
        const messages = conversationHistory;

        console.log('[TOOLS]', JSON.stringify(TOOLS_FOR_CLAUDE, null, 2));
        console.log('[CLAUDE CALL] model:', model);
        console.log('[CLAUDE CALL] tools count:', tools?.length);
        console.log('[CLAUDE CALL] messages count:', messages.length);
        console.log(
          '[FIRST MSG]',
          messages[0]?.role,
          typeof messages[0]?.content === 'string'
            ? messages[0].content.slice(0, 100)
            : JSON.stringify(messages[0]?.content || '').slice(0, 100)
        );
        console.log('[CLAUDE CALL] last message role:', messages[messages.length - 1]?.role);

        // Call Claude with current conversation
        const response = await claude.messages.create({
          model,
          max_tokens: 2000,
          system: systemPrompt,
          tools,
          tool_choice: { type: 'auto' },
          messages,
        });

        console.log('[CLAUDE RESPONSE] stop_reason:', response.stop_reason);
        console.log(
          '[CLAUDE RESPONSE] content blocks:',
          (Array.isArray(response?.content) ? response.content : []).map((b) => b.type).join(', ')
        );
        console.log('[CLAUDE RESPONSE] usage:', response.usage);

        // Track token usage
        const usage = extractTokenUsage(response);
        tokenUsage.inputTokens += usage.input;
        tokenUsage.outputTokens += usage.output;

        const responseContent = Array.isArray(response?.content) ? response.content : [];

        console.log('CLAUDE RESPONSE stop_reason', response.stop_reason);
        console.log(
          'CLAUDE CONTENT TYPES',
          responseContent.map((block) => block?.type || 'unknown')
        );

        console.log(`[Agent] Claude response received (stop_reason: ${response.stop_reason})`);

        // Append assistant response to history (before processing)
        conversationHistory.push({
          role: 'assistant',
          content: responseContent,
        });

        // ===== CASE 1: Tool use =====
        if (response.stop_reason === 'tool_use') {
          console.log(`[Agent] Tool use detected, processing...`);

          const toolUseBlocks = responseContent.filter(block => block.type === 'tool_use');
          const toolResults = [];

          for (const toolBlock of toolUseBlocks) {
            toolCallCount++;
            const toolName = toolBlock.name;
            const toolInput = toolBlock.input;

            console.log(`[Agent] Tool call ${toolCallCount}: ${toolName}`);

            // Emit tool called event
            try {
              await emitProgress({
                type: 'tool_called',
                jobId,
                timestamp: new Date(),
                data: {
                  toolName,
                  summary: `Calling ${toolName}...`,
                },
              });
            } catch (err) {
              console.error(`[Agent] Error emitting tool_called progress:`, err.message);
            }

            // Execute tool and capture result
            const toolStartTime = Date.now();
            let toolResult;
            try {
              toolResult = await executeTool(toolName, toolInput, investigationNightDate);
            } catch (toolError) {
              console.error(`[Agent] Tool execution error:`, toolError.message);
              toolResult = {
                success: false,
                error: toolError.message,
                toolName,
              };
            }
            const toolDuration = Date.now() - toolStartTime;

            // Record tool call sequence
            toolCallSequence.push({
              callIndex: toolCallCount,
              toolName,
              toolInput,
              toolResult,
              durationMs: toolDuration,
              timestamp: new Date(),
            });

            // Emit tool result event
            try {
              await emitProgress({
                type: 'tool_result',
                jobId,
                timestamp: new Date(),
                data: {
                  toolName,
                  result: toolResult,
                  success: toolResult.success !== false,
                  summary: toolResult.message || `${toolName} completed`,
                },
              });
            } catch (err) {
              console.error(`[Agent] Error emitting tool_result progress:`, err.message);
            }

            // Add tool result to conversation history for next Claude call
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: JSON.stringify(toolResult),
            });

            // Update evidence chain from tool result
            if (toolResult.success && toolResult.result) {
              evidenceChain.push({
                step: evidenceChain.length + 1,
                finding: `${toolName}: ${JSON.stringify(toolResult).substring(0, 100)}...`,
                source: toolName,
                confidence: 'medium',
              });
            }
          }

          // Add all tool results to conversation
          if (toolResults.length > 0) {
            conversationHistory.push({
              role: 'user',
              content: toolResults,
            });
          }
        }
        // ===== CASE 2: End turn (agent is done) =====
        else if (response.stop_reason === 'end_turn') {
          console.log(`[Agent] Agent complete (end_turn received)`);
          loopComplete = true;

          // Extract text content and parse JSON classification
          const textContent = responseContent
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

          console.log(`[Agent] Agent final text: ${textContent.substring(0, 200)}...`);

          // Try to extract JSON classification from response
          const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            try {
              finalClassification = JSON.parse(jsonMatch[1]);
              console.log(`[Agent] Classification extracted: severity=${finalClassification.severity}`);
            } catch (parseError) {
              console.error(`[Agent] Failed to parse classification JSON:`, parseError.message);
              // Fall back to creating classification from text
              finalClassification = {
                severity: 'uncertain',
                confidence: 0.5,
                reasoning: textContent,
                uncertainties: ['Could not extract structured classification'],
              };
            }
          } else {
            // No JSON found, create classification from text
            console.log(`[Agent] No JSON classification found, using text as reasoning`);
            finalClassification = {
              severity: 'uncertain',
              confidence: 0.5,
              reasoning: textContent,
              uncertainties: ['Classification not in expected JSON format'],
            };
          }

          // Emit classification event
          try {
            await emitProgress({
              type: 'classification',
              jobId,
              timestamp: new Date(),
              data: {
                classification: finalClassification,
                summary: `Incident classified as: ${finalClassification.severity}`,
              },
            });
          } catch (err) {
            console.error(`[Agent] Error emitting classification progress:`, err.message);
          }
        }
        // ===== CASE 3: Unexpected stop reason =====
        else {
          console.warn(`[Agent] Unexpected stop_reason: ${response.stop_reason}`);
          loopComplete = true;
        }
      } catch (loopError) {
        console.error('[CLAUDE ERROR] status:', loopError?.status);
        console.error('[CLAUDE ERROR] message:', loopError?.message);
        console.error('[CLAUDE ERROR] full:', JSON.stringify(loopError, null, 2));
        console.error(`[Agent] Error in loop iteration:`, loopError.message);

        // Emit error progress
        try {
          await emitProgress({
            type: 'error',
            jobId,
            timestamp: new Date(),
            data: { summary: `Loop error: ${loopError.message}` },
          });
        } catch (err) {
          console.error(`[Agent] Error emitting error progress:`, err.message);
        }

        throw loopError;
      }
    }

    // ========== PHASE 3: COMPLETION ==========
    const duration = Date.now() - startTime;

    // Determine final status
    let finalStatus = 'complete';
    let failureReason = null;

    if (!loopComplete && toolCallCount >= MAX_TOOL_CALLS) {
      finalStatus = 'incomplete';
      failureReason = `Tool call limit (${MAX_TOOL_CALLS}) reached without completion`;
      console.warn(`[Agent] ${failureReason}`);

      // Default classification if we didn't complete
      if (!finalClassification) {
        finalClassification = {
          severity: 'uncertain',
          confidence: 0.3,
          reasoning: 'Investigation reached tool call limit before completion',
          uncertainties: ['Investigation incomplete'],
          recommendedFollowup: 'Manual review recommended',
        };
      }
    }

    // Update investigation record
    investigation.status = finalStatus;
    investigation.toolCallSequence = toolCallSequence;
    investigation.evidenceChain = evidenceChain;
    investigation.finalClassification = finalClassification || {
      severity: 'uncertain',
      confidence: 0.0,
      reasoning: 'No classification produced',
      uncertainties: ['Investigation failed to produce classification'],
    };
    investigation.tokenUsage = tokenUsage;
    investigation.totalToolCalls = toolCallCount;
    investigation.durationMs = duration;
    investigation.failureReason = failureReason;
    investigation.agentModel = DEFAULT_MODEL;

    await investigation.save();
    console.log(`[Agent] Investigation saved with status: ${finalStatus}`);

    // Update incident with investigation results
    await Incident.findByIdAndUpdate(incidentId, {
      investigationId: investigation._id,
      status: 'complete',
      finalSeverity: finalClassification?.severity || 'uncertain',
      agentSummary: finalClassification?.reasoning?.substring(0, 500),
    });

    // Emit completion event if not already sent
    try {
      if (loopComplete && finalClassification) {
        // Classification already emitted in the loop
        await emitProgress({
          type: 'complete',
          jobId,
          timestamp: new Date(),
          data: {
            summary: `Investigation complete`,
            investigationId: investigation._id,
            duration,
          },
        });
      }
    } catch (err) {
      console.error(`[Agent] Error emitting completion progress:`, err.message);
    }

    console.log(`[Agent] Investigation complete in ${duration}ms`);
    return investigation;
  } catch (fatalError) {
    console.error(`[Agent] Fatal error:`, fatalError.message);

    // Try to save investigation in failed state if it exists
    if (investigation) {
      investigation.status = 'failed';
      investigation.failureReason = fatalError.message;
      investigation.toolCallSequence = toolCallSequence;
      investigation.evidenceChain = evidenceChain;
      investigation.tokenUsage = tokenUsage;
      investigation.totalToolCalls = toolCallCount;
      investigation.durationMs = Date.now() - startTime;

      try {
        await investigation.save();
      } catch (saveError) {
        console.error(`[Agent] Failed to save investigation record:`, saveError.message);
      }
    }

    // Emit final error
    try {
      await emitProgress({
        type: 'error',
        jobId,
        timestamp: new Date(),
        data: { summary: `Investigation failed: ${fatalError.message}` },
      });
    } catch (emitError) {
      console.error(`[Agent] Error emitting fatal error progress:`, emitError.message);
    }

    throw fatalError;
  }
};

export default {
  runInvestigation,
};
