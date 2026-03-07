import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { config } from './config';
import { logger } from './utils/logger';
import { RedisClient } from './cache/redis-client';
import { SupabaseClient } from './database/supabase';
import { MigrationRunner } from './database/migrate';
import { metricsCollector } from './services/metrics';
import { HealthStatus } from './types';

// Import API routers
import createAuditRouter from './api/audits/create';
import auditStatusRouter from './api/audits/[id]/status';

// Load environment variables
dotenv.config();

// Initialize services
const redis = new RedisClient();
const db = new SupabaseClient();

// Create Express app
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Readiness check endpoint (checks dependencies)
app.get('/ready', async (req: Request, res: Response) => {
  try {
    const redisConnected = redis.isConnected();
    const dbHealthy = await db.isHealthy();

    const status: HealthStatus = {
      status: redisConnected && dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisConnected,
        database: dbHealthy
      }
    };

    const statusCode = status.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(status);
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      status: 'down',
      timestamp: new Date().toISOString(),
      services: {
        redis: false,
        database: false
      }
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsCollector.getMetricsSnapshot();
    const cacheStats = await redis.getCacheStats();

    res.status(200).json({
      metrics,
      cache_stats: cacheStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics'
    });
  }
});

// Mount API routes
app.use('/api/audits', createAuditRouter);
app.use('/api/audits', auditStatusRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.server.nodeEnv === 'development' ? err.message : undefined
  });
});

// Startup function
async function start() {
  try {
    logger.info('Starting Algolia-Arian backend...');

    // Run database migrations
    logger.info('Running database migrations...');
    const migrationRunner = new MigrationRunner();
    await migrationRunner.run();

    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!redis.isConnected()) {
      logger.warn('Redis not connected - caching will be disabled');
    }

    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Readiness check: http://localhost:${port}/ready`);
      logger.info(`Metrics: http://localhost:${port}/metrics`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await redis.disconnect();
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await redis.disconnect();
  await db.disconnect();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  start();
}

export { app };
