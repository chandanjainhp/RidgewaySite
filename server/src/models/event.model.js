import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    // Identifier and date
    eventId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    nightDate: {
      type: Date,
      required: true,
      index: true,
      description: 'Date only (no time) — which night this event occurred',
    },

    // Event classification
    type: {
      type: String,
      enum: [
        'fence_alert',
        'vehicle_detected',
        'badge_fail',
        'motion_sensor',
        'light_anomaly',
        'drone_observation',
      ],
      required: true,
      index: true,
    },

    // Location
    location: {
      name: {
        type: String,
        required: true,
      },
      coordinates: {
        lat: {
          type: Number,
          required: true,
        },
        lng: {
          type: Number,
          required: true,
        },
      },
      zone: {
        type: String,
        enum: ['perimeter', 'yard', 'block', 'access_point', 'road'],
        required: true,
      },
    },

    // Timing
    timestamp: {
      type: Date,
      required: true,
      index: true,
      description: 'Exact time event occurred',
    },

    // Raw sensor data
    rawData: mongoose.Schema.Types.Mixed,

    // Severity classification
    severity: {
      type: String,
      enum: ['unknown', 'harmless', 'monitor', 'escalate'],
      default: 'unknown',
      index: true,
    },

    // Investigation tracking
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      index: true,
      nullable: true,
      description: 'Set by correlation service after grouping into incident',
    },

    investigationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investigation',
      nullable: true,
      description: 'Set after AI agent completes investigation',
    },

    // AI agent classification
    agentClassification: {
      severity: String,
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        description: 'Confidence score 0-1',
      },
      reasoning: String,
      classifiedAt: Date,
    },

    // Maya's review and override
    mayaReview: {
      decision: {
        type: String,
        enum: ['agreed', 'overridden', 'flagged'],
        nullable: true,
      },
      overrideSeverity: String,
      note: String,
      reviewedAt: Date,
    },

    // Legacy fields (for compatibility during migration)
    description: String,
    source: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
eventSchema.index({ nightDate: 1, type: 1 });
eventSchema.index({ incidentId: 1 });
eventSchema.index({ 'location.name': 1 });
eventSchema.index({ severity: 1, nightDate: -1 });

// Virtual: is this event reviewed by Maya?
eventSchema.virtual('isReviewed').get(function () {
  return !!this.mayaReview?.decision;
});

// Ensure virtuals are included in JSON output
eventSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Event', eventSchema);
