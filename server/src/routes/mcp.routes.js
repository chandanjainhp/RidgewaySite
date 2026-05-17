import express from 'express';
import crypto from 'crypto';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { mcpServer } from '../mcp/server.js';
import { authenticateRequest, requireScope, scopeToOrg } from '../middlewares/auth.middleware.js';
import { getRedis } from '../db/redis.js';
import { logAudit } from '../utils/audit.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Transport registry
const transports = new Map();

// FIX 1 — Public OAuth 2.1 discovery endpoint (no auth — must be defined before router.use(authenticateRequest))
router.get('/.well-known/oauth-authorization-server', (req, res) => {
  const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    issuer: serverUrl,
    authorization_endpoint: `${serverUrl}/auth/login`,
    token_endpoint: `${serverUrl}/api/v1/auth/token`,
    scopes_supported: ['mcp', 'events:write'],
    response_types_supported: ['token'],
  });
});

// Apply auth to all routes below this point
router.use(authenticateRequest);
router.use(requireScope('mcp'));
router.use(scopeToOrg);

// FIX 4 — SSE concurrent connection limit: max 10 open connections per org
const SSE_CONN_LIMIT = 10;

const limitSseConnections = async (req, res, next) => {
  const redis = getRedis();
  const orgId = req.user.orgId;
  const connKey = `mcp:sse_conn:${orgId}`;

  const current = await redis.incr(connKey);
  // No TTL — decremented on close. Set a safety TTL in case close never fires (1 hour).
  if (current === 1) await redis.expire(connKey, 3600);

  if (current > SSE_CONN_LIMIT) {
    await redis.decr(connKey);
    logger.warn({ orgId, current }, '[MCP] SSE connection limit reached');
    return res.status(429).json({
      error: 'Too many concurrent SSE connections. Maximum 10 per organisation.',
    });
  }

  // Decrement on any close signal
  const releaseConn = async () => {
    try { await redis.decr(connKey); } catch (_) {}
  };
  res.on('close', releaseConn);
  res.on('finish', releaseConn);

  next();
};

// FIX 4 — Rate limiter: 60 tool calls/min per API key
const rateLimitToolCalls = async (req, res, next) => {
  if (req.body?.method !== 'tools/call') return next();

  const apiKeyId = req.user.apiKeyId;
  if (apiKeyId) {
    const redis = getRedis();
    const key = `mcp:rate_limit:${apiKeyId}`;
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, 60);

    if (current > 60) {
      logger.warn({ apiKeyId, orgId: req.user.orgId }, '[MCP] Rate limit exceeded');
      return res.status(200).json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: {
          code: -32000,
          message: 'Rate limit exceeded. Maximum 60 tool calls per minute allowed.',
        },
      });
    }
  }

  next();
};

// FIX 3 — Audit logging for all tool calls (separate from rate limiting)
const auditToolCalls = (req, res, next) => {
  if (req.body?.method !== 'tools/call') return next();

  const toolName = req.body.params?.name;
  const inputSummary = JSON.stringify(req.body.params?.arguments ?? {}).slice(0, 200);
  const startMs = Date.now();

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const success = !body?.error;
    logAudit(req, 'mcp.tool_call', 'mcp', {
      toolName,
      orgId: req.user.orgId,
      durationMs: Date.now() - startMs,
      success,
      inputSummary,
      ...(success ? {} : { errorCode: body?.error?.code }),
    }).catch(() => {});
    return originalJson(body);
  };

  next();
};

router.get('/', limitSseConnections, async (req, res) => {
  try {
    const transport = new SSEServerTransport('/api/v1/mcp/messages', res);

    transport.sessionId = transport.sessionId || crypto.randomUUID();
    transport.extraParams = {
      orgFilter: req.orgFilter,
      orgId: req.user.orgId,
    };

    sessionContexts.set(transport.sessionId, {
      orgFilter: req.orgFilter,
      orgId: req.user.orgId,
    });

    transport.onclose = () => {
      transports.delete(transport.sessionId);
      sessionContexts.delete(transport.sessionId);
    };

    await mcpServer.connect(transport);
  } catch (error) {
    logger.error({ err: error }, '[MCP] Error establishing SSE stream');
    if (!res.headersSent) res.status(500).send('Error establishing SSE stream');
  }
});

router.post('/messages', express.json(), rateLimitToolCalls, auditToolCalls, async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).send('Missing sessionId parameter');
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return res.status(404).send('Session not found');
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    logger.error({ err: error }, '[MCP] Error handling message');
    if (!res.headersSent) res.status(500).send('Error handling request');
  }
});

export const sessionContexts = new Map(); // Export for mcp/server.js to use
export default router;
