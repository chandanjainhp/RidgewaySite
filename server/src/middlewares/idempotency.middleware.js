import crypto from 'crypto';
import { getRedis } from '../db/redis.js';

const IDEM_KEY_TTL = 24 * 60 * 60;    // 24h for explicit Idempotency-Key
const HASH_KEY_TTL = 5 * 60;           // 5min for content-hash dedup

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

/**
 * Idempotency middleware for POST /api/v1/events.
 *
 * Path 1 — Explicit header:
 *   Idempotency-Key: <uuid>
 *   Redis key: idem:event:{orgId}:{key}  TTL 24h
 *   Returns 200 + cached body on hit (no DB write).
 *
 * Path 2 — Content hash (fallback for drones without header):
 *   Redis key: idem:event:hash:{orgId}:{sha256(orgId+type+ts+loc+sev)}  TTL 5min
 *   Returns 200 + X-Idempotency: hash-dedup on hit.
 */
export const idempotencyMiddleware = async (req, res, next) => {
  const redis = getRedis();
  if (!redis) return next(); // Redis not available — skip dedup

  const orgId = req.user?.orgId?.toString();
  if (!orgId) return next();

  const explicitKey = req.headers['idempotency-key'];

  if (explicitKey) {
    const redisKey = `idem:event:${orgId}:${explicitKey}`;
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return res.status(200).json(parsed);
      }
    } catch (err) {
      console.error('[Idempotency] Redis read error:', err.message);
    }

    // Attach so the controller can write back after responding
    req.idempotencyKey = redisKey;
    req.idempotencyTTL = IDEM_KEY_TTL;
  } else {
    // Content-hash path
    const body = Array.isArray(req.body) ? req.body[0] : req.body;
    if (body) {
      const hashInput = JSON.stringify({
        orgId,
        type: body.type,
        timestamp: body.timestamp,
        locationName: body.location?.name,
        severity: body.severity,
      });
      const hash = sha256(hashInput);
      const redisKey = `idem:event:hash:${orgId}:${hash}`;
      try {
        const cached = await redis.get(redisKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          res.setHeader('X-Idempotency', 'hash-dedup');
          return res.status(200).json(parsed);
        }
      } catch (err) {
        console.error('[Idempotency] Redis hash read error:', err.message);
      }
      req.idempotencyKey = redisKey;
      req.idempotencyTTL = HASH_KEY_TTL;
    }
  }

  // Intercept response to cache it
  if (req.idempotencyKey) {
    const origJson = res.json.bind(res);
    res.json = (body) => {
      const redis2 = getRedis();
      if (redis2) {
        redis2
          .set(req.idempotencyKey, JSON.stringify(body), 'EX', req.idempotencyTTL)
          .catch((err) => console.error('[Idempotency] Redis write error:', err.message));
      }
      return origJson(body);
    };
  }

  next();
};
