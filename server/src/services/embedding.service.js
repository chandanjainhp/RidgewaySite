import OpenAI from 'openai';
import logger from '../utils/logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'lm-studio',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const MAX_CHARS = 8000;
const BATCH_SIZE = 100;

const truncate = (text) => {
  const trimmed = text.trim();
  return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) : trimmed;
};

const getMockVector = () => Array.from({ length: 1536 }, () => Math.random());

export const generateEmbedding = async (text) => {
  if (process.env.MOCK_AI === 'true') {
    return getMockVector();
  }
  try {
    const response = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: truncate(text),
    });
    return response.data[0].embedding;
  } catch (err) {
    logger.error({ err }, '[Embedding] Failed to generate embedding');
    throw err;
  }
};

export const generateEmbeddings = async (texts) => {
  if (process.env.MOCK_AI === 'true') {
    return texts.map(() => getMockVector());
  }
  try {
    const truncated = texts.map(truncate);

    if (truncated.length <= BATCH_SIZE) {
      const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: truncated,
      });
      return response.data.map((d) => d.embedding);
    }

    const results = [];
    for (let i = 0; i < truncated.length; i += BATCH_SIZE) {
      const batch = truncated.slice(i, i + BATCH_SIZE);
      const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: batch,
      });
      results.push(...response.data.map((d) => d.embedding));
    }
    return results;
  } catch (err) {
    logger.error({ err }, '[Embedding] Failed to generate embeddings');
    throw err;
  }
};

export default { generateEmbedding, generateEmbeddings };
