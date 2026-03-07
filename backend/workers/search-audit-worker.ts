/**
 * Search Audit Worker
 *
 * BullMQ worker that executes all 20 browser-based search tests for a company audit.
 * Uses SearchTestLibrary for test execution, BrowserAutomationService for screenshots,
 * and SearchAuditScoringService for calculating the overall score.
 *
 * Flow:
 * 1. Receive job (companyId, auditId, companyDomain)
 * 2. Initialize browser
 * 3. Execute 20 tests (2a-2t) sequentially
 * 4. Save each test result to search_audit_tests table
 * 5. Stream progress and screenshots via WebSocket
 * 6. Calculate overall score using 10-dimension scoring
 * 7. Update audit record with final score
 * 8. Close browser
 */

import { Worker, Job } from 'bullmq';
import { chromium, Browser } from 'playwright';
import { SupabaseClient } from '../database/supabase';
import { WebSocketManager } from '../services/websocket-manager';
import { SearchTestLibrary, SearchTestResult } from '../services/search-test-library';
import { calculateAuditScore, storeAuditScore } from '../services/search-audit-scoring';
import { logger } from '../utils/logger';
import { DatabaseError } from '../utils/errors';
import { config } from '../config';
import * as path from 'path';
import * as fs from 'fs/promises';

// Job data interface
interface SearchAuditJobData {
  companyId: string;
  auditId: string;
  companyDomain: string;
  queries?: Record<string, string>; // Optional custom queries per test
}

// Global instances (initialized in createWorker)
let db: SupabaseClient;
let wsManager: WebSocketManager;

/**
 * Main worker process function
 */
async function processSearchAudit(job: Job<SearchAuditJobData>): Promise<void> {
  const { companyId, auditId, companyDomain, queries = {} } = job.data;

  logger.info('Starting search audit', { companyId, auditId, companyDomain });

  // Initialize browser
  let browser: Browser | null = null;

  try {
    // 1. Launch browser
    browser = await chromium.launch({
      headless: config.browser.headless,
      timeout: config.browser.timeout,
    });

    logger.info('Browser launched', { auditId });

    // Initialize test library
    const testLibrary = new SearchTestLibrary();
    const page = await browser.newPage();
    const totalTests = 20;

    // Notify frontend that audit has started
    wsManager.emitAuditStarted(auditId, {
      companyDomain,
      totalTests,
      startedAt: new Date(),
    });

    // Update audit status to 'running'
    await db.update('audits', auditId, {
      status: 'running',
      started_at: new Date(),
    });

    // 2. Execute all 20 tests sequentially
    const testResults: SearchTestResult[] = [];
    const testIds = testLibrary.getTestIds(); // Get all test IDs

    for (let i = 0; i < testIds.length; i++) {
      const testId = testIds[i];
      const testNumber = i + 1;

      logger.info(`Executing test ${testId}`, { auditId, progress: `${testNumber}/${totalTests}` });

      // Emit progress update
      wsManager.emitProgress(auditId, testNumber, totalTests, `Running test: ${testId}`);

      try {
        // Execute individual test
        const screenshotDir = path.join(process.cwd(), 'output', 'screenshots', auditId);
        await fs.mkdir(screenshotDir, { recursive: true });

        const testContext = {
          screenshotDir,
          testQueries: queries?.[testId] ? {
            basic: queries[testId],
            brand: queries[testId],
            typo: queries[testId],
            synonym: queries[testId],
            nlp: queries[testId],
          } : undefined
        };

        const result = await testLibrary.executeTest(testId, page, companyDomain, testContext);

        testResults.push(result);

        // 3. Save test result to database
        await db.insert('search_audit_tests', {
          company_id: companyId,
          audit_id: auditId,
          test_name: result.testId,
          test_category: 'search',
          test_phase: 'phase2', // Browser tests are Phase 2
          test_query: queries?.[testId] || '',
          executed_at: new Date(),
          test_status: result.status,
          score: result.score,
          severity: result.status === 'failed' ? 'HIGH' : 'LOW',
          finding_summary: result.findings[0] || 'Test completed',
          finding_details: {
            evidence: result.evidence,
            findings: result.findings,
          },
          screenshot_count: result.screenshots.length,
          duration_ms: result.duration,
        });

        // 4. Save screenshots if captured
        for (const screenshot of result.screenshots) {
          await db.insert('search_audit_screenshots', {
            company_id: companyId,
            audit_id: auditId,
            test_name: result.testId,
            sequence_number: screenshot.sequenceNumber,
            file_path: screenshot.filePath,
            caption: screenshot.caption,
            captured_at: new Date(),
          });

          // Stream screenshot to frontend
          wsManager.emitScreenshot(auditId, {
            testId: result.testId,
            testName: result.testName,
            path: screenshot.filePath,
            finding: result.findings[0],
          });
        }

        // 5. Emit finding if test failed
        if (result.status !== 'passed' && result.findings.length > 0) {
          wsManager.emitFinding(auditId, {
            testId: result.testId,
            testName: result.testName,
            severity: result.status === 'failed' ? 'HIGH' : 'MEDIUM',
            finding: result.findings[0],
            evidence: result.evidence,
            screenshotPath: result.screenshots[0]?.filePath,
          });
        }

        logger.info(`Test ${testId} completed`, {
          auditId,
          test_status: result.status,
          score: result.score,
        });

      } catch (error: any) {
        logger.error(`Test ${testId} failed with error`, {
          auditId,
          testId,
          error: error.message,
        });

        // Save failed test result
        await db.insert('search_audit_tests', {
          company_id: companyId,
          audit_id: auditId,
          test_name: testId,
          test_category: 'search',
          test_phase: 'phase2',
          test_query: queries?.[testId] || '',
          executed_at: new Date(),
          test_status: 'failed',
          score: 0,
          severity: 'high',
          finding_summary: `Test execution failed: ${error.message}`,
          finding_details: { error: error.message },
          screenshot_count: 0,
          duration_ms: 0,
        });

        // Add failed result to array
        testResults.push({
          testId,
          testName: testId,
          status: 'failed',
          score: 0,
          duration: 0,
          screenshots: [],
          findings: [`Test execution failed: ${error.message}`],
          evidence: [],
        });

        // Emit test failure
        wsManager.emitAuditEvent(auditId, {
          type: 'test:failed',
          data: {
            testId,
            testName: testId,
            error: error.message,
          },
          timestamp: new Date(),
        });
      }

      // Human-like delay between tests (avoid bot detection)
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    }

    // 6. Calculate overall score using 10-dimension scoring
    logger.info('Calculating overall audit score', { auditId });

    const auditScore = await calculateAuditScore(companyId, auditId, testResults);

    logger.info('Audit score calculated', {
      auditId,
      overallScore: auditScore.overallScore,
      failedTests: auditScore.findings.length,
    });

    // 7. Update audit record with final score
    await db.update('audits', auditId, {
      status: 'completed',
      score: auditScore.overallScore,
      completed_at: new Date(),
      data: {
        dimensionScores: auditScore.dimensionScores,
        findings: auditScore.findings,
      },
    });

    // Store dimension scores (optional - could be separate table)
    await storeAuditScore(auditScore);

    // 8. Notify frontend of completion
    wsManager.emitAuditCompleted(auditId, {
      overallScore: auditScore.overallScore,
      totalTests,
      passedTests: totalTests - auditScore.findings.length,
      failedTests: auditScore.findings.length,
      dimensionScores: auditScore.dimensionScores,
      completedAt: new Date(),
    });

    logger.info('Search audit completed successfully', {
      auditId,
      companyDomain,
      overallScore: auditScore.overallScore,
      duration: Date.now() - job.timestamp,
    });

  } catch (error: any) {
    logger.error('Search audit failed', {
      auditId,
      companyDomain,
      error: error.message,
      stack: error.stack,
    });

    // Update audit status to 'failed'
    await db.update('audits', auditId, {
      status: 'failed',
      completed_at: new Date(),
      data: {
        error: error.message,
        stack: error.stack,
      },
    });

    // Notify frontend of error
    wsManager.emitAuditError(auditId, error);

    throw error;
  } finally {
    // 9. Clean up browser
    if (browser) {
      await browser.close();
      logger.info('Browser closed', { auditId });
    }
  }
}

/**
 * Map test ID to category
 */
function getCategoryForTest(testId: string): string {
  const categoryMap: Record<string, string> = {
    '2a': 'search_ux',
    '2b': 'search_ux',
    '2c': 'search_ux',
    '2d': 'search_ux',
    '2e': 'search_ux',
    '2f': 'typo_synonym',
    '2g': 'typo_synonym',
    '2h': 'facets',
    '2i': 'nlp',
    '2j': 'search_ux',
    '2k': 'empty_state',
    '2l': 'mobile',
    '2m': 'sayt',
    '2n': 'search_ux',
    '2o': 'facets',
    '2p': 'search_ux',
    '2q': 'recommendations',
    '2r': 'personalization',
    '2s': 'federated_search',
    '2t': 'analytics',
  };

  return categoryMap[testId] || 'search_ux';
}

/**
 * Map severity from test definition to database enum
 */
function mapSeverity(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  return severity.toLowerCase();
}

/**
 * Create and export the worker
 */
export function createSearchAuditWorker(
  supabase: SupabaseClient,
  websocketManager: WebSocketManager
): Worker<SearchAuditJobData> {
  // Initialize global instances
  db = supabase;
  wsManager = websocketManager;

  // Parse Redis URL
  const redisUrl = new URL(config.redis.url);

  const worker = new Worker<SearchAuditJobData>(
    'search-audit',
    processSearchAudit,
    {
      connection: {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port || '6379', 10),
        password: config.redis.password,
      },
      concurrency: 3, // Max 3 audits in parallel
      limiter: {
        max: 5, // Max 5 jobs per...
        duration: 60000, // ...60 seconds
      },
    }
  );

  // Worker event handlers
  worker.on('completed', (job) => {
    logger.info('Search audit job completed', {
      jobId: job.id,
      auditId: job.data.auditId,
      duration: Date.now() - job.timestamp,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Search audit job failed', {
      jobId: job?.id,
      auditId: job?.data.auditId,
      error: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error('Search audit worker error', { error: error.message });
  });

  logger.info('Search audit worker created', {
    concurrency: 3,
  });

  return worker;
}
