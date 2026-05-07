import mongoose from 'mongoose';

const ragDocumentSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    storedPath: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'indexing', 'indexed', 'failed'],
      default: 'pending',
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    vectorIds: {
      type: [String],
      default: [],
    },
    chunkCount: {
      type: Number,
    },
    indexedAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

ragDocumentSchema.index({ orgId: 1, status: 1 });
ragDocumentSchema.index({ orgId: 1, createdAt: -1 });

export default mongoose.model('RagDocument', ragDocumentSchema);
