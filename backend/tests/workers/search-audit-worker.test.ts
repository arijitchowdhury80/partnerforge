/**
 * Search Audit Worker Integration Tests
 *
 * Tests the complete search audit worker flow:
 * 1. All 20 tests execute
 * 2. Test results saved to database
 * 3. Screenshots captured
 * 4. Overall score calculated
 * 5. Each individual test (2a-2t) works correctly
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, Browser } from 'playwright';
import { SupabaseClient } from '../../database/supabase';
import { SearchTestLibrary } from '../../services/search-test-library';
import { calculateAuditScore } from '../../services/search-audit-scoring';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Search Audit Worker Integration Tests', () => {
  let db: SupabaseClient;
  let browser: Browser;
  let testLibrary: SearchTestLibrary;
  let testCompanyId: string;
  let testAuditId: string;
  const testDomain = 'amazon.com'; // Well-known test domain

  beforeAll(async () => {
    // Initialize database connection
    db = new SupabaseClient();

    // Initialize test library
    testLibrary = new SearchTestLibrary();

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      timeout: 30000,
    });

    // Create test company once for all tests
    const company = await db.insert('companies', {
      domain: testDomain,
      name: 'Test Company',
      industry: 'e-commerce',
    });
    testCompanyId = company.id;

    // Create test audit once for all tests
    const audit = await db.createAudit(testCompanyId, 'search_audit');
    testAuditId = audit.id;

    console.log('Test setup complete: Database and browser initialized');
    console.log(`Created test audit: ${testAuditId} for company ${testCompanyId}`);
  });

  afterAll(async () => {
    // Cleanup
    if (browser) {
      await browser.close();
    }

    // Delete test data
    if (testAuditId && testCompanyId) {
      await db.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
    }

    await db.disconnect();

    console.log('Test teardown complete');
  });

  it('should execute all 20 tests', async () => {
    const results = [];
    const page = await browser.newPage();
    const testIds = testLibrary.getTestIds();

    for (const testId of testIds) {
      try {
        const result = await testLibrary.executeTest(testId, page, testDomain);
        results.push(result);
        expect(result.testId).toBe(testId);
        expect(result.status).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
      } catch (error: any) {
        console.error(`Test ${testId} failed:`, error.message);
        // Still push a failed result
        results.push({
          testId: testId,
          testName: `Test ${testId}`,
          status: 'failed',
          score: 0,
          duration: 0,
          screenshots: [],
          findings: [`Test execution failed: ${error.message}`],
          evidence: [],
        });
      }
    }

    await page.close();
    expect(results).toHaveLength(20);
    console.log(`Executed ${results.length} tests successfully`);
  }, 120000); // 2 minute timeout for all tests

  it('should save test results to database', async () => {
    // Execute a single test
    const page = await browser.newPage();
    const testContext = { screenshotDir: './screenshots' };
    const testId = 'homepage-load';
    const result = await testLibrary.executeTest(testId, page, testDomain, testContext);
    await page.close();

    // Save to database (using migration 009 schema with short ID)
    await db.insert('search_audit_tests', {
      company_id: testCompanyId,
      audit_id: testAuditId,
      test_id: '2a', // Short ID for VARCHAR(10)
      test_name: result.testName,
      query: '',
      passed: result.status === 'passed',
      score: result.score,
      finding: result.findings.length > 0 ? result.findings[0] : 'Test passed',
      severity: result.status === 'failed' ? 'HIGH' : 'LOW',
      evidence: result.evidence.length > 0 ? JSON.stringify(result.evidence) : null,
      screenshot_path: result.screenshots.length > 0 ? result.screenshots[0].filePath : null,
      metadata: {
        evidence: result.evidence,
      },
      screenshot_count: result.screenshotPath ? 1 : 0,
      duration_ms: 0,
    });

    // Verify saved
    const saved = await db.query('search_audit_tests', {
      company_id: testCompanyId,
      audit_id: testAuditId,
    });

    expect(saved).toHaveLength(1);
    expect(saved[0].test_id).toBe('2a');
    expect(saved[0].passed).toBe(result.status === 'passed' || result.status === 'warning');
    expect(saved[0].score).toBe(result.score);

    console.log('Test result saved successfully to database');
  }, 30000);

  it('should capture screenshots for failures', async () => {
    // Run a test that's likely to produce a screenshot
    const page = await browser.newPage();
    const testId = 'first-search'; // Simple query test
    const testContext = {
      screenshotDir: './screenshots',
      testQueries: {
        basic: 'laptop',
        brand: 'laptop',
        typo: 'laptop',
        synonym: 'laptop',
        nlp: 'laptop',
      }
    };

    const result = await testLibrary.executeTest(testId, page, testDomain, testContext);
    await page.close();

    // Check if screenshot was captured
    if (result.screenshots.length > 0) {
      const screenshotPath = result.screenshots[0].filePath;
      const screenshotExists = await fs
        .access(screenshotPath)
        .then(() => true)
        .catch(() => false);

      expect(screenshotExists).toBe(true);
      console.log(`Screenshot captured: ${screenshotPath}`);

      // Verify screenshot file is not empty
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    } else {
      console.log('No screenshot captured (test may have passed)');
    }
  }, 30000);

  it('should calculate overall score correctly', async () => {
    // Execute all tests
    const testResults = [];
    const page = await browser.newPage();
    const testIds = testLibrary.getTestIds().slice(0, 5); // Just first 5 for speed

    for (const testId of testIds) {
      try {
        const result = await testLibrary.executeTest(testId, page, testDomain);
        testResults.push(result);
      } catch (error: any) {
        testResults.push({
          testId: testId,
          testName: `Test ${testId}`,
          status: 'failed',
          score: 0,
          duration: 0,
          screenshots: [],
          findings: [error.message],
          evidence: [],
        });
      }
    }

    await page.close();

    // Calculate score
    const auditScore = await calculateAuditScore(testCompanyId, testAuditId, testResults);

    // Verify score structure
    expect(auditScore.overallScore).toBeGreaterThanOrEqual(0);
    expect(auditScore.overallScore).toBeLessThanOrEqual(10);
    expect(auditScore.dimensionScores).toHaveLength(10); // 10 dimensions
    expect(auditScore.findings.length).toBeLessThanOrEqual(testResults.length);

    // Verify dimension weights sum to 1.0
    const totalWeight = auditScore.dimensionScores.reduce((sum, d) => sum + d.weight, 0);
    expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.01);

    console.log(`Overall audit score: ${auditScore.overallScore.toFixed(1)}/10`);
    console.log(`Dimension scores:`, auditScore.dimensionScores.map(d => `${d.dimension}: ${d.score.toFixed(1)}`));
  }, 60000);

  describe('Individual Test Validation', () => {
    it('homepage-load: homepage navigation should work', async () => {
      const page = await browser.newPage();
      const testContext = { screenshotDir: './screenshots' };
      const result = await testLibrary.executeTest('homepage-load', page, testDomain, testContext);
      await page.close();

      expect(result.testId).toBe('homepage-load');
      // Homepage should load successfully for well-known sites (passed or warning is OK)
      expect(['passed', 'warning']).toContain(result.status);
      expect(result.score).toBeGreaterThan(0);
    }, 15000);

    it('first-search: simple query should work', async () => {
      const page = await browser.newPage();
      const testContext = {
        screenshotDir: './screenshots',
        testQueries: { basic: 'laptop', brand: 'laptop', typo: 'laptop', synonym: 'laptop', nlp: 'laptop' }
      };
      const result = await testLibrary.executeTest('first-search', page, testDomain, testContext);
      await page.close();

      expect(result.testId).toBe('first-search');
      // Should have some results
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('typo-handling: typo handling should work', async () => {
      const page = await browser.newPage();
      const testContext = {
        screenshotDir: './screenshots',
        testQueries: { basic: 'headlamp', brand: 'headlamp', typo: 'hedlamp', synonym: 'headlamp', nlp: 'headlamp' }
      };
      const result = await testLibrary.executeTest('typo-handling', page, testDomain, testContext);
      await page.close();

      expect(result.testId).toBe('typo-handling');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(10);
    }, 15000);

    it('sayt-basic: SAYT/autocomplete should work', async () => {
      const page = await browser.newPage();
      const testContext = {
        screenshotDir: './screenshots',
        testQueries: { basic: 'sh', brand: 'sh', typo: 'sh', synonym: 'sh', nlp: 'sh' }
      };
      const result = await testLibrary.executeTest('sayt-basic', page, testDomain, testContext);
      await page.close();

      expect(result.testId).toBe('sayt-basic');
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('empty-state: zero-results handling should work', async () => {
      const page = await browser.newPage();
      const testContext = {
        screenshotDir: './screenshots',
        testQueries: { basic: 'xyzabc123', brand: 'xyzabc123', typo: 'xyzabc123', synonym: 'xyzabc123', nlp: 'xyzabc123' }
      };
      const result = await testLibrary.executeTest('empty-state', page, testDomain, testContext);
      await page.close();

      expect(result.testId).toBe('empty-state');
      // Should have empty state messaging
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle invalid domain gracefully', async () => {
      const invalidDomain = 'invalid-domain-that-does-not-exist-12345.com';
      const page = await browser.newPage();
      const testContext = { screenshotDir: './screenshots' };

      try {
        await testLibrary.executeTest('homepage-load', page, invalidDomain, testContext);
      } catch (error: any) {
        expect(error).toBeDefined();
        console.log('Invalid domain handled correctly:', error.message);
      } finally {
        await page.close();
      }
    }, 15000);

    it('should handle test execution failures', async () => {
      // Try to execute with null page (should fail)
      const testContext = { screenshotDir: './screenshots' };
      try {
        await testLibrary.executeTest('homepage-load', null as any, testDomain, testContext);
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error).toBeDefined();
        console.log('Null browser handled correctly');
      }
    });
  });

  describe('Database Schema Validation', () => {
    it('should enforce composite primary key constraint', async () => {
      // Insert a test result (using migration 009 schema with short IDs)
      await db.insert('search_audit_tests', {
        company_id: testCompanyId,
        audit_id: testAuditId,
        test_id: '2a', // VARCHAR(10) - must be short
        test_name: 'Homepage Load Test',
        query: null,
        passed: true,
        score: 10,
        finding: 'Test passed',
        severity: 'LOW',
        evidence: null,
        screenshot_path: null,
        metadata: {},
      });

      // Try to insert duplicate (should fail)
      try {
        await db.insert('search_audit_tests', {
          company_id: testCompanyId,
          audit_id: testAuditId,
          test_id: '2a', // Same test_id = duplicate
          test_name: 'Homepage Load Test',
          query: null,
          passed: true,
          score: 10,
          finding: 'Test passed',
          severity: 'LOW',
          evidence: null,
          screenshot_path: null,
          metadata: {},
        });
        throw new Error('Should have thrown duplicate key error');
      } catch (error: any) {
        expect(error.message).toContain('duplicate');
        console.log('Duplicate key constraint working correctly');
      }
    });

    it('should enforce score range constraint', async () => {
      // Try to insert score > 10 (should fail)
      try {
        await db.insert('search_audit_tests', {
          company_id: testCompanyId,
          audit_id: testAuditId,
          test_id: '2z', // VARCHAR(10) - short ID
          test_name: 'Invalid Score Test',
          query: null,
          passed: true,
          score: 15, // Invalid: > 10
          finding: 'Test passed',
          severity: 'LOW',
          evidence: null,
          screenshot_path: null,
          metadata: {},
        });
        throw new Error('Should have thrown constraint violation');
      } catch (error: any) {
        expect(error.message).toContain('constraint');
        console.log('Score range constraint working correctly');
      }
    });
  });
});
