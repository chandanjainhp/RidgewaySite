import mongoose from 'mongoose';

const outboxEventSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    payload: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'dispatched', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: String,
    dispatchedAt: Date,
  },
  { timestamps: true }
);

outboxEventSchema.index({ status: 1, createdAt: 1 });
outboxEventSchema.index({ orgId: 1, createdAt: -1 });

export default mongoose.model('OutboxEvent', outboxEventSchema);
