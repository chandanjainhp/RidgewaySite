import { User } from '../models/user.models.js';
import Organisation from '../models/organisation.model.js';
import WebhookDelivery from '../models/webhookDelivery.model.js';
import ApiKey from '../models/apiKey.model.js';
import AuditLog from '../models/auditLog.model.js';
import RagDocument from '../models/ragDocument.model.js';
import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import { logAudit } from '../utils/audit.js';
import { sendEmail, inviteMailgenContent } from '../utils/mail.js';
import { dispatchWebhook } from '../queues/webhook.queue.js';
import { dispatchIndexingJob } from '../queues/rag.queue.js';
import { deleteDocumentVectors } from '../services/rag.service.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';

export const inviteOperator = async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, "A user with this email already exists");
  }

  const newUser = await User.create({
    username: email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6),
    email,
    password: require('crypto').randomBytes(32).toString('hex'), // Random impossible password
    role: 'operator',
    orgId: req.user.orgId,
    isActive: false,
    invitedBy: req.user._id
  });

  const { unHashedToken } = newUser.generateInviteToken();
  await newUser.save();

  logAudit(req, 'user.invited', { type: 'User', id: newUser._id }, { email, role: 'operator' });

  const org = await Organisation.findById(req.user.orgId).lean();
  const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/invite/accept?token=${unHashedToken}`;

  try {
    await sendEmail({
      email,
      subject: `You've been invited to Sentinel — ${org.name}`,
      mailgenContent: inviteMailgenContent(email, org.name, inviteUrl),
    });
  } catch (error) {
    console.error("Failed to send operator invite email:", error);
  }

  res.status(201).json(new ApiResponse(201, {
    message: "Operator invited successfully",
    inviteLink: process.env.NODE_ENV !== 'production' ? inviteUrl : undefined
  }, "Invitation sent"));
};

export const listOrgMembers = async (req, res) => {
  const users = await User.find(req.orgFilter)
    .select('-password -refreshToken -inviteToken')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json(new ApiResponse(200, users, "Organisation members retrieved successfully"));
};

export const getWebhookConfig = async (req, res) => {
  const org = await Organisation.findById(req.user.orgId).lean();
  
  if (!org) {
    throw new ApiError(404, "Organisation not found");
  }

  const config = {
    webhookUrl: org.config?.webhookUrl || "",
    webhookEnabled: org.config?.webhookEnabled ?? true,
    webhookSecret: org.config?.webhookSecret || "",
  };

  res.status(200).json(new ApiResponse(200, config, "Webhook config retrieved successfully"));
};

export const updateWebhookConfig = async (req, res) => {
  const { webhookUrl, webhookEnabled } = req.body;
  const org = await Organisation.findById(req.user.orgId);

  if (!org) {
    throw new ApiError(404, "Organisation not found");
  }

  if (!org.config) org.config = {};
  
  org.config.webhookUrl = webhookUrl || null;
  org.config.webhookEnabled = webhookEnabled !== undefined ? webhookEnabled : org.config.webhookEnabled;

  if (webhookUrl && !org.config.webhookSecret) {
    org.config.webhookSecret = crypto.randomBytes(32).toString('hex');
  }

  await org.save();
  logAudit(req, 'org.webhook_updated', { type: 'Organisation', id: org._id });

  const config = {
    webhookUrl: org.config.webhookUrl,
    webhookEnabled: org.config.webhookEnabled,
    webhookSecret: org.config.webhookSecret,
  };

  res.status(200).json(new ApiResponse(200, config, "Webhook config updated successfully"));
};

export const rotateWebhookSecret = async (req, res) => {
  const org = await Organisation.findById(req.user.orgId);

  if (!org) {
    throw new ApiError(404, "Organisation not found");
  }

  if (!org.config) org.config = {};
  
  org.config.webhookSecret = crypto.randomBytes(32).toString('hex');
  await org.save();

  logAudit(req, 'org.webhook_secret_rotated', { type: 'Organisation', id: org._id });

  res.status(200).json(new ApiResponse(200, { webhookSecret: org.config.webhookSecret }, "Webhook secret rotated successfully"));
};

export const getWebhookDeliveries = async (req, res) => {
  const { limit = 50, skip = 0 } = req.query;

  const deliveries = await WebhookDelivery.find({ orgId: req.user.orgId })
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  const total = await WebhookDelivery.countDocuments({ orgId: req.user.orgId });

  res.status(200).json(new ApiResponse(200, { deliveries, total }, "Webhook deliveries retrieved successfully"));
};

export const getOrgMe = async (req, res) => {
  const org = await Organisation.findById(req.user.orgId).lean();
  if (!org) throw new ApiError(404, 'Organisation not found');

  if (req.user.role === 'operator') {
    const operatorView = {
      _id: org._id,
      name: org.name,
      status: org.status,
      setupComplete: org.setupComplete,
      config: {
        siteName: org.config?.siteName,
        industry: org.config?.industry,
        timezone: org.config?.timezone,
        coordinates: org.config?.coordinates,
      },
    };
    return res.status(200).json(new ApiResponse(200, operatorView, 'OK'));
  }

  const { webhookSecret, smtpOverride, ...safeConfig } = org.config || {};

  res.status(200).json(new ApiResponse(200, {
    _id: org._id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    status: org.status,
    setupComplete: org.setupComplete,
    config: safeConfig,
    createdAt: org.createdAt,
  }, 'Organisation retrieved successfully'));
};

export const updateOrgConfig = async (req, res) => {
  const org = await Organisation.findById(req.user.orgId);
  if (!org) throw new ApiError(404, 'Organisation not found');

  // Strip sensitive fields — callers cannot set webhookSecret or smtpOverride via this endpoint
  const { webhookSecret: _s, smtpOverride: _o, ...updates } = req.body;

  for (const [key, value] of Object.entries(updates)) {
    org.config[key] = value;
  }
  org.markModified('config');
  await org.save();

  logAudit(req, 'org.config_updated', { type: 'Organisation', id: org._id }, updates);

  const { webhookSecret: _ws, smtpOverride: _so, ...safeConfig } = org.config.toObject();
  res.status(200).json(new ApiResponse(200, safeConfig, 'Organisation config updated'));
};

export const listOrgApiKeys = async (req, res) => {
  const keys = await ApiKey.find({ orgId: req.user.orgId, isActive: true })
    .select('name keyPrefix scopes createdAt lastUsedAt expiresAt')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json(new ApiResponse(200, keys, 'API keys retrieved successfully'));
};

export const createOrgApiKey = async (req, res) => {
  const { name, scopes } = req.body;
  if (!name) throw new ApiError(400, 'name is required');
  if (!Array.isArray(scopes) || scopes.length === 0) throw new ApiError(400, 'scopes must be a non-empty array');

  const rawBytes = crypto.randomBytes(32).toString('hex');
  const fullKey = `sk_live_${rawBytes}`;
  const keyPrefix = fullKey.substring(0, 12) + '...';
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  const apiKey = await ApiKey.create({
    name,
    keyPrefix,
    keyHash,
    scopes,
    orgId: req.user.orgId,
    createdBy: req.user._id,
  });

  logAudit(req, 'apiKey.created', { type: 'ApiKey', id: apiKey._id }, { name, scopes });

  res.status(201).json(new ApiResponse(201, {
    _id: apiKey._id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt,
    key: fullKey,
  }, 'API key created — store this key, it will not be shown again'));
};

export const revokeOrgApiKey = async (req, res) => {
  const apiKey = await ApiKey.findById(req.params.keyId);

  // 404 regardless of reason — do not leak existence to other orgs
  if (!apiKey || apiKey.orgId.toString() !== req.user.orgId.toString()) {
    throw new ApiError(404, 'API key not found');
  }

  apiKey.isActive = false;
  apiKey.revokedAt = new Date();
  apiKey.revokedBy = req.user._id;
  await apiKey.save();

  logAudit(req, 'apiKey.revoked', { type: 'ApiKey', id: apiKey._id }, { name: apiKey.name });

  res.status(200).json(new ApiResponse(200, { revoked: true }, 'API key revoked'));
};

export const testWebhook = async (req, res) => {
  const org = await Organisation.findById(req.user.orgId).lean();
  if (!org) throw new ApiError(404, 'Organisation not found');
  if (!org.config?.webhookUrl) throw new ApiError(400, 'No webhook URL configured');

  const payload = {
    event: 'webhook.test',
    timestamp: new Date(),
    orgId: req.user.orgId,
    message: 'This is a test webhook delivery from Sentinel',
  };

  const payloadString = JSON.stringify(payload);
  let signature = '';
  if (org.config.webhookSecret) {
    signature = crypto
      .createHmac('sha256', org.config.webhookSecret)
      .update(payloadString)
      .digest('hex');
  }

  try {
    const response = await fetch(org.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentinel-Signature': signature,
        'X-Sentinel-Event': 'webhook.test',
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000),
    });

    const responseText = await response.text();
    res.status(200).json(new ApiResponse(200, {
      success: response.ok,
      statusCode: response.status,
      responseBody: responseText.substring(0, 500),
    }, response.ok ? 'Test webhook delivered successfully' : 'Endpoint returned non-2xx'));
  } catch (error) {
    res.status(200).json(new ApiResponse(200, {
      success: false,
      statusCode: 0,
      responseBody: error.message.substring(0, 500),
    }, 'Test webhook delivery failed'));
  }
};

export const retryWebhookDelivery = async (req, res) => {
  const delivery = await WebhookDelivery.findById(req.params.deliveryId);

  if (!delivery || delivery.orgId.toString() !== req.user.orgId.toString()) {
    throw new ApiError(404, 'Delivery not found');
  }

  if (delivery.status === 'delivered') {
    throw new ApiError(400, 'Delivery already succeeded — retry not needed');
  }

  delivery.status = 'pending';
  delivery.nextRetryAt = null;
  await delivery.save();

  await dispatchWebhook(delivery._id.toString());

  res.status(200).json(new ApiResponse(200, { queued: true, deliveryId: delivery._id }, 'Delivery queued for retry'));
};

export const getMcpActivity = async (req, res) => {
  const { limit = 50, skip = 0 } = req.query;

  const filter = { orgId: req.user.orgId, action: /^mcp\./ };

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.status(200).json(new ApiResponse(200, { logs, total }, 'MCP activity retrieved'));
};

// ─── RAG Document Management ─────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'rag', req.user.orgId.toString());
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
  }
};

export const ragUpload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

export const uploadDocument = async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');

  const isAdmin = ['org_admin', 'super_admin'].includes(req.user.role);

  const doc = await RagDocument.create({
    orgId: req.user.orgId,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    storedPath: req.file.path,
    status: isAdmin ? 'approved' : 'pending',
    uploadedBy: req.user._id,
    ...(isAdmin && {
      approvedBy: req.user._id,
      approvedAt: new Date(),
    }),
  });

  logAudit(req, 'document.uploaded', { type: 'RagDocument', id: doc._id }, { filename: doc.originalName, autoApproved: isAdmin });

  if (isAdmin) {
    await dispatchIndexingJob(doc._id, doc.orgId);
  }

  res.status(201).json(new ApiResponse(201, doc, isAdmin ? 'Document uploaded and queued for indexing' : 'Document uploaded — awaiting approval'));
};

export const listDocuments = async (req, res) => {
  const docs = await RagDocument.find({ orgId: req.user.orgId })
    .select('-storedPath')
    .populate('uploadedBy', 'username email')
    .populate('approvedBy', 'username email')
    .populate('rejectedBy', 'username email')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json(new ApiResponse(200, docs, 'Documents retrieved'));
};

export const getDocument = async (req, res) => {
  const doc = await RagDocument.findById(req.params.docId).select('-storedPath').lean();
  if (!doc || doc.orgId.toString() !== req.user.orgId.toString()) {
    throw new ApiError(404, 'Document not found');
  }
  res.status(200).json(new ApiResponse(200, doc, 'Document retrieved'));
};

export const deleteDocument = async (req, res) => {
  const doc = await RagDocument.findById(req.params.docId);
  if (!doc || doc.orgId.toString() !== req.user.orgId.toString()) {
    throw new ApiError(404, 'Document not found');
  }

  if (doc.status === 'indexed') {
    await deleteDocumentVectors(doc);
  }

  if (doc.storedPath) {
    try {
      await fs.unlink(doc.storedPath);
    } catch {
      // File may already be gone — continue with DB deletion
    }
  }

  await doc.deleteOne();

  logAudit(req, 'document.deleted', { type: 'RagDocument', id: doc._id }, { filename: doc.originalName });

  res.status(200).json(new ApiResponse(200, null, 'Document deleted'));
};

export const approveDocument = async (req, res) => {
  const doc = await RagDocument.findById(req.params.docId);
  if (!doc || doc.orgId.toString() !== req.user.orgId.toString()) {
    throw new ApiError(404, 'Document not found');
  }
  if (doc.status !== 'pending') {
    throw new ApiError(400, 'Document is not pending');
  }

  doc.status = 'approved';
  doc.approvedBy = req.user._id;
  doc.approvedAt = new Date();
  await doc.save();

  await dispatchIndexingJob(doc._id, doc.orgId);

  logAudit(req, 'document.approved', { type: 'RagDocument', id: doc._id }, { filename: doc.originalName });

  res.status(200).json(new ApiResponse(200, doc, 'Document approved and queued for indexing'));
};

export const rejectDocument = async (req, res) => {
  const doc = await RagDocument.findById(req.params.docId);
  if (!doc || doc.orgId.toString() !== req.user.orgId.toString()) {
    throw new ApiError(404, 'Document not found');
  }
  if (doc.status !== 'pending') {
    throw new ApiError(400, 'Document is not pending');
  }

  const { reason } = req.body;

  doc.status = 'rejected';
  doc.rejectedBy = req.user._id;
  doc.rejectedAt = new Date();
  doc.rejectionReason = reason || '';
  await doc.save();

  logAudit(req, 'document.rejected', { type: 'RagDocument', id: doc._id }, { filename: doc.originalName, reason });

  res.status(200).json(new ApiResponse(200, doc, 'Document rejected'));
};

export const completeSetup = async (req, res) => {
  const org = await Organisation.findById(req.user.orgId);
  if (!org) throw new ApiError(404, 'Organisation not found');

  org.setupComplete = true;
  if (org.status === 'pending') org.status = 'active';
  await org.save();

  await User.findByIdAndUpdate(req.user._id, { firstLogin: false });

  logAudit(req, 'org.setup.complete', { type: 'Organisation', id: org._id }, {});

  res.status(200).json(new ApiResponse(200, { setupComplete: true }, 'Setup complete'));
};
