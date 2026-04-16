import express from 'express';
import cors from 'cors';
import { requestLogger } from './middlewares/requestLogger.middleware.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

// Route imports
import healthCheckRouter from './routes/healthcheck.routes.js';
import authRouter from './routes/auth.routes.js';
import eventRouter from './routes/event.routes.js';
import incidentRouter from './routes/incident.routes.js';
import investigationRouter from './routes/investigation.routes.js';
import briefingRouter from './routes/briefing.routes.js';
import reviewRouter from './routes/review.routes.js';

const app = express();

// MIDDLEWARE ORDER
// 1. CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 2. Body parsing (10mb limit for briefing payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Request logger
app.use(requestLogger);

// 4. Global rate limiter
app.use(apiLimiter);

// ROUTE MOUNTING (all under /api/v1)
app.use('/api/v1/health', healthCheckRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/incidents', incidentRouter);
app.use('/api/v1/investigations', investigationRouter);
app.use('/api/v1/briefing', briefingRouter);
app.use('/api/v1/reviews', reviewRouter);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error middleware (MUST be last)
app.use(errorHandler);

export default app;
