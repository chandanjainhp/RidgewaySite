import Briefing from '../models/briefing.model.js';
import Investigation from '../models/investigation.model.js';
import '../models/incident.model.js';
import { ApiError } from '../utils/api-error.js';
import { getClaudeClient, getModelName } from '../utils/anthropic.js';

const BRIEFING_PROSE_INSTRUCTION =
  'Write the following briefing section as clear plain English prose. Do not use JSON format. Do not use markdown. Write natural paragraphs that an operator can read aloud to the site head.';

export const extractTextFromResponse = (text) => {
  if (!text) return 'No content generated.';
  const trimmed = String(text).trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.overview || parsed.summary || parsed.content || parsed.text || JSON.stringify(parsed, null, 2);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

const getFallbackSectionText = (sectionName, investigations, severityBuckets) => {
  const total = investigations.length;
  const serious = severityBuckets.serious.length;
  const minor = severityBuckets.minor.length;
  const harmless = severityBuckets.harmless.length;

  const incidentList = investigations
    .map((inv) => {
      const incident = inv.incidentId;
      const title = incident?.title || 'Unnamed incident';
      const location = incident?.location?.name || 'unknown location';
      const severity = inv.classification?.severity || 'uncertain';
      const reasoning = inv.classification?.reasoning || incident?.agentSummary || 'No reasoning provided.';
      return `${title} at ${location} was assessed as ${severity}. ${reasoning}`;
    })
    .join(' ');

  if (sectionName === 'executive_summary') {
    return `Overnight investigation completed for ${total} incidents. The team identified ${serious} serious, ${minor} minor, and ${harmless} harmless events. ${incidentList}`;
  }
  if (sectionName === 'incidents') {
    const harmlessItems = severityBuckets.harmless.map((inv) => inv.incidentId?.title || 'Unnamed incident').join(', ');
    return harmlessItems
      ? `The following incidents were assessed as harmless and require no immediate action: ${harmlessItems}.`
      : 'No incidents were fully cleared as harmless during this run.';
  }
  if (sectionName === 'recommendations') {
    const escalationItems = severityBuckets.serious
      .map((inv) => {
        const title = inv.incidentId?.title || 'Unnamed incident';
        const why = inv.classification?.reasoning || 'Escalation required based on available evidence.';
        return `${title}: ${why}`;
      })
      .join(' ');
    return escalationItems
      ? `Escalation review is required for the following incidents. ${escalationItems}`
      : 'No escalation-level incidents were identified overnight.';
  }
  if (sectionName === 'anomalies') {
    return 'Drone patrol observations were incorporated into the investigation where available. No additional drone-only anomalies were flagged outside the correlated incidents.';
  }
  if (sectionName === 'follow_up') {
    const uncertainties = investigations
      .flatMap((inv) => inv.classification?.uncertainties || [])
      .filter(Boolean)
      .slice(0, 5);
    return uncertainties.length === 0
      ? 'No immediate follow-up gaps were recorded by Argus for this night.'
      : `The following follow-up checks are recommended: ${uncertainties.join(' ')}`;
  }
  return 'No content generated.';
};

const SECTION_TITLES = {
  executive_summary: 'What Happened Last Night',
  incidents: 'Cleared - No Action Required',
  recommendations: 'Requires Escalation',
  anomalies: 'Drone Patrol Findings',
  follow_up: 'Requires Follow-Up',
};

const SECTION_NAMES = ['executive_summary', 'incidents', 'recommendations', 'anomalies', 'follow_up'];

const draftSection = async (sectionName, investigations, severityBuckets) => {
  const inputContext = investigations.map((inv, index) => {
    const incident = inv.incidentId;
    const classification = inv.classification || {};
    return `${index + 1}. Title: ${incident?.title || 'Unnamed incident'}; Location: ${incident?.location?.name || 'unknown'}; Severity: ${classification.severity || 'uncertain'}; Confidence: ${classification.confidence ?? 0}; Reasoning: ${classification.reasoning || incident?.agentSummary || 'No reasoning'}; Uncertainties: ${(classification.uncertainties || []).join(' | ') || 'None'}`;
  });

  const prompt = [
    BRIEFING_PROSE_INSTRUCTION,
    `Section: ${SECTION_TITLES[sectionName] || sectionName}`,
    'Write this as plain English prose paragraphs.',
    'Do not return JSON. Do not return structured data.',
    'Incident data:',
    ...inputContext,
  ].join('\n');

  try {
    const claude = getClaudeClient();
    const response = await claude.messages.create({
      model: getModelName(),
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const textOutput = response?.content?.find((block) => block?.type === 'text')?.text || '';
    const extracted = extractTextFromResponse(textOutput);
    return extracted || getFallbackSectionText(sectionName, investigations, severityBuckets);
  } catch {
    return getFallbackSectionText(sectionName, investigations, severityBuckets);
  }
};

export const buildBriefing = async (orgId, nightDate, existingBriefingId = null) => {
  let briefing = null;

  try {
    const investigations = await Investigation.find({ orgId, nightDate, status: 'complete' })
      .populate('incidentId')
      .lean();

    if (investigations.length === 0) return null;

    const severityBuckets = { serious: [], minor: [], harmless: [], uncertain: [] };
    for (const inv of investigations) {
      const sev = inv.classification?.severity || 'uncertain';
      severityBuckets[sev]?.push(inv);
    }

    // Create or reset the briefing record to 'generating' before drafting
    if (existingBriefingId) {
      briefing = await Briefing.findById(existingBriefingId);
    }

    if (!briefing) {
      briefing = await Briefing.findOne({ orgId, nightDate }).sort({ generatedAt: -1 });
    }

    if (briefing) {
      briefing.status = 'generating';
      briefing.generationStartedAt = new Date();
      briefing.failureReason = undefined;
      briefing.sections = [];
      await briefing.save();
    } else {
      briefing = await Briefing.create({
        briefingId: `BR-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        orgId,
        nightDate,
        status: 'generating',
        generationStartedAt: new Date(),
        sections: [],
        metadata: {},
      });
    }

    const briefingId = briefing._id.toString();

    // Draft each section sequentially
    const sections = [];
    for (let i = 0; i < SECTION_NAMES.length; i++) {
      const name = SECTION_NAMES[i];
      const content = extractTextFromResponse(
        await draftSection(name, investigations, severityBuckets)
      );
      sections.push({ name, content, lastEditedAt: new Date() });
    }

    const metadata = {
      investigationCount: investigations.length,
      totalTokensUsed: investigations.reduce(
        (sum, inv) => sum + (inv.tokenUsage?.inputTokens || 0) + (inv.tokenUsage?.outputTokens || 0),
        0
      ),
    };

    briefing.status = 'draft';
    briefing.sections = sections;
    briefing.metadata = metadata;
    briefing.generationCompletedAt = new Date();
    briefing.generatedAt = new Date();
    await briefing.save();

    return briefing;
  } catch (error) {
    if (briefing) {
      briefing.status = 'failed';
      briefing.failureReason = error.message;
      try { await briefing.save(); } catch {}
    }
    throw new ApiError(500, 'Failed to generate briefing', [error.message]);
  }
};

export const getLatestBriefing = async (nightDate, orgFilter = {}) => {
  try {
    return (
      (await Briefing.findOne({ ...orgFilter, nightDate }).sort({ generatedAt: -1 }).lean()) || null
    );
  } catch (error) {
    throw new ApiError(500, 'Failed to retrieve latest briefing', [error.message]);
  }
};

export const approveBriefing = async (briefingId, approverId, orgFilter = {}) => {
  try {
    const briefing = await Briefing.findOne({ _id: briefingId, ...orgFilter });
    if (!briefing) throw new ApiError(404, `Briefing not found: ${briefingId}`);
    if (briefing.status !== 'draft') throw new ApiError(400, 'Only draft briefings can be approved');
    briefing.status = 'approved';
    briefing.approvedAt = new Date();
    briefing.approvedBy = approverId;
    await briefing.save();
    return briefing.toJSON();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to approve briefing', [error.message]);
  }
};

export const retryBriefing = async (briefingId, orgFilter = {}) => {
  const briefing = await Briefing.findOne({ _id: briefingId, ...orgFilter });
  if (!briefing) throw new ApiError(404, `Briefing not found: ${briefingId}`);
  if (briefing.status !== 'failed') throw new ApiError(400, 'Only failed briefings can be retried');

  // Reset and enqueue — actual rebuild happens async via worker/caller
  briefing.status = 'generating';
  briefing.failureReason = undefined;
  briefing.generationStartedAt = new Date();
  await briefing.save();
  return briefing.toJSON();
};

export default {
  buildBriefing,
  generateBriefing: buildBriefing,
  getLatestBriefing,
  approveBriefing,
  retryBriefing,
};
