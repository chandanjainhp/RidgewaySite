import crypto from 'crypto';
import qdrantClient, { COLLECTION_NAME } from '../config/qdrant.js';
import { generateEmbedding, generateEmbeddings } from './embedding.service.js';
import RagDocument from '../models/ragDocument.model.js';
import logger from '../utils/logger.js';

const UPSERT_BATCH_SIZE = 100;

// ─── chunkText ────────────────────────────────────────────────────────────────

export const chunkText = (text, chunkSize = 512, overlap = 50) => {
  const chunkChars = chunkSize * 4;
  const overlapChars = overlap * 4;
  const minChars = 100;
  const sentenceEndRegex = /[.!?]\s/g;

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkChars, text.length);

    // Try to snap to a sentence boundary in the last 20% of the chunk
    if (end < text.length) {
      const snapStart = start + Math.floor(chunkChars * 0.8);
      const segment = text.slice(snapStart, end);
      let lastSentenceEnd = -1;
      let match;
      sentenceEndRegex.lastIndex = 0;
      while ((match = sentenceEndRegex.exec(segment)) !== null) {
        lastSentenceEnd = snapStart + match.index + 1;
      }
      if (lastSentenceEnd > snapStart) {
        end = lastSentenceEnd;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length >= minChars) {
      chunks.push(chunk);
    }

    // Next chunk starts (chunkChars - overlapChars) forward
    start += chunkChars - overlapChars;
    if (start >= text.length) break;
  }

  return chunks;
};

// ─── indexDocument ────────────────────────────────────────────────────────────

export const indexDocument = async (ragDocumentId, text, orgId) => {
  const doc = await RagDocument.findById(ragDocumentId);
  if (!doc) throw new Error(`RagDocument not found: ${ragDocumentId}`);

  doc.status = 'indexing';
  await doc.save();

  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error('No valid chunks extracted from document');

    const vectors = await generateEmbeddings(chunks);

    const allUUIDs = chunks.map(() => crypto.randomUUID());

    for (let batchStart = 0; batchStart < chunks.length; batchStart += UPSERT_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + UPSERT_BATCH_SIZE, chunks.length);
      const points = [];

      for (let i = batchStart; i < batchEnd; i++) {
        points.push({
          id: allUUIDs[i],
          vector: vectors[i],
          payload: {
            orgId: orgId.toString(),
            documentId: ragDocumentId.toString(),
            chunkIndex: i,
            text: chunks[i],
            filename: doc.filename,
          },
        });
      }

      await qdrantClient.upsert(COLLECTION_NAME, { points });
    }

    doc.status = 'indexed';
    doc.vectorIds = allUUIDs;
    doc.chunkCount = chunks.length;
    doc.indexedAt = new Date();
    doc.errorMessage = undefined;
    await doc.save();

    logger.info(`[RAG] Indexed document ${ragDocumentId}: ${chunks.length} chunks`);
  } catch (err) {
    doc.status = 'failed';
    doc.errorMessage = err.message;
    await doc.save();
    logger.error({ err }, `[RAG] Failed to index document ${ragDocumentId}`);
    throw err;
  }
};

// ─── queryRag ────────────────────────────────────────────────────────────────

export const queryRag = async (queryText, orgId, topK = 5) => {
  try {
    const embedding = await generateEmbedding(queryText);

    const results = await qdrantClient.search(COLLECTION_NAME, {
      vector: embedding,
      limit: topK,
      filter: {
        must: [{ key: 'orgId', match: { value: orgId.toString() } }],
      },
      with_payload: true,
    });

    if (!results || results.length === 0) return [];

    return results.map((r) => ({
      text: r.payload.text,
      filename: r.payload.filename,
      score: r.score,
      chunkIndex: r.payload.chunkIndex,
    }));
  } catch (err) {
    logger.error({ err }, '[RAG] queryRag failed');
    return [];
  }
};

// ─── deleteDocumentVectors ────────────────────────────────────────────────────

export const deleteDocumentVectors = async (ragDocument) => {
  if (!ragDocument.vectorIds || ragDocument.vectorIds.length === 0) return;

  try {
    await qdrantClient.delete(COLLECTION_NAME, {
      points: ragDocument.vectorIds,
    });
    logger.info(`[RAG] Deleted ${ragDocument.vectorIds.length} vectors for document ${ragDocument._id}`);
  } catch (err) {
    logger.error({ err }, `[RAG] Failed to delete vectors for document ${ragDocument._id}`);
    throw err;
  }
};

export default { chunkText, indexDocument, queryRag, deleteDocumentVectors };
