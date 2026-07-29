import Briefing from '../models/briefing.model.js';
import Investigation from '../models/investigation.model.js';
import '../models/incident.model.js';
import { ApiError } from '../utils/api-error.js';

const INVESTIGATION_START_PLACEHOLDER =
  'Starting investigation. I will gather the overnight alerts first.';

const isInvestigationPlaceholder = (text) => {
  const trimmed = String(text || '').trim();
  return !trimmed || trimmed === INVESTIGATION_START_PLACEHOLDER || trimmed.includes(INVESTIGATION_START_PLACEHOLDER);
};

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

const SECTION_NAMES = ['executive_summary', 'incidents', 'recommendations', 'anomalies', 'follow_up'];

const SECTION_TITLES = {
  executive_summary: 'What Happened Last Night',
  incidents: 'Cleared - No Action Required',
  recommendations: 'Requires Escalation',
  anomalies: 'Drone Patrol Findings',
  follow_up: 'Requires Follow-Up',
};

const isStaleSectionContent = (sectionName, content) => {
  if (isInvestigationPlaceholder(content)) return true;
  const title = SECTION_TITLES[sectionName];
  const trimmed = String(content || '').trim();
  if (title && trimmed.startsWith(`${title}:`)) return true;
  return false;
};

const briefingSectionsAreStale = (briefing) => {
  const sections = Array.isArray(briefing?.sections) ? briefing.sections : [];
  if (sections.length === 0) return true;
  return SECTION_NAMES.some((name) => {
    const section = sections.find((s) => s.name === name);
    return !section || isStaleSectionContent(name, section.content);
  });
};

const buildSectionsFromInvestigations = (investigations, severityBuckets) =>
  SECTION_NAMES.map((name) => ({
    name,
    content: getFallbackSectionText(name, investigations, severityBuckets),
    lastEditedAt: new Date(),
  }));

export const buildBriefing = async (nightDate, existingBriefingId = null) => {
  let briefing = null;

  try {
    const investigations = await Investigation.find({ nightDate, status: 'complete' })
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
      briefing = await Briefing.findOne({ nightDate }).sort({ generatedAt: -1 });
    }

    const wasApproved = briefing?.status === 'approved';

    if (briefing) {
      briefing.status = 'generating';
      briefing.generationStartedAt = new Date();
      briefing.failureReason = undefined;
      briefing.sections = [];
      await briefing.save();
    } else {
      briefing = await Briefing.create({
        briefingId: `BR-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        nightDate,
        status: 'generating',
        generationStartedAt: new Date(),
        sections: [],
        metadata: {},
      });
    }

    const briefingId = briefing._id.toString();

    // Build sections from completed investigation records — not the agent opener.
    const sections = buildSectionsFromInvestigations(investigations, severityBuckets);

    const metadata = {
      investigationCount: investigations.length,
      totalTokensUsed: investigations.reduce(
        (sum, inv) => sum + (inv.tokenUsage?.inputTokens || 0) + (inv.tokenUsage?.outputTokens || 0),
        0
      ),
    };

    briefing.status = wasApproved ? 'approved' : 'draft';
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

export const getLatestBriefing = async (nightDate) => {
  try {
    let briefing =
      (await Briefing.findOne({ nightDate }).sort({ generatedAt: -1 }).lean()) || null;

    if (!briefing) return null;

    const completedCount = await Investigation.countDocuments({
      nightDate,
      status: 'complete',
    });

    if (completedCount > 0 && briefingSectionsAreStale(briefing)) {
      briefing = await buildBriefing(nightDate, briefing._id.toString());
      if (briefing?.toJSON) briefing = briefing.toJSON();
    }

    return briefing;
  } catch (error) {
    throw new ApiError(500, 'Failed to retrieve latest briefing', [error.message]);
  }
};

export const approveBriefing = async (briefingId, approverId) => {
  try {
    const briefing = await Briefing.findOne({ _id: briefingId });
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

export const retryBriefing = async (briefingId) => {
  const briefing = await Briefing.findOne({ _id: briefingId });
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
