import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const ADMIN_GATE_COOKIE = "ridgeway_admin_gate";
const ADMIN_GATE_SCOPE = "admin_config";
const DEFAULT_TTL_SECONDS = 15 * 60;

const getAdminGateSecret = () => {
  const secret = process.env.ADMIN_GATE_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new ApiError(500, "Admin gate secret is not configured");
  }
  return secret;
};

const getConfiguredAdminPassword = () => {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    throw new ApiError(500, "ADMIN_PASSWORD is not configured");
  }
  return configured;
};

const secureCompare = (a, b) => {
  const aBuf = Buffer.from(a || "", "utf8");
  const bBuf = Buffer.from(b || "", "utf8");
  const max = Math.max(aBuf.length, bBuf.length, 1);
  const aPad = Buffer.alloc(max);
  const bPad = Buffer.alloc(max);
  aBuf.copy(aPad);
  bBuf.copy(bPad);
  const equal = crypto.timingSafeEqual(aPad, bPad);
  return equal && aBuf.length === bBuf.length;
};

const verifySubmittedPassword = async (submittedPassword) => {
  const configuredPassword = getConfiguredAdminPassword();
  if (configuredPassword.startsWith("$2a$") || configuredPassword.startsWith("$2b$") || configuredPassword.startsWith("$2y$")) {
    return bcrypt.compare(submittedPassword, configuredPassword);
  }
  return secureCompare(submittedPassword, configuredPassword);
};

const readGatePayload = (req) => {
  const token = req.cookies?.[ADMIN_GATE_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getAdminGateSecret());
    if (payload?.scope !== ADMIN_GATE_SCOPE) return null;
    return payload;
  } catch {
    return null;
  }
};

export const loginAdminGate = asyncHandler(async (req, res) => {
  const email = req.body?.email;
  const password = req.body?.password;

  const configuredEmail = process.env.ADMIN_EMAIL;
  if (!configuredEmail) {
    throw new ApiError(500, "ADMIN_EMAIL is not configured");
  }

  // To prevent timing attacks, always verify both email and password
  const emailMatches = secureCompare(email || "", configuredEmail);
  const isPasswordValid = await verifySubmittedPassword(password || "");

  if (!emailMatches || !isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const ttlSeconds = Number(process.env.ADMIN_GATE_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  const token = jwt.sign(
    { scope: ADMIN_GATE_SCOPE },
    getAdminGateSecret(),
    { expiresIn: ttlSeconds },
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ttlSeconds * 1000,
    path: "/",
  };

  return res
    .status(200)
    .cookie(ADMIN_GATE_COOKIE, token, cookieOptions)
    .json(new ApiResponse(200, { authenticated: true, expiresInSeconds: ttlSeconds }, "Admin settings access granted"));
});

export const getAdminGateStatus = asyncHandler(async (req, res) => {
  const payload = readGatePayload(req);
  return res
    .status(200)
    .json(new ApiResponse(200, {
      authenticated: Boolean(payload),
      expiresAt: payload?.exp ? new Date(payload.exp * 1000).toISOString() : null,
    }, "Admin settings status"));
});

export const logoutAdminGate = asyncHandler(async (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };

  return res
    .status(200)
    .clearCookie(ADMIN_GATE_COOKIE, cookieOptions)
    .json(new ApiResponse(200, { authenticated: false }, "Admin settings access cleared"));
});

export const requireAdminGateSession = (req, _res, next) => {
  const payload = readGatePayload(req);
  if (!payload) {
    return next(new ApiError(401, "Admin settings session required"));
  }
  return next();
};

