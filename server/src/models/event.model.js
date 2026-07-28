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

    // Event classification
    type: {
      type: String,
      enum: [
        'motion_detected',
        'badge_swipe_fail',
        'vehicle_entry',
        'fence_alert',
        'environmental',
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
      enum: ['serious', 'minor', 'harmless', 'uncertain'],
      default: 'uncertain',
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
eventSchema.index({ 'location.name': 1 });
eventSchema.index({ severity: 1, nightDate: -1 });

// Ensure virtuals are included in JSON output
eventSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Event', eventSchema);
