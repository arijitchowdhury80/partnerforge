import { Worker, Job } from 'bullmq';
import { BrowserAutomationService } from '../services/browser-automation';
import { WebSocketManager } from '../services/websocket-manager';

// Logger will be imported from utils/logger.ts once Agent 1 completes
const logger = {
  info: (message: string, meta?: any) => console.log('[INFO]', message, meta || ''),
  error: (message: string, meta?: any) => console.error('[ERROR]', message, meta || ''),
  warn: (message: string, meta?: any) => console.warn('[WARN]', message, meta || ''),
};

// Supabase client will be imported from database/supabase.ts once Agent 2 completes
// For now, we'll use a placeholder
const supabase = {
  from: (table: string) => ({
    update: (data: any) => ({
      eq: (column: string, value: any) => Promise.resolve({ data, error: null }),
    }),
  }),
};

export interface AuditBrowserJobData {
  auditId: string;
  companyId: string;
  domain: string;
  testSteps: any[];
}

export function createAuditBrowserWorker(wsManager: WebSocketManager) {
  const worker = new Worker<AuditBrowserJobData>(
    'audit-browser',
    async (job: Job<AuditBrowserJobData>) => {
      const { auditId, companyId, domain, testSteps } = job.data;

      logger.info('Starting browser audit', { auditId, jobId: job.id, domain });

      const browser = new BrowserAutomationService();

      try {
        await browser.initialize();

        // Forward browser events to WebSocket
        browser.on('audit:started', (data) => {
          wsManager.emitAuditEvent(auditId, {
            type: 'audit:started',
            data,
            timestamp: new Date(),
          });
        });

        browser.on('test:started', (data) => {
          wsManager.emitAuditEvent(auditId, {
            type: 'test:started',
            data,
            timestamp: new Date(),
          });
        });

        browser.on('test:completed', (data) => {
          wsManager.emitAuditEvent(auditId, {
            type: 'test:completed',
            data,
            timestamp: new Date(),
          });
        });

        browser.on('test:failed', (data) => {
          wsManager.emitAuditEvent(auditId, {
            type: 'test:failed',
            data,
            timestamp: new Date(),
          });
        });

        browser.on('screenshot:captured', (data) => {
          wsManager.emitScreenshot(auditId, data);
        });

        browser.on('finding:detected', (data) => {
          wsManager.emitFinding(auditId, data);
        });

        // Run the audit
        const results = await browser.runSearchAudit(domain, testSteps);

        // Calculate summary statistics
        const passedTests = results.filter((r) => r.passed).length;
        const failedTests = results.filter((r) => !r.passed).length;
        const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

        const findings = results
          .filter((r) => !r.passed && r.finding)
          .map((r) => ({
            testId: r.testId,
            severity: r.severity,
            finding: r.finding,
            screenshotPath: r.screenshot.imagePath,
          }));

        // Save results to database
        await supabase
          .from('audits')
          .update({
            browser_test_results: results,
            browser_test_summary: {
              totalTests: results.length,
              passedTests,
              failedTests,
              totalDuration,
              findings,
            },
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', auditId);

        logger.info('Browser audit completed', {
          auditId,
          totalTests: results.length,
          passed: passedTests,
          failed: failedTests,
          duration: totalDuration,
        });

        wsManager.emitAuditEvent(auditId, {
          type: 'audit:completed',
          data: {
            results,
            summary: {
              totalTests: results.length,
              passedTests,
              failedTests,
              totalDuration,
              findings,
            },
          },
          timestamp: new Date(),
        });

        // Update job progress to 100%
        await job.updateProgress(100);

        return { success: true, results, summary: { totalTests: results.length, passedTests, failedTests } };
      } catch (error: any) {
        logger.error('Browser audit failed', { auditId, error: error.message, stack: error.stack });

        // Update database with error status
        await supabase
          .from('audits')
          .update({
            status: 'failed',
            error_message: error.message,
            error_stack: error.stack,
            failed_at: new Date().toISOString(),
          })
          .eq('id', auditId);

        // Emit error event to WebSocket
        wsManager.emitAuditError(auditId, error);

        throw error;
      } finally {
        await browser.cleanup();
      }
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      concurrency: parseInt(process.env.MAX_CONCURRENT_BROWSERS || '3'),
      limiter: {
        max: 3, // Max 3 concurrent browser audits
        duration: 60000, // Per minute
      },
      // Retry configuration for browser failures
      maxStalledCount: 2, // Retry twice if job stalls
      stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    }
  );

  // Event handlers for worker lifecycle
  worker.on('completed', (job, result) => {
    logger.info('Browser audit worker completed', {
      jobId: job.id,
      auditId: job.data.auditId,
      totalTests: result.summary?.totalTests,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Browser audit worker failed', {
      jobId: job?.id,
      auditId: job?.data.auditId,
      error: err.message,
    });
  });

  worker.on('error', (err) => {
    logger.error('Browser worker error', { error: err.message });
  });

  worker.on('progress', (job, progress) => {
    logger.info('Browser audit progress', {
      jobId: job.id,
      auditId: job.data.auditId,
      progress: `${progress}%`,
    });
  });

  worker.on('active', (job) => {
    logger.info('Browser audit worker active', {
      jobId: job.id,
      auditId: job.data.auditId,
    });
  });

  return worker;
}
