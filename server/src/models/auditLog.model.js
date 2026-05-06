import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorRole: {
      type: String,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    target: {
      type: {
        type: String,
        required: true,
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
auditLogSchema.index({ orgId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

// TTL index to automatically delete logs older than 365 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model('AuditLog', auditLogSchema);
