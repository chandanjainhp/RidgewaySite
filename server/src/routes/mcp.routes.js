import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { mcpServer } from '../mcp/server.js';
import { authenticateRequest, requireScope, scopeToOrg } from '../middlewares/auth.middleware.js';
import { getRedis } from '../db/redis.js';

const router = express.Router();

// Transport registry
const transports = new Map();

// Apply auth to all routes
router.use(authenticateRequest);
router.use(requireScope('mcp'));
router.use(scopeToOrg);

// Rate limiter middleware for POST /messages
const rateLimitToolCalls = async (req, res, next) => {
  if (req.body && req.body.method === 'tools/call') {
    const apiKeyId = req.user.apiKeyId; // from api key auth
    if (!apiKeyId) return next();

    const redis = getRedis();
    const key = `mcp:rate_limit:${apiKeyId}`;
    const windowSeconds = 60;
    const limit = 60;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      console.log(`[MCP] Rate limit exceeded for key ${apiKeyId}`);
      // Return a structured MCP error instead of HTTP 429
      return res.status(200).json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: {
          code: -32000,
          message: 'Rate limit exceeded. Maximum 60 tool calls per minute allowed.'
        }
      });
    }

    // Log the tool call
    const toolName = req.body.params?.name;
    const args = req.body.params?.arguments;
    console.log(`[MCP] Tool call: ${toolName} by org ${req.user.orgId}`);
    
    // We can wrap the transport handlePostMessage to log latency and response size
    // But for now, simple logging of the request is fine.
  }
  next();
};

router.get('/', async (req, res) => {
  try {
    const transport = new SSEServerTransport('/api/v1/mcp/messages', res);
    
    // Attach orgFilter and orgId to session for tool implementations to use
    transport.sessionId = transport.sessionId || crypto.randomUUID(); // Fallback if no getter
    transport.extraParams = {
      orgFilter: req.orgFilter,
      orgId: req.user.orgId
    };

    // Note: sessionContexts is exported and used by mcp/server.js tools
    sessionContexts.set(transport.sessionId, {
      orgFilter: req.orgFilter,
      orgId: req.user.orgId
    });

    transport.onclose = () => {
      transports.delete(transport.sessionId);
      sessionContexts.delete(transport.sessionId);
    };

    // Note: mcpServer connect is stateful, so typically we might need a separate server instance per connection 
    // IF the server state depends on connection. But McpServer handles multiple transports in recent SDKs.
    // Actually, passing extra context to tools:
    // With @modelcontextprotocol/sdk/server/mcp.js, `mcpServer.connect(transport)` handles the stream. 
    // Does `connect()` allow passing extra? `extra` in tool implementation corresponds to `session`.
    // We can monkey-patch the sessionId in our Map to hold orgFilter.

    await mcpServer.connect(transport);
  } catch (error) {
    console.error('[MCP] Error establishing SSE stream:', error);
    if (!res.headersSent) res.status(500).send('Error establishing SSE stream');
  }
});

router.post('/messages', express.json(), rateLimitToolCalls, async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).send('Missing sessionId parameter');
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return res.status(404).send('Session not found');
  }

  try {
    // In SDK, the tool handler's `extra` parameter receives the sessionId as `extra.sessionId`.
    // Wait, mcpServer tools take `extra`. To pass orgFilter, we can just intercept the request or rely on a global map.
    // Actually, we can intercept the POST body and mutate it or just keep a global `sessionContexts` map.
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('[MCP] Error handling message:', error);
    if (!res.headersSent) res.status(500).send('Error handling request');
  }
});

export const sessionContexts = new Map(); // Export for mcp/server.js to use
export default router;
