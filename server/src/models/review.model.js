import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    briefingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Briefing",
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    verdict: {
      type: String,
      enum: [
        "approved",
        "approved_with_notes",
        "needs_revision",
        "rejected",
        "agreed",
        "overridden",
        "flagged",
      ],
      required: true,
    },
    comments: String,
    suggestedChanges: [String],
    overrides: mongoose.Schema.Types.Mixed,
    reviewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

reviewSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Review", reviewSchema);
