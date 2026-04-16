import { connectMongo, disconnectMongo } from './mongo.js';
import { connectRedis, disconnectRedis } from './redis.js';
import { initGraph, getGraph } from './graph.js';

// Store instances for later access
let instances = {
  mongo: null,
  redis: null,
  graph: null,
};

const connectDatabases = async () => {
  try {
    console.log('[DB] Connecting to databases...');

    // Connect MongoDB
    instances.mongo = await connectMongo();
    console.log('[DB] ✓ MongoDB connected');

    // Connect Redis
    instances.redis = await connectRedis();
    console.log('[DB] ✓ Redis connected');

    // Initialize in-memory graph
    instances.graph = await initGraph();
    console.log('[DB] ✓ Graph initialized');

    console.log('[DB] All databases initialized successfully');
    return instances;
  } catch (error) {
    console.error('[DB] Database initialization failed:', error.message);
    throw error;
  }
};

const disconnectDatabases = async () => {
  try {
    console.log('[DB] Disconnecting from databases...');

    // Disconnect MongoDB
    await disconnectMongo();
    instances.mongo = null;

    // Disconnect Redis
    await disconnectRedis();
    instances.redis = null;

    // Clear in-memory graph
    instances.graph = null;
    console.log('[DB] ✓ Graph cleared');

    console.log('[DB] All databases disconnected');
  } catch (error) {
    console.error('[DB] Disconnection error:', error.message);
    throw error;
  }
};

const getInstances = () => instances;

export { connectDatabases, disconnectDatabases, getInstances };
