import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/user.models.js";
import ApiKey from "../models/apiKey.model.js";
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
        continue;
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

  apiKey.lastUsedAt = new Date();
  await apiKey.save({ validateBeforeSave: false });

  req.user = {
    _id: apiKey.createdBy,
    role: 'api_key',
    scopes: apiKey.scopes,
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
