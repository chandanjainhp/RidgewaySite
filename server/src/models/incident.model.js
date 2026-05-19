import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      index: true,
    },
    nightDate: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    title: {
      type: String,
      required: true,
    },

    eventIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Event',
      required: true,
    },

    location: {
      name: {
        type: String,
        required: true,
      },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      zone: {
        type: String,
        enum: ['perimeter', 'yard', 'block', 'access_point', 'road'],
        required: true,
      },
    },

    correlation: {
      type: {
        type: String,
        enum: ['spatial', 'temporal', 'entity', 'cross_type'],
        required: true,
      },
      strategy: String,
      metadata: mongoose.Schema.Types.Mixed,
    },

    entityInvolved: {
      type: {
        type: String,
        enum: ['vehicle', 'employee', 'unknown'],
      },
      id: String,
      displayName: String,
    },

    status: {
      type: String,
      enum: ['open', 'investigating', 'reviewed', 'escalated', 'closed'],
      default: 'open',
      index: true,
    },

    priority: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
      index: true,
    },

    investigationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investigation',
      nullable: true,
    },

    agentSummary: {
      type: String,
    },

    severity: {
      type: String,
      enum: ['serious', 'minor', 'harmless', 'uncertain'],
      default: 'uncertain',
      index: true,
    },

    // Legacy fields (for compatibility)
    incidentId: String,
    description: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

incidentSchema.index({ nightDate: 1, status: 1 });
incidentSchema.index({ priority: 1, nightDate: -1 });
incidentSchema.index({ severity: 1, nightDate: -1 });

incidentSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Incident', incidentSchema);
