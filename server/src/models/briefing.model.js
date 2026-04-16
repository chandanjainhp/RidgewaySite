const mongoose = require('mongoose');

const briefingSchema = new mongoose.Schema(
  {
    briefingId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    investigation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investigation',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    highlights: [String],
    aiGenerated: {
      type: Boolean,
      default: true,
    },
    generatedBy: String,
    audience: {
      type: String,
      enum: ['operator', 'manager', 'executive'],
      default: 'manager',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    attachments: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Briefing', briefingSchema);
