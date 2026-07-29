import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { httpLogger } from './utils/logger.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

// Route imports
import healthCheckRouter from './routes/healthcheck.routes.js';
import authRouter from './routes/auth.routes.js';
import eventRouter from './routes/event.routes.js';
import incidentRouter from './routes/incident.routes.js';
import investigationRouter from './routes/investigation.routes.js';
import briefingRouter from './routes/briefing.routes.js';
import mapRouter from './routes/map.routes.js';
import adminRouter from './routes/admin.routes.js';
import siteRouter from './routes/site.routes.js';
import testRouter from './routes/test.routes.js';

const app = express();

// MIDDLEWARE ORDER
// 1. Security headers
app.use(helmet());

// 2. CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. NoSQL injection sanitisation
app.use(mongoSanitize());

// 4. Body parsing (10mb limit for briefing payloads)
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Request logger
app.use(httpLogger);

// 6. Global rate limiter — skip health + event ingestion (events have eventsLimiter at 120/min)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1/health')) return next();
  if (req.method === 'POST' && req.path.startsWith('/api/v1/events')) return next();
  return apiLimiter(req, res, next);
});

// ROUTE MOUNTING (all under /api/v1)
app.use('/api/v1/health', healthCheckRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/incidents', incidentRouter);
app.use('/api/v1/investigations', investigationRouter);
app.use('/api/v1/briefings', briefingRouter);
app.use('/api/v1/map', mapRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/site', siteRouter);
// Back-compat alias while clients migrate off /org
app.use('/api/v1/org', siteRouter);

// DEVELOPMENT ONLY — test routes for seeding events and manual investigation trigger
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/v1/test', testRouter);
  console.log('[app] ⚠ Test routes mounted at /api/v1/test (dev only)');
}

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error middleware (MUST be last)
app.use(errorHandler);

export default app;
