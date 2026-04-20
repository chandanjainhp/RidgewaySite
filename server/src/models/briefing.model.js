import mongoose from "mongoose";

const briefingSectionSchema = new mongoose.Schema(
  {
    agentDraft: mongoose.Schema.Types.Mixed,
    mayaVersion: mongoose.Schema.Types.Mixed,
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const briefingSchema = new mongoose.Schema(
  {
    briefingId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    nightDate: {
      type: Date,
      required: true,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "pending_revision"],
      default: "pending_review",
      index: true,
    },
    sections: {
      executive_summary: briefingSectionSchema,
      incidents: briefingSectionSchema,
      recommendations: briefingSectionSchema,
      anomalies: briefingSectionSchema,
      follow_up: briefingSectionSchema,
    },
    metadata: mongoose.Schema.Types.Mixed,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastReview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
    },
  },
  { timestamps: true }
);

briefingSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Briefing", briefingSchema);
