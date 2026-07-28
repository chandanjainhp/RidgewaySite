import mongoose from 'mongoose';
import { User } from '../models/user.models.js';
import ApiKey from '../models/apiKey.model.js';
import AuditLog from '../models/auditLog.model.js';
import Event from '../models/event.model.js';
import Incident from '../models/incident.model.js';
import Investigation from '../models/investigation.model.js';
import { logAudit } from '../utils/audit.js';
import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import { getSite } from '../models/site.model.js';
import { getQueueStats as getBullMQStats, getFailedJobs as getBullMQFailed, retryJob as retryBullMQJob, deleteJob as deleteBullMQJob } from '../queues/investigation.queue.js';

// --- Site (singleton) ---

export const getAdminSite = async (req, res) => {
  const site = await getSite();
  const users = await User.find().select('-password -refreshToken').lean();
  const apiKeys = await ApiKey.find().select('-keyHash').lean();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [eventsCount, incidentsCount, investigationsCount] = await Promise.all([
    Event.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Incident.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Investigation.countDocuments({ createdAt: { $gte: startOfMonth } }),
  ]);
  res.status(200).json(new ApiResponse(200, {
    site,
    users,
    apiKeys,
    stats: {
      eventsThisMonth: eventsCount,
      incidentsThisMonth: incidentsCount,
      investigationsThisMonth: investigationsCount,
    },
  }, 'Site detail fetched'));
};

export const updateAdminSite = async (req, res) => {
  const site = await getSite();
  const allowed = ['name', 'timezone', 'locationLabel', 'coordinates', 'siteGeometry', 'webhookUrl', 'webhookEnabled'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) site[key] = req.body[key];
  }
  if (req.body.config && typeof req.body.config === 'object') {
    // legacy shape from old admin org config UI
    const c = req.body.config;
    if (c.siteName) site.name = c.siteName;
    if (c.timezone) site.timezone = c.timezone;
    if (c.coordinates) site.coordinates = c.coordinates;
    if (c.siteGeometry !== undefined) site.siteGeometry = c.siteGeometry;
    if (c.webhookUrl !== undefined) site.webhookUrl = c.webhookUrl;
  }
  await site.save();
  logAudit(req, 'site.config_updated', { type: 'Site', id: site._id });
  res.status(200).json(new ApiResponse(200, site, 'Site updated'));
};

// --- User Management ---

export const listUsers = async (req, res) => {
  const { page = 1, limit = 20, search, role, isActive } = req.query;
  const query = {};

  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select('-password -refreshToken')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await User.countDocuments(query);

  res.status(200).json(new ApiResponse(200, { data: users, total, page: Number(page), limit: Number(limit) }, "Users fetched successfully"));
};

export const setUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['super_admin', 'org_admin', 'operator'].includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  if (req.user._id.toString() === userId) {
    throw new ApiError(403, "Cannot change your own role");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // Block demoting the last super_admin
  if (user.role === 'super_admin' && role !== 'super_admin') {
    const adminCount = await User.countDocuments({ role: 'super_admin' });
    if (adminCount <= 1) {
      throw new ApiError(403, "Cannot demote the last super admin");
    }
  }

  const oldRole = user.role;
  user.role = role;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  logAudit(req, 'user.role_changed', { type: 'User', id: user._id }, { oldRole, newRole: role });

  res.status(200).json(new ApiResponse(200, user, "User role updated successfully"));
};

export const forceLogout = async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshToken = undefined;
  await user.save();

  logAudit(req, 'user.force_logged_out', { type: 'User', id: user._id });

  res.status(200).json(new ApiResponse(200, null, "User forcefully logged out"));
};

export const updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    throw new ApiError(400, "isActive must be a boolean");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  user.isActive = isActive;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const action = isActive ? 'user.activated' : 'user.deactivated';
  logAudit(req, action, { type: 'User', id: user._id });

  res.status(200).json(new ApiResponse(200, { isActive: user.isActive }, "User status updated successfully"));
};

// --- API Key Routes ---

export const listApiKeys = async (req, res) => {
  const { page = 1, limit = 20, status, scope } = req.query;
  const query = {};
  if (status === 'active') query.isActive = true;
  else if (status === 'revoked') query.isActive = false;
  if (scope) query.scopes = scope;

  const keys = await ApiKey.find(query)
    .populate('createdBy', 'email')
    .select('-keyHash')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await ApiKey.countDocuments(query);

  res.status(200).json(new ApiResponse(200, { data: keys, total, page: Number(page), limit: Number(limit) }, "API keys fetched successfully"));
};

export const revokeApiKey = async (req, res) => {
  const { keyId } = req.params;

  const key = await ApiKey.findById(keyId);
  if (!key) throw new ApiError(404, "API key not found");
  if (!key.isActive) throw new ApiError(400, "API key is already revoked");

  key.isActive = false;
  key.revokedAt = new Date();
  key.revokedBy = req.user._id;
  await key.save();

  logAudit(req, 'apiKey.revoked', { type: 'ApiKey', id: key._id });

  res.status(200).json(new ApiResponse(200, null, "API key revoked successfully"));
};

// --- Job Monitor ---

export const getQueueStats = async (req, res) => {
  const counts = await getBullMQStats();
  const stats = [{ queueName: 'investigations', ...counts }];
  res.status(200).json(new ApiResponse(200, stats, "Queue stats fetched"));
};

export const getFailedJobs = async (req, res) => {
  const jobs = await getBullMQFailed();
  const formattedJobs = jobs.map(job => ({
    id: job.id,
    name: job.name,
    queueName: 'investigations',
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    data: job.data,
    attemptsMade: job.attemptsMade,
    failedAt: job.finishedOn || Date.now()
  })).sort((a, b) => b.failedAt - a.failedAt);
  res.status(200).json(new ApiResponse(200, formattedJobs, "Failed jobs fetched"));
};

export const retryJob = async (req, res) => {
  const { queueName, jobId } = req.params;
  if (queueName !== 'investigations') throw new ApiError(400, "Unknown queue");
  try {
    await retryBullMQJob(jobId);
  } catch {
    throw new ApiError(404, "Job not found");
  }
  logAudit(req, 'job.retried', { type: 'Job', id: jobId }, { queueName });
  res.status(200).json(new ApiResponse(200, null, "Job queued for retry"));
};

export const deleteJob = async (req, res) => {
  const { queueName, jobId } = req.params;
  if (queueName !== 'investigations') throw new ApiError(400, "Unknown queue");
  try {
    await deleteBullMQJob(jobId);
  } catch {
    throw new ApiError(404, "Job not found");
  }
  logAudit(req, 'job.deleted', { type: 'Job', id: jobId }, { queueName });
  res.status(200).json(new ApiResponse(200, null, "Job permanently deleted"));
};

// --- Audit Log ---

export const getAuditLogs = async (req, res) => {
  const { page = 1, limit = 50, action, actor, dateFrom, dateTo, search } = req.query;
  const query = {};
  if (action) query.action = action;
  if (actor) query.actor = actor;

  if (dateFrom && dateTo) {
    query.createdAt = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
  } else if (dateFrom) {
    query.createdAt = { $gte: new Date(dateFrom) };
  } else if (dateTo) {
    query.createdAt = { $lte: new Date(dateTo) };
  }

  if (search) {
    const regex = new RegExp(search, 'i');
    const matchingUsers = await User.find({
      $or: [{ username: regex }, { email: regex }, { fullName: regex }]
    }).select('_id').lean();
    query.actor = { $in: matchingUsers.map((u) => u._id) };
  }

  const logs = await AuditLog.find(query)
    .populate('actor', 'username email')
        .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await AuditLog.countDocuments(query);

  res.status(200).json(new ApiResponse(200, { data: logs, total, page: Number(page), limit: Number(limit) }, "Audit logs fetched successfully"));
};
