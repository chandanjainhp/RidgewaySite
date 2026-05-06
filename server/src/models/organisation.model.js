import mongoose from 'mongoose';

const organisationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // URL-safe unique identifier used in API paths and logs
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
      index: true,
    },
    plan: {
      type: String,
      enum: ['trial', 'standard', 'enterprise'],
      default: 'trial',
    },
    // Per-org config overrides — all optional
    config: {
      smtpOverride: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      webhookUrl: {
        type: String,
        default: null,
      },
      webhookSecret: {
        type: String,
        default: null,
      },
      webhookEnabled: {
        type: Boolean,
        default: true,
      },
      siteGeometry: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      aiPromptOverride: {
        type: String,
        default: null,
      },
      usageLimits: {
        eventsPerDay: {
          type: Number,
          default: 10000,
        },
        apiCallsPerMonth: {
          type: Number,
          default: 50000,
        },
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate slug from name if not provided
organisationSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

organisationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Organisation', organisationSchema);
