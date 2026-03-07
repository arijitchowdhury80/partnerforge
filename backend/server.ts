import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { RedisClient } from './cache/redis-client';
import { SupabaseClient } from './database/supabase';
import { metricsCollector } from './services/metrics';
import { WebSocketManager } from './services/websocket-manager';
import { HealthStatus } from './types';
import { createAuditWorker, shutdownWorker } from './workers/audit-orchestrator-worker';
import { Worker } from 'bullmq';

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

// Create HTTP server (needed for WebSocket)
const httpServer = createServer(app);

// Initialize WebSocket manager
const wsManager = new WebSocketManager(httpServer);

// Worker reference (initialized during startup)
let auditWorker: Worker | null = null;

// Export WebSocket manager for use in workers
export { wsManager };

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for Socket.IO
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

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

// Enrichment endpoint
app.post('/api/enrich', async (req: Request, res: Response) => {
  try {
    const { domain, companyName } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }

    logger.info(`Enrichment request for ${domain}`);

    // Import EnrichmentOrchestrator dynamically to avoid circular deps
    const { EnrichmentOrchestrator } = await import('./services/enrichment-orchestrator');

    // Create or get company
    const { data: existingCompany } = await db['client']
      .from('companies')
      .select()
      .eq('domain', domain)
      .single();

    let companyId: string;

    if (existingCompany) {
      companyId = existingCompany.id;
      logger.info(`Using existing company: ${companyId}`);
    } else {
      const { data: newCompany, error: insertError } = await db['client']
        .from('companies')
        .insert({ domain, name: companyName || domain })
        .select()
        .single();

      if (insertError || !newCompany) {
        throw new Error(`Failed to create company: ${insertError?.message}`);
      }

      companyId = newCompany.id;
      logger.info(`Created new company: ${companyId}`);
    }

    // Create audit
    const { data: audit, error: auditError } = await db['client']
      .from('audits')
      .insert({
        company_id: companyId,
        audit_type: 'enrichment',
        status: 'in_progress'
      })
      .select()
      .single();

    if (auditError || !audit) {
      throw new Error(`Failed to create audit: ${auditError?.message}`);
    }

    logger.info(`Created audit: ${audit.id}`);

    // Run enrichment
    const orchestrator = new EnrichmentOrchestrator(db['client'], wsManager);
    const result = await orchestrator.enrichCompany(companyId, audit.id, domain);

    // Update audit status
    await db['client']
      .from('audits')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', audit.id);

    logger.info(`Enrichment complete for ${domain}`);

    res.status(200).json({
      success: true,
      companyId,
      auditId: audit.id,
      domain: result.domain,
      timestamp: result.timestamp,
      summary: {
        similarweb: result.data.similarweb ? 'success' : 'failed',
        builtwith: result.data.builtwith ? 'success' : 'failed',
        yahooFinance: result.data.yahooFinance ? 'success' : 'failed',
        apify: result.data.apify ? 'success' : 'failed',
        apollo: result.data.apollo ? 'success' : 'failed',
        errors: result.errors
      }
    });

  } catch (error: any) {
    logger.error('Enrichment failed', error);
    res.status(500).json({
      error: 'Enrichment failed',
      message: error.message
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

    // Migrations: Run manually via Supabase CLI:
    // cd /path/to/project && supabase db reset --linked
    logger.info('Skipping automatic migrations (use Supabase CLI)');

    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!redis.isConnected()) {
      logger.warn('Redis not connected - caching will be disabled');
    }

    // Start BullMQ workers
    logger.info('Starting BullMQ workers...');
    auditWorker = createAuditWorker(wsManager);
    logger.info('Audit worker started and listening for jobs');

    // Start server
    const port = config.server.port;
    httpServer.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Readiness check: http://localhost:${port}/ready`);
      logger.info(`Metrics: http://localhost:${port}/metrics`);
      logger.info(`WebSocket: ws://localhost:${port}/ws`);
      logger.info(`Frontend: http://localhost:${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  if (auditWorker) {
    await shutdownWorker(auditWorker);
  }
  await redis.disconnect();
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  if (auditWorker) {
    await shutdownWorker(auditWorker);
  }
  await redis.disconnect();
  await db.disconnect();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  start();
}

export { app };
