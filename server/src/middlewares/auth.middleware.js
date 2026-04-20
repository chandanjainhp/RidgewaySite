import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
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

      if (!user) {
        continue;
      }

      req.user = user;
      next();
      return;
    } catch {
      // Try next token candidate.
    }
  }

  throw new ApiError(401, "Invalid access token");
});

export const validateProjectPermission = (roles = []) =>
  asyncHandler(async (req, res, next) => {
    if (roles.length === 0) {
      return next();
    }

    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action"
      );
    }

    next();
  });
