import mongoose, { Schema } from "mongoose";
import { Types } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new Schema(
  {
    avatar: {
      type: {
        url: String,
        localPath: String,
      },
      default: {
        url: `https://placehold.co/200x200`,
        localPath: "",
      },
    },
    // RBAC
    role: {
      type: String,
      enum: ['super_admin', 'org_admin', 'operator'],
      default: 'operator',
      index: true,
    },
    orgId: {
      type: Types.ObjectId,
      ref: 'Organisation',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
    },
    invitedBy: {
      type: Types.ObjectId,
      ref: 'User',
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
    },
    inviteToken: String,
    inviteTokenExpiry: Date,
    forgotPasswordToken: {
      type: String,
    },
    forgotPasswordExpiry: {
      type: Date,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpiry: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      role: this.role,
      orgId: this.orgId,
      orgName: this.populated('orgId') ? this.orgId.name : undefined,
      tokenVersion: this.tokenVersion,
    },
    process.env.ACCESS_TOKEN_SECRET || "default-secret-key",
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" },
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET || "default-refresh-secret",
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" },
  );
};

userSchema.methods.generateTemporaryToken = function () {
    // Generate a 6-digit OTP
    const unHashedToken = crypto.randomInt(100000, 999999).toString();

    const hashedToken = crypto
        .createHash("sha256")
        .update(unHashedToken)
        .digest("hex")

    const tokenExpiry = Date.now() + (20*60*1000) // 20 mins
    return {unHashedToken, hashedToken, tokenExpiry}
};

userSchema.methods.generateInviteToken = function () {
  const unHashedToken = crypto.randomBytes(32).toString("hex");

  this.inviteToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");

  this.inviteTokenExpiry = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

  return { unHashedToken, hashedToken: this.inviteToken, tokenExpiry: this.inviteTokenExpiry };
};

export const User = mongoose.model("User", userSchema);
