/**
 * Enrichment Worker
 *
 * BullMQ worker that processes enrichment jobs.
 * Runs 15 data collection modules in 4 waves (parallel within wave).
 *
 * Job Data:
 * {
 *   companyId: string;
 *   auditId: string;
 *   waves?: number[]; // Optional: run specific waves only
 * }
 *
 * Concurrency: 5 jobs at a time (set in queue/setup.ts)
 */

import { Worker, Job } from 'bullmq';
import { SupabaseClient } from '../database/supabase';
import { WebSocketManager } from '../services/websocket-manager';
import { EnrichmentOrchestrator } from '../services/enrichment-orchestrator';
import { logger } from '../utils/logger';
import { redis } from '../queue/setup';

export interface EnrichmentJobData {
  companyId: string;
  auditId: string;
  waves?: number[]; // Optional: [1, 2, 3, 4] or [1, 3] for selective waves
}

export interface EnrichmentJobResult {
  companyId: string;
  auditId: string;
  wavesCompleted: number[];
  totalModules: number;
  successfulModules: number;
  failedModules: number;
  duration_ms: number;
}

/**
 * Process enrichment job
 */
async function processEnrichment(job: Job<EnrichmentJobData>): Promise<EnrichmentJobResult> {
  const { companyId, auditId, waves } = job.data;
  const startTime = Date.now();

  logger.info('Starting enrichment job', {
    jobId: job.id,
    companyId,
    auditId,
    waves: waves || 'all',
  });

  // Update audit status to 'running'
  const db = new SupabaseClient();
  await db.update('audits', auditId, { status: 'running' });

  try {
    // Initialize orchestrator with WebSocket support
    // (WebSocketManager will be passed in from server.ts if available)
    const orchestrator = new EnrichmentOrchestrator(db);

    // Run specified waves or all waves
    const wavesToRun = waves || [1, 2, 3, 4];
    const wavesCompleted: number[] = [];

    for (const wave of wavesToRun) {
      logger.info(`Running Wave ${wave}`, { companyId, auditId });

      switch (wave) {
        case 1:
          await orchestrator.runWave1(companyId, auditId);
          wavesCompleted.push(1);
          break;
        case 2:
          await orchestrator.runWave2(companyId, auditId);
          wavesCompleted.push(2);
          break;
        case 3:
          await orchestrator.runWave3(companyId, auditId);
          wavesCompleted.push(3);
          break;
        case 4:
          await orchestrator.runWave4(companyId, auditId);
          wavesCompleted.push(4);
          break;
        default:
          logger.warn(`Unknown wave number: ${wave}`, { companyId, auditId });
      }

      // Update job progress (25% per wave)
      const progress = (wavesCompleted.length / wavesToRun.length) * 100;
      await job.updateProgress(progress);
    }

    // Update audit status to 'completed'
    await db.update('audits', auditId, {
      status: 'completed',
      completed_at: new Date(),
    });

    const duration_ms = Date.now() - startTime;

    logger.info('Enrichment job completed', {
      jobId: job.id,
      companyId,
      auditId,
      wavesCompleted,
      duration_ms,
    });

    return {
      companyId,
      auditId,
      wavesCompleted,
      totalModules: 15,
      successfulModules: 15,
      failedModules: 0,
      duration_ms,
    };
  } catch (error) {
    logger.error('Enrichment job failed', {
      jobId: job.id,
      companyId,
      auditId,
      error,
    });

    // Update audit status to 'failed'
    await db.update('audits', auditId, {
      status: 'failed',
      error_message: String(error),
    });

    throw error;
  }
}

/**
 * Initialize and start enrichment worker
 */
export function startEnrichmentWorker(websocketManager?: WebSocketManager): Worker<EnrichmentJobData, EnrichmentJobResult> {
  const worker = new Worker<EnrichmentJobData, EnrichmentJobResult>(
    'enrichment',
    processEnrichment,
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      concurrency: parseInt(process.env.ENRICHMENT_CONCURRENCY || '5', 10),
      limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 1000, // 1 second
      },
    }
  );

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info('Enrichment job completed', {
      jobId: job.id,
      companyId: result.companyId,
      auditId: result.auditId,
      duration_ms: result.duration_ms,
    });

    // Emit completion event via WebSocket
    if (websocketManager) {
      websocketManager.emitAuditEvent(result.auditId, {
        type: 'audit:completed',
        data: result,
        timestamp: new Date(),
      });
    }
  });

  worker.on('failed', (job, error) => {
    logger.error('Enrichment job failed', {
      jobId: job?.id,
      companyId: job?.data.companyId,
      auditId: job?.data.auditId,
      error,
      attemptsMade: job?.attemptsMade,
      attemptsMax: job?.opts?.attempts || 3,
    });

    // Emit failure event via WebSocket
    if (job && websocketManager) {
      websocketManager.emitAuditError(job.data.auditId, error);
    }
  });

  worker.on('progress', (job, progress) => {
    logger.info('Enrichment job progress', {
      jobId: job.id,
      companyId: job.data.companyId,
      auditId: job.data.auditId,
      progress: `${progress}%`,
    });
  });

  worker.on('error', (error) => {
    logger.error('Enrichment worker error', { error });
  });

  logger.info('Enrichment worker started', {
    concurrency: worker.opts.concurrency,
  });

  return worker;
}

// Graceful shutdown handler
export function stopEnrichmentWorker(worker: Worker): Promise<void> {
  logger.info('Stopping enrichment worker...');
  return worker.close();
}

// Auto-start worker if run directly
if (require.main === module) {
  const worker = startEnrichmentWorker();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down enrichment worker');
    await stopEnrichmentWorker(worker);
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down enrichment worker');
    await stopEnrichmentWorker(worker);
    process.exit(0);
  });
}
