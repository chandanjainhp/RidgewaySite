import Briefing from '../models/briefing.model.js';
import Investigation from '../models/investigation.model.js';
import { ApiResponse } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';
import {
  getLatestBriefing as getLatestBriefingService,
  approveBriefing as approveBriefingService,
  retryBriefing as retryBriefingService,
  buildBriefing,
} from '../services/briefing.service.js';
import { logAudit } from '../utils/audit.js';
import OutboxEvent from '../models/outboxEvent.model.js';

const OUTBOX_ENABLED = process.env.OUTBOX_ENABLED === 'true';

// Read section content from the canonical array shape
const getSectionContent = (sections, name) => {
  if (!sections) return null;
  if (Array.isArray(sections)) {
    return sections.find((s) => s.name === name)?.content ?? null;
  }
  // Legacy object shape fallback (pre-migration data)
  return sections[name]?.agentDraft ?? sections[name]?.mayaVersion ?? null;
};

const extractSectionText = (value) => {
  if (value == null) return 'No content available.';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') return parsed;
        return parsed.overview || parsed.summary || parsed.content || parsed.text || trimmed;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof value === 'object') {
    return value.overview || value.summary || value.content || value.text || 'No content available.';
  }
  return String(value);
};

const briefingToClientFormat = (briefing) => {
  const secs = briefing.sections;

  return {
    id: briefing._id.toString(),
    briefingId: briefing.briefingId,
    nightDate: briefing.nightDate,
    status: briefing.status,
    generationStartedAt: briefing.generationStartedAt || null,
    generationCompletedAt: briefing.generationCompletedAt || null,
    failureReason: briefing.failureReason || null,
    approvedAt: briefing.approvedAt || null,
    approvedBy: briefing.approvedBy || null,
    metadata: briefing.metadata || {},
    sections: {
      executive_summary: extractSectionText(getSectionContent(secs, 'executive_summary')),
      incidents: extractSectionText(getSectionContent(secs, 'incidents')),
      recommendations: extractSectionText(getSectionContent(secs, 'recommendations')),
      anomalies: extractSectionText(getSectionContent(secs, 'anomalies')),
      follow_up: extractSectionText(getSectionContent(secs, 'follow_up')),
    },
  };
};

export const getLatestBriefing = async (req, res) => {
  const nightDate = req.query.nightDate || new Date().toISOString().split('T')[0];
  const briefing = await getLatestBriefingService(nightDate);

  if (!briefing) {
    return res.status(200).json(new ApiResponse(200, null, 'No briefing available yet'));
  }

  const payload = briefingToClientFormat(briefing);

  res.status(200).json(new ApiResponse(200, payload, 'Briefing fetched successfully'));
};

export const updateBriefingSection = async (req, res) => {
  const { id } = req.params;
  const sectionName = req.params.sectionName || req.body.sectionName;

  const VALID_SECTIONS = ['executive_summary', 'incidents', 'recommendations', 'anomalies', 'follow_up'];
  if (!VALID_SECTIONS.includes(sectionName)) {
    throw new ApiError(400, `Invalid section name: ${sectionName}`);
  }

  const briefing = await Briefing.findOne({ _id: id });
  if (!briefing) throw new ApiError(404, 'Briefing not found');
  if (briefing.status !== 'draft') throw new ApiError(400, 'Only draft briefings can be edited');

  const sections = Array.isArray(briefing.sections) ? [...briefing.sections] : [];
  const idx = sections.findIndex((s) => s.name === sectionName);
  const now = new Date();
  if (idx >= 0) {
    sections[idx] = { name: sectionName, content: req.body.content, lastEditedAt: now };
  } else {
    sections.push({ name: sectionName, content: req.body.content, lastEditedAt: now });
  }
  briefing.sections = sections;
  await briefing.save();

  logAudit(req, 'briefing.section_updated', { type: 'Briefing', id: briefing._id }, { sectionName });

  res.status(200).json(new ApiResponse(200, briefingToClientFormat(briefing.toJSON()), 'Section updated'));
};

export const approveBriefing = async (req, res) => {
  const updated = await approveBriefingService(req.params.id, req.user?._id);

  logAudit(req, 'briefing.approved', { type: 'Briefing', id: updated._id });

  if (OUTBOX_ENABLED) {
    await OutboxEvent.create({
      eventType: 'briefing.ready',
      payload: {
        briefingId: updated._id,
        nightDate: updated.nightDate,
        status: updated.status,
        timestamp: updated.approvedAt || new Date(),
      },
      status: 'pending',
    });
  } else {
    const { triggerWebhook } = await import('../services/webhook.service.js');
    triggerWebhook('briefing.ready', {
      briefingId: updated._id,
      nightDate: updated.nightDate,
      status: updated.status,
      timestamp: updated.approvedAt || new Date(),
    });
  }

  res.status(200).json(new ApiResponse(200, updated, 'Briefing approved successfully'));
};

export const retryBriefing = async (req, res) => {
  const briefing = await retryBriefingService(req.params.id);

  logAudit(req, 'briefing.retry', { type: 'Briefing', id: briefing._id });

  // Kick off rebuild async — don't await so response returns immediately
  buildBriefing(briefing.nightDate, briefing._id?.toString())
    .catch((err) => console.error('[BriefingController] Retry build failed:', err.message));

  res.status(202).json(new ApiResponse(202, { id: briefing._id, status: 'generating' }, 'Briefing retry queued'));
};
