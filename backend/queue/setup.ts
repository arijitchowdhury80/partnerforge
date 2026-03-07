/**
 * BullMQ Queue Configuration
 *
 * Creates and configures job queues for:
 * - Enrichment pipeline (company data collection)
 * - Search audit browser tests
 * - Report generation
 *
 * Uses Redis for queue persistence and job tracking.
 */

import { Queue, QueueOptions, DefaultJobOptions } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
};

// Create Redis connection
export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Redis connected for queue management');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err });
});

// Default job options for all queues
const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // Start with 2s, then 4s, 8s
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24 hours
    count: 1000, // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
    count: 5000, // Keep max 5000 failed jobs
  },
};

// Queue options with concurrency settings
const queueOptions: QueueOptions = {
  connection: redisConfig,
  defaultJobOptions,
};

/**
 * Enrichment Queue
 *
 * Handles company enrichment jobs:
 * - SimilarWeb API calls (traffic, competitors)
 * - BuiltWith API calls (tech stack)
 * - Yahoo Finance API calls (financials)
 * - Apify actors (LinkedIn, jobs, social)
 * - Apollo.io API calls (buying committee, intent signals)
 *
 * Concurrency: 5 jobs at a time (rate limit protection)
 */
export const enrichmentQueue = new Queue('enrichment', {
  ...queueOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5, // Higher retry for API calls
    backoff: {
      type: 'exponential',
      delay: 5000, // Longer backoff for rate limits
    },
  },
});

/**
 * Audit Queue
 *
 * Handles browser-based search audit jobs:
 * - Playwright browser automation
 * - Screenshot capture
 * - Test execution (20 tests)
 * - Results collection
 *
 * Concurrency: 2 jobs at a time (browser resource management)
 */
export const auditQueue = new Queue('audit', {
  ...queueOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    // timeout handled at worker level (10 minutes for browser tests)
    attempts: 2, // Fewer retries for browser tests
  },
});

/**
 * Report Queue
 *
 * Handles report generation jobs:
 * - Markdown report generation
 * - PDF book generation (HTML → PDF)
 * - Presentation deck generation
 * - AE brief generation
 * - Landing page generation
 * - Content spec generation
 *
 * Concurrency: 3 jobs at a time
 */
export const reportQueue = new Queue('report', {
  ...queueOptions,
  defaultJobOptions: {
    ...defaultJobOptions,
    // timeout handled at worker level (5 minutes for report generation)
    attempts: 3,
  },
});

// Export all queues for worker registration
export const queues = {
  enrichment: enrichmentQueue,
  audit: auditQueue,
  report: reportQueue,
};

// Cleanup function for graceful shutdown
export async function closeQueues(): Promise<void> {
  logger.info('Closing queues...');
  await Promise.all([
    enrichmentQueue.close(),
    auditQueue.close(),
    reportQueue.close(),
    redis.quit(),
  ]);
  logger.info('Queues closed');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await closeQueues();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeQueues();
  process.exit(0);
});
