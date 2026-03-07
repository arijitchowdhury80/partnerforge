/**
 * Audit Orchestrator Worker
 *
 * BullMQ worker that processes audit execution jobs.
 * Listens to the 'audits' queue and executes audits via AuditOrchestrator.
 */

import { Worker, Job } from 'bullmq';
import { logger } from '../utils/logger';
import { AuditOrchestrator } from '../services/audit-orchestrator';
import { WebSocketManager } from '../services/websocket-manager';

// Redis connection configuration (from environment)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
};

interface AuditJobData {
  auditId: string;
}

/**
 * Create and start the audit worker
 *
 * @param wsManager - Optional WebSocketManager for real-time updates
 */
export function createAuditWorker(wsManager?: WebSocketManager): Worker {
  const worker = new Worker<AuditJobData>(
    'audits',
    async (job: Job<AuditJobData>) => {
      const { auditId } = job.data;

      logger.info('Processing audit job', {
        job_id: job.id,
        audit_id: auditId,
        attempts: job.attemptsMade + 1,
      });

      try {
        // Create orchestrator with WebSocket manager
        const orchestrator = new AuditOrchestrator(wsManager);

        // Execute the audit
        await orchestrator.startAudit(auditId);

        logger.info('Audit job completed', {
          job_id: job.id,
          audit_id: auditId,
        });

        // Return success data
        return {
          success: true,
          audit_id: auditId,
          completed_at: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Audit job failed', {
          job_id: job.id,
          audit_id: auditId,
          error: error.message,
          stack: error.stack,
        });

        // Re-throw to trigger BullMQ retry logic
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: 3, // Process up to 3 audits concurrently
      limiter: {
        max: 10, // Max 10 jobs processed
        duration: 60000, // Per 60 seconds (rate limiting)
      },
      lockDuration: 1800000, // 30 minutes lock duration (audits can be long)
      lockRenewTime: 300000, // Renew lock every 5 minutes
    }
  );

  // Worker event handlers

  worker.on('completed', (job: Job, result: any) => {
    logger.info('Worker completed job', {
      job_id: job.id,
      audit_id: job.data.auditId,
      result,
    });
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    if (!job) {
      logger.error('Worker failed with no job context', { error });
      return;
    }

    logger.error('Worker failed job', {
      job_id: job.id,
      audit_id: job.data.auditId,
      attempts: job.attemptsMade,
      error: error.message,
    });
  });

  worker.on('error', (error: Error) => {
    logger.error('Worker error', { error });
  });

  worker.on('active', (job: Job) => {
    logger.info('Worker started processing job', {
      job_id: job.id,
      audit_id: job.data.auditId,
    });
  });

  worker.on('stalled', (jobId: string) => {
    logger.warn('Worker detected stalled job', { job_id: jobId });
  });

  worker.on('progress', (job: Job, progress: number | object) => {
    logger.info('Worker job progress', {
      job_id: job.id,
      audit_id: job.data.auditId,
      progress,
    });
  });

  logger.info('Audit worker started', {
    queue: 'audits',
    concurrency: 3,
    redis_host: redisConfig.host,
    redis_port: redisConfig.port,
  });

  return worker;
}

/**
 * Graceful shutdown handler
 */
export async function shutdownWorker(worker: Worker): Promise<void> {
  logger.info('Shutting down audit worker...');

  try {
    // Wait for active jobs to complete (30 second timeout)
    await worker.close();
    logger.info('Audit worker shut down gracefully');
  } catch (error) {
    logger.error('Error during worker shutdown', { error });
    throw error;
  }
}

// If running as standalone script
if (require.main === module) {
  logger.info('Starting audit worker in standalone mode');

  const worker = createAuditWorker();

  // Handle process signals for graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down worker');
    await shutdownWorker(worker);
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down worker');
    await shutdownWorker(worker);
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in worker', { error });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection in worker', { reason, promise });
    process.exit(1);
  });
}

export default createAuditWorker;
