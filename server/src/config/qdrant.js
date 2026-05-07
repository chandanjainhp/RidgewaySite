import { QdrantClient } from '@qdrant/js-client-rest';
import logger from '../utils/logger.js';

export const COLLECTION_NAME = 'ridgeway_documents';

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
});

export const ensureCollection = async () => {
  try {
    const { collections } = await qdrantClient.getCollections();
    const exists = collections.some((c) => c.name === COLLECTION_NAME);

    if (exists) {
      logger.info(`[Qdrant] Collection "${COLLECTION_NAME}" already exists — skipping creation`);
      return;
    }

    await qdrantClient.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
    });

    await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'orgId',
      field_schema: 'keyword',
    });

    logger.info(`[Qdrant] Collection "${COLLECTION_NAME}" created with orgId index`);
  } catch (err) {
    logger.error({ err }, '[Qdrant] Failed to ensure collection');
    throw err;
  }
};

export default qdrantClient;
