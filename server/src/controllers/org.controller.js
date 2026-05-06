import { User } from '../models/user.models.js';
import Organisation from '../models/organisation.model.js';
import WebhookDelivery from '../models/webhookDelivery.model.js';
import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import { logAudit } from '../utils/audit.js';
import { sendEmail, inviteMailgenContent } from '../utils/mail.js';
import crypto from 'crypto';

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
      subject: `You've been invited to Ridgeway — ${org.name}`,
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
