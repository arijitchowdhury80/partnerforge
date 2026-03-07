/**
 * Deliverables Worker
 *
 * Background job processor for generating audit deliverables.
 * Uses BullMQ for job queue management and Redis for state.
 *
 * ARCHITECTURE:
 * - Listens to 'deliverables' queue
 * - Processes deliverables generation jobs asynchronously
 * - Emits progress events via WebSocket
 * - Stores results in database
 * - Handles retries and failures
 *
 * JOB DATA:
 * - companyId: string
 * - auditId: string
 * - companyName: string
 * - config: Partial<DeliverablesConfig>
 *
 * JOB EVENTS:
 * - progress: Percentage complete (0-100)
 * - completed: Job finished successfully
 * - failed: Job failed with error
 */

import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config';
import { WebSocketManager } from '../services/websocket-manager';
import { ScratchpadManager } from '../services/scratchpad-manager';
import {
  DeliverablesOrchestrator,
  createDeliverablesOrchestrator,
  DeliverablesConfig,
  ProgressEvent,
} from '../services/deliverables-orchestrator';

/**
 * Deliverables job data
 */
export interface DeliverablesJobData {
  companyId: string;
  auditId: string;
  companyName: string;
  config?: Partial<DeliverablesConfig>;
  userId?: string; // For WebSocket notifications
  sessionId?: string; // For WebSocket room
}

/**
 * Deliverables job result
 */
export interface DeliverablesJobResult {
  companyId: string;
  auditId: string;
  companyName: string;
  files: {
    pdfBook?: string;
    landingPageHTML?: string;
    landingPageSpec?: string;
    deckMarkdown?: string;
    aeBrief?: string;
    signalBrief?: string;
    markdownReport?: string;
  };
  metadata: {
    generatedAt: Date;
    totalFiles: number;
    totalSize: number;
    estimatedReadTime: number;
  };
  databaseRecordId?: string;
}

/**
 * Deliverables Worker
 *
 * Processes deliverables generation jobs from the queue.
 */
export class DeliverablesWorker {
  private worker: Worker;
  private queue: Queue;
  private redis: Redis;
  private wsManager: WebSocketManager;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis(config.redis.url);

    // Initialize WebSocket manager
    this.wsManager = new WebSocketManager();

    // Initialize queue (for adding jobs)
    this.queue = new Queue('deliverables', {
      connection: this.redis,
    });

    // Initialize worker (for processing jobs)
    this.worker = new Worker(
      'deliverables',
      async (job: Job<DeliverablesJobData>) => this.processJob(job),
      {
        connection: this.redis,
        concurrency: config.queue.deliverablesConcurrency || 2, // Max 2 parallel deliverable jobs
        limiter: {
          max: 5, // Max 5 jobs per minute (heavy CPU/memory usage)
          duration: 60000, // 1 minute
        },
      }
    );

    // Register event listeners
    this.registerEventListeners();

    logger.info('Deliverables worker initialized');
  }

  /**
   * Process deliverables generation job
   */
  private async processJob(job: Job<DeliverablesJobData>): Promise<DeliverablesJobResult> {
    const { companyId, auditId, companyName, config: jobConfig, userId, sessionId } = job.data;

    logger.info(`Processing deliverables job ${job.id} for company=${companyName}, audit=${auditId}`);

    try {
      // Update job progress: 0%
      await job.updateProgress(0);
      this.emitWebSocketEvent(sessionId, 'deliverables:started', {
        jobId: job.id,
        companyName,
        auditId,
      });

      // Create scratchpad manager
      const scratchpad = new ScratchpadManager(companyId, auditId, companyName);

      // Create orchestrator with progress callback
      const orchestrator = createDeliverablesOrchestrator(scratchpad, {
        ...jobConfig,
        onProgress: (event: ProgressEvent) => {
          // Calculate progress percentage based on completed steps
          const progress = this.calculateProgress(event);
          job.updateProgress(progress);

          // Emit WebSocket event
          this.emitWebSocketEvent(sessionId, 'deliverables:progress', {
            jobId: job.id,
            step: event.step,
            deliverable: event.deliverable,
            status: event.status,
            progress,
            timestamp: event.timestamp,
          });

          logger.debug(`Job ${job.id} progress: ${progress}% (${event.deliverable} ${event.status})`);
        },
      });

      // Generate all deliverables
      const result = await orchestrator.generateAll();

      // Update job progress: 100%
      await job.updateProgress(100);
      this.emitWebSocketEvent(sessionId, 'deliverables:completed', {
        jobId: job.id,
        companyName,
        auditId,
        files: result.files,
        metadata: result.metadata,
      });

      logger.info(`Deliverables job ${job.id} completed: ${result.metadata.totalFiles} files generated`);

      return result;
    } catch (error) {
      logger.error(`Deliverables job ${job.id} failed`, error);

      this.emitWebSocketEvent(sessionId, 'deliverables:failed', {
        jobId: job.id,
        companyName,
        auditId,
        error: String(error),
      });

      throw error;
    }
  }

  /**
   * Calculate progress percentage based on event
   */
  private calculateProgress(event: ProgressEvent): number {
    // Map steps to progress ranges
    const progressMap: Record<string, { start: number; end: number }> = {
      initialization: { start: 0, end: 5 },
      pdf: { start: 5, end: 25 },
      'landing-page': { start: 25, end: 40 },
      deck: { start: 40, end: 60 },
      'ae-brief': { start: 60, end: 75 },
      'signal-brief': { start: 75, end: 85 },
      'markdown-report': { start: 85, end: 95 },
      finalization: { start: 95, end: 100 },
    };

    const range = progressMap[event.step] || { start: 0, end: 100 };

    if (event.status === 'started') {
      return range.start;
    } else if (event.status === 'completed') {
      return range.end;
    } else if (event.status === 'failed') {
      return range.start; // Stay at start if failed
    }

    return range.start;
  }

  /**
   * Emit WebSocket event to session room
   */
  private emitWebSocketEvent(sessionId: string | undefined, event: string, data: any) {
    if (sessionId && this.wsManager) {
      this.wsManager.emitToRoom(sessionId, event, data);
    }
  }

  /**
   * Register event listeners
   */
  private registerEventListeners() {
    this.worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed`, error);
    });

    this.worker.on('error', (error) => {
      logger.error('Worker error', error);
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn(`Job ${jobId} stalled`);
    });
  }

  /**
   * Add deliverables generation job to queue
   */
  async addJob(data: DeliverablesJobData, priority?: number): Promise<Job<DeliverablesJobData>> {
    const job = await this.queue.add('generate-deliverables', data, {
      priority: priority || 10, // Default priority
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 60000, // Start with 1 minute backoff
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 1 day
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
      },
    });

    logger.info(`Added deliverables job ${job.id} for company=${data.companyName}, audit=${data.auditId}`);

    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  }

  /**
   * Close worker and connections
   */
  async close() {
    await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
    logger.info('Deliverables worker closed');
  }
}

/**
 * Singleton instance
 */
let workerInstance: DeliverablesWorker | null = null;

/**
 * Get or create worker instance
 */
export function getDeliverablesWorker(): DeliverablesWorker {
  if (!workerInstance) {
    workerInstance = new DeliverablesWorker();
  }
  return workerInstance;
}

/**
 * Close worker instance
 */
export async function closeDeliverablesWorker() {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

/**
 * Convenience function: Queue deliverables generation
 */
export async function queueDeliverablesGeneration(
  companyId: string,
  auditId: string,
  companyName: string,
  config?: Partial<DeliverablesConfig>,
  userId?: string,
  sessionId?: string
): Promise<Job<DeliverablesJobData>> {
  const worker = getDeliverablesWorker();
  return worker.addJob({
    companyId,
    auditId,
    companyName,
    config,
    userId,
    sessionId,
  });
}
