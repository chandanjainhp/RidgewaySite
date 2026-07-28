import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    keyPrefix: {
      type: String,
      required: true,
      description: 'First part of key (e.g., sk_live_1234...) to show in UI',
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      description: 'SHA-256 hash of the full API key',
    },
    scopes: {
      type: [String],
      default: ['events:read', 'events:write'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ApiKey', apiKeySchema);
