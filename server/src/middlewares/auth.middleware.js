import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/user.models.js";
import { getSite, hashIngestionSecret } from "../models/site.model.js";
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

export const verifyIngestionSecret = asyncHandler(async (req, res, next) => {
  const headerToken = req.header("Authorization")?.replace("Bearer ", "")?.trim();

  if (!headerToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  const site = await getSite();
  if (!site.ingestionSecret) {
    throw new ApiError(401, "Ingestion secret not configured");
  }

  const hash = hashIngestionSecret(headerToken);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(site.ingestionSecret, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ApiError(401, "Invalid ingestion secret");
  }

  next();
});

export const authenticateRequest = asyncHandler(async (req, res, next) => {
  return verifyJWT(req, res, next);
});

export const requireRole = (...roles) => asyncHandler(async (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    throw new ApiError(403, "Forbidden: You do not have permission to perform this action");
  }
  next();
});
