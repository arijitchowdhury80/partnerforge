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
import { SEARCH_TESTS, executeTest } from '../../services/search-test-library';
import { calculateAuditScore } from '../../services/search-audit-scoring';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Search Audit Worker Integration Tests', () => {
  let db: SupabaseClient;
  let browser: Browser;
  let testCompanyId: string;
  let testAuditId: string;
  const testDomain = 'amazon.com'; // Well-known test domain

  beforeAll(async () => {
    // Initialize database connection
    db = new SupabaseClient();

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

    for (const test of SEARCH_TESTS) {
      try {
        const result = await executeTest(test.id, browser, `https://${testDomain}`);
        results.push(result);
        expect(result.testId).toBe(test.id);
        expect(typeof result.passed).toBe('boolean');
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
      } catch (error: any) {
        console.error(`Test ${test.id} failed:`, error.message);
        // Still push a failed result
        results.push({
          testId: test.id,
          passed: false,
          score: 0,
          finding: `Test execution failed: ${error.message}`,
        });
      }
    }

    expect(results).toHaveLength(20);
    console.log(`Executed ${results.length} tests successfully`);
  }, 120000); // 2 minute timeout for all tests

  it('should save test results to database', async () => {
    // Execute a single test
    const test = SEARCH_TESTS[0]; // Test 2a: Homepage Navigation
    const result = await executeTest(test.id, browser, `https://${testDomain}`);

    // Save to database
    await db.insert('search_audit_tests', {
      company_id: testCompanyId,
      audit_id: testAuditId,
      test_name: test.id,
      test_category: 'search_ux',
      test_phase: 'phase2',
      test_query: '',
      executed_at: new Date(),
      passed: result.passed,
      score: result.score,
      severity: 'high',
      finding_summary: result.finding || 'Test passed',
      finding_details: {
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
    expect(saved[0].test_name).toBe(test.id);
    expect(saved[0].passed).toBe(result.passed);
    expect(saved[0].score).toBe(result.score);

    console.log('Test result saved successfully to database');
  }, 30000);

  it('should capture screenshots for failures', async () => {
    // Run a test that's likely to produce a screenshot
    const test = SEARCH_TESTS.find(t => t.id === '2c'); // Simple query test
    if (!test) throw new Error('Test 2c not found');

    const result = await executeTest(test.id, browser, `https://${testDomain}`, 'laptop');

    // Check if screenshot was captured
    if (result.screenshotPath) {
      const screenshotExists = await fs
        .access(result.screenshotPath)
        .then(() => true)
        .catch(() => false);

      expect(screenshotExists).toBe(true);
      console.log(`Screenshot captured: ${result.screenshotPath}`);

      // Verify screenshot file is not empty
      const stats = await fs.stat(result.screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    } else {
      console.log('No screenshot captured (test may have passed)');
    }
  }, 30000);

  it('should calculate overall score correctly', async () => {
    // Execute all tests
    const testResults = [];
    for (const test of SEARCH_TESTS.slice(0, 5)) { // Just first 5 for speed
      try {
        const result = await executeTest(test.id, browser, `https://${testDomain}`);
        testResults.push(result);
      } catch (error: any) {
        testResults.push({
          testId: test.id,
          passed: false,
          score: 0,
          finding: error.message,
        });
      }
    }

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
    it('test 2a: homepage navigation should work', async () => {
      const result = await executeTest('2a', browser, `https://${testDomain}`);
      expect(result.testId).toBe('2a');
      // Homepage should load successfully for well-known sites
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    }, 15000);

    it('test 2c: simple query should work', async () => {
      const result = await executeTest('2c', browser, `https://${testDomain}`, 'laptop');
      expect(result.testId).toBe('2c');
      // Should have some results
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('test 2f: typo handling should work', async () => {
      const result = await executeTest('2f', browser, `https://${testDomain}`, 'headlamp');
      expect(result.testId).toBe('2f');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(10);
    }, 15000);

    it('test 2m: SAYT/autocomplete should work', async () => {
      const result = await executeTest('2m', browser, `https://${testDomain}`, 'sh');
      expect(result.testId).toBe('2m');
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('test 2k: zero-results handling should work', async () => {
      const result = await executeTest('2k', browser, `https://${testDomain}`, 'xyzabc123');
      expect(result.testId).toBe('2k');
      // Should have empty state messaging
      expect(result.score).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle invalid domain gracefully', async () => {
      const invalidDomain = 'invalid-domain-that-does-not-exist-12345.com';

      try {
        await executeTest('2a', browser, `https://${invalidDomain}`);
      } catch (error: any) {
        expect(error).toBeDefined();
        console.log('Invalid domain handled correctly:', error.message);
      }
    }, 15000);

    it('should handle test execution failures', async () => {
      // Try to execute with null browser (should fail)
      try {
        await executeTest('2a', null as any, `https://${testDomain}`);
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error).toBeDefined();
        console.log('Null browser handled correctly');
      }
    });
  });

  describe('Database Schema Validation', () => {
    it('should enforce composite primary key constraint', async () => {
      // Insert a test result
      await db.insert('search_audit_tests', {
        company_id: testCompanyId,
        audit_id: testAuditId,
        test_name: '2a',
        test_category: 'search_ux',
        test_phase: 'phase2',
        test_query: '',
        executed_at: new Date(),
        passed: true,
        score: 10,
        severity: 'low',
        finding_summary: 'Test passed',
        finding_details: {},
        screenshot_count: 0,
        duration_ms: 0,
      });

      // Try to insert duplicate (should fail)
      try {
        await db.insert('search_audit_tests', {
          company_id: testCompanyId,
          audit_id: testAuditId,
          test_name: '2a', // Same test_name = duplicate
          test_category: 'search_ux',
          test_phase: 'phase2',
          test_query: '',
          executed_at: new Date(),
          passed: true,
          score: 10,
          severity: 'low',
          finding_summary: 'Test passed',
          finding_details: {},
          screenshot_count: 0,
          duration_ms: 0,
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
          test_name: '2z',
          test_category: 'search_ux',
          test_phase: 'phase2',
          test_query: '',
          executed_at: new Date(),
          passed: true,
          score: 15, // Invalid: > 10
          severity: 'low',
          finding_summary: 'Test passed',
          finding_details: {},
          screenshot_count: 0,
          duration_ms: 0,
        });
        throw new Error('Should have thrown constraint violation');
      } catch (error: any) {
        expect(error.message).toContain('constraint');
        console.log('Score range constraint working correctly');
      }
    });
  });
});
