const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    briefing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Briefing',
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    verdict: {
      type: String,
      enum: ['approved', 'needs_revision', 'rejected'],
      required: true,
    },
    comments: String,
    suggestedChanges: [String],
    reviewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
