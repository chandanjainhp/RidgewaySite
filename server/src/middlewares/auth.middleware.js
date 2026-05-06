import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../models/user.models.js";
import ApiKey from "../models/apiKey.model.js";
import { getRedis } from "../db/redis.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const headerToken = req.header("Authorization")?.replace("Bearer ", "")?.trim();
  const cookieToken = req.cookies?.accessToken?.trim();
  const candidateTokens = [headerToken, cookieToken].filter(Boolean);

  if (candidateTokens.length === 0) {
    throw new ApiError(401, "Unauthorized request");
  }

  for (const token of candidateTokens) {
    try {
      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
      );

      if (!user || !user.isActive) {
        continue;
      }

      if (decodedToken.tokenVersion !== user.tokenVersion) {
        continue; // Token was invalidated
      }

      req.user = user;
      return next();
    } catch {
      // Try next token candidate.
    }
  }

  throw new ApiError(401, "Invalid access token");
});

export const verifyApiKey = asyncHandler(async (req, res, next) => {
  const headerToken = req.header("Authorization")?.replace("Bearer ", "")?.trim();
  
  if (!headerToken || !headerToken.startsWith('sk_live_')) {
    throw new ApiError(401, "Unauthorized request");
  }

  const keyHash = crypto.createHash("sha256").update(headerToken).digest("hex");
  
  const apiKey = await ApiKey.findOne({ keyHash });
  
  if (!apiKey || !apiKey.isActive) {
    throw new ApiError(401, "Invalid or inactive API key");
  }
  
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new ApiError(401, "API key has expired");
  }
  
  if (apiKey.revokedAt) {
    throw new ApiError(401, "API key has been revoked");
  }
  
  // Update last used
  apiKey.lastUsedAt = new Date();
  await apiKey.save({ validateBeforeSave: false });

  req.user = {
    _id: apiKey.createdBy,
    orgId: apiKey.orgId,
    role: 'api_key',
    scopes: apiKey.scopes
  };
  
  next();
});

export const authenticateRequest = asyncHandler(async (req, res, next) => {
  const headerToken = req.header("Authorization")?.replace("Bearer ", "")?.trim();
  
  if (headerToken && headerToken.startsWith('sk_live_')) {
    return verifyApiKey(req, res, next);
  }
  
  return verifyJWT(req, res, next);
});

export const requireRole = (...roles) => asyncHandler(async (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    throw new ApiError(403, "Forbidden: You do not have permission to perform this action");
  }
  next();
});

export const requireScope = (scope) => asyncHandler(async (req, res, next) => {
  if (req.user?.role !== 'api_key') return next(); // JWT users bypass scope check
  if (!req.user.scopes?.includes(scope)) {
    throw new ApiError(403, `Forbidden: Missing required scope '${scope}'`);
  }
  next();
});

export const scopeToOrg = asyncHandler(async (req, res, next) => {
  if (req.user?.role === 'super_admin') {
    req.orgFilter = {}; // super_admin sees everything
  } else {
    // Check org status if user belongs to an org
    if (req.user?.orgId) {
      const orgIdStr = req.user.orgId.toString();
      const redis = getRedis();
      let status = null;

      if (redis) {
        status = await redis.get(`org:status:${orgIdStr}`);
      }

      if (!status) {
        const org = await mongoose.model('Organisation').findById(req.user.orgId).lean();
        status = org?.status || 'unknown';
        if (redis) {
          await redis.set(`org:status:${orgIdStr}`, status, 'EX', 300); // 5 mins TTL
        }
      }

      if (status === 'suspended') {
        throw new ApiError(403, "Your organisation's account is suspended. Please contact support.");
      }
    }
    req.orgFilter = { orgId: req.user.orgId };
  }
  next();
});
