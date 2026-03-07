import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchTestLibrary, TestContext, TestResult } from '../services/search-test-library';
import { chromium, Browser, Page } from 'playwright';

/**
 * Search Test Library Unit Tests
 *
 * Tests all 20 browser test implementations using mock Playwright Page object
 */

describe('SearchTestLibrary', () => {
  let library: SearchTestLibrary;
  let mockBrowser: Browser;
  let mockPage: Page;

  beforeEach(async () => {
    library = new SearchTestLibrary();
    mockBrowser = await chromium.launch({ headless: true });
  });

  afterEach(async () => {
    if (mockBrowser) {
      await mockBrowser.close();
    }
  });

  describe('Test Registration', () => {
    it('should register all 20 tests', () => {
      const allTests = library.getAllTests();
      expect(allTests).toHaveLength(20);
    });

    it('should organize tests into 4 waves', () => {
      const wave1 = library.getWaveTests(1);
      const wave2 = library.getWaveTests(2);
      const wave3 = library.getWaveTests(3);
      const wave4 = library.getWaveTests(4);

      expect(wave1).toHaveLength(5);
      expect(wave2).toHaveLength(5);
      expect(wave3).toHaveLength(5);
      expect(wave4).toHaveLength(5);
    });

    it('should have unique test IDs', () => {
      const allTests = library.getAllTests();
      const ids = allTests.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Wave 1: Foundation Tests', () => {
    const context: TestContext = {
      screenshotDir: '/tmp/test-screenshots',
      testQueries: {
        basic: 'laptop',
        brand: 'macbook',
        typo: 'labtop',
        synonym: 'notebook',
        nlp: 'best laptop for gaming under 1000'
      }
    };

    it('should have homepage-load test', () => {
      const test = library.getTest('homepage-load');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Homepage Load');
      expect(test?.wave).toBe(1);
    });

    it('should have search-box-visibility test', () => {
      const test = library.getTest('search-box-visibility');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Search Box Visibility');
      expect(test?.wave).toBe(1);
    });

    it('should have sayt-basic test', () => {
      const test = library.getTest('sayt-basic');
      expect(test).toBeDefined();
      expect(test?.name).toBe('SAYT Basic');
      expect(test?.wave).toBe(1);
    });

    it('should have first-search test', () => {
      const test = library.getTest('first-search');
      expect(test).toBeDefined();
      expect(test?.name).toBe('First Search');
      expect(test?.wave).toBe(1);
    });

    it('should have results-count test', () => {
      const test = library.getTest('results-count');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Results Count Display');
      expect(test?.wave).toBe(1);
    });
  });

  describe('Wave 2: Core Search Quality Tests', () => {
    it('should have relevance test', () => {
      const test = library.getTest('relevance');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Search Relevance');
      expect(test?.wave).toBe(2);
    });

    it('should have typo-handling test', () => {
      const test = library.getTest('typo-handling');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Typo Tolerance');
      expect(test?.wave).toBe(2);
    });

    it('should have synonym-detection test', () => {
      const test = library.getTest('synonym-detection');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Synonym Detection');
      expect(test?.wave).toBe(2);
    });

    it('should have stop-words test', () => {
      const test = library.getTest('stop-words');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Stop Words Handling');
      expect(test?.wave).toBe(2);
    });

    it('should have special-characters test', () => {
      const test = library.getTest('special-characters');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Special Characters');
      expect(test?.wave).toBe(2);
    });
  });

  describe('Wave 3: Advanced Features Tests', () => {
    it('should have nlp-query test', () => {
      const test = library.getTest('nlp-query');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Natural Language Query');
      expect(test?.wave).toBe(3);
    });

    it('should have federated-search test', () => {
      const test = library.getTest('federated-search');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Federated Search');
      expect(test?.wave).toBe(3);
    });

    it('should have facets test', () => {
      const test = library.getTest('facets');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Faceted Search');
      expect(test?.wave).toBe(3);
    });

    it('should have sort-options test', () => {
      const test = library.getTest('sort-options');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Sort Options');
      expect(test?.wave).toBe(3);
    });

    it('should have empty-state test', () => {
      const test = library.getTest('empty-state');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Empty State Handling');
      expect(test?.wave).toBe(3);
    });
  });

  describe('Wave 4: Intelligence & Mobile Tests', () => {
    it('should have mobile-responsiveness test', () => {
      const test = library.getTest('mobile-responsiveness');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Mobile Search');
      expect(test?.wave).toBe(4);
    });

    it('should have personalization test', () => {
      const test = library.getTest('personalization');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Personalization');
      expect(test?.wave).toBe(4);
    });

    it('should have recommendations test', () => {
      const test = library.getTest('recommendations');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Recommendations');
      expect(test?.wave).toBe(4);
    });

    it('should have search-analytics test', () => {
      const test = library.getTest('search-analytics');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Search Analytics');
      expect(test?.wave).toBe(4);
    });

    it('should have algolia-detection test', () => {
      const test = library.getTest('algolia-detection');
      expect(test).toBeDefined();
      expect(test?.name).toBe('Algolia Detection');
      expect(test?.wave).toBe(4);
    });
  });

  describe('Test Execution', () => {
    const context: TestContext = {
      screenshotDir: '/tmp/test-screenshots',
      testQueries: {
        basic: 'laptop',
        brand: 'macbook',
        typo: 'labtop',
        synonym: 'notebook',
        nlp: 'best laptop for gaming under 1000'
      }
    };

    it('should throw error for non-existent test', async () => {
      mockPage = await mockBrowser.newPage();

      await expect(async () => {
        await library.executeTest('non-existent', mockPage, 'example.com', context);
      }).rejects.toThrow();

      await mockPage.close();
    });

    it('should return TestResult with required fields', async () => {
      mockPage = await mockBrowser.newPage();

      // Execute a simple test that should work
      const result = await library.executeTest('homepage-load', mockPage, 'example.com', context);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('testId');
      expect(result).toHaveProperty('testName');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('screenshots');
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('evidence');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(10);
      expect(['passed', 'failed', 'warning']).toContain(result.status);

      await mockPage.close();
    });

    it('should capture screenshots during test execution', async () => {
      mockPage = await mockBrowser.newPage();

      const result = await library.executeTest('homepage-load', mockPage, 'example.com', context);

      expect(result.screenshots).toBeDefined();
      expect(Array.isArray(result.screenshots)).toBe(true);

      await mockPage.close();
    });

    it('should record execution duration', async () => {
      mockPage = await mockBrowser.newPage();

      const result = await library.executeTest('homepage-load', mockPage, 'example.com', context);

      expect(result.duration).toBeGreaterThan(0);

      await mockPage.close();
    });
  });

  describe('Wave Execution', () => {
    const context: TestContext = {
      screenshotDir: '/tmp/test-screenshots',
      testQueries: {
        basic: 'test',
        brand: 'sony',
        typo: 'tets',
        synonym: 'exam',
        nlp: 'best test for quality'
      }
    };

    it('should execute all tests in wave 1', async () => {
      mockPage = await mockBrowser.newPage();

      const results = await library.executeWave(1, mockPage, 'example.com', context);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('testId');
        expect(result).toHaveProperty('status');
      });

      await mockPage.close();
    }, 60000); // 60 second timeout for wave execution

    it('should handle test failures gracefully', async () => {
      mockPage = await mockBrowser.newPage();

      // Execute tests that might fail
      const results = await library.executeWave(2, mockPage, 'example.com', context);

      expect(results).toHaveLength(5);

      // All tests should complete even if some fail
      results.forEach(result => {
        expect(['passed', 'failed', 'warning']).toContain(result.status);
      });

      await mockPage.close();
    }, 60000);
  });

  describe('Test Result Structure', () => {
    it('should include findings array', async () => {
      mockPage = await mockBrowser.newPage();
      const context: TestContext = {
        screenshotDir: '/tmp/test-screenshots',
        testQueries: {
          basic: 'laptop',
          brand: 'macbook',
          typo: 'labtop',
          synonym: 'notebook',
          nlp: 'best laptop for gaming'
        }
      };

      const result = await library.executeTest('homepage-load', mockPage, 'example.com', context);

      expect(Array.isArray(result.findings)).toBe(true);

      await mockPage.close();
    });

    it('should include evidence array', async () => {
      mockPage = await mockBrowser.newPage();
      const context: TestContext = {
        screenshotDir: '/tmp/test-screenshots',
        testQueries: {
          basic: 'laptop',
          brand: 'macbook',
          typo: 'labtop',
          synonym: 'notebook',
          nlp: 'best laptop for gaming'
        }
      };

      const result = await library.executeTest('homepage-load', mockPage, 'example.com', context);

      expect(Array.isArray(result.evidence)).toBe(true);

      // Check evidence structure if any exist
      if (result.evidence.length > 0) {
        const evidence = result.evidence[0];
        expect(evidence).toHaveProperty('type');
        expect(evidence).toHaveProperty('description');
        expect(evidence).toHaveProperty('value');
        expect(['element', 'network', 'console', 'metric']).toContain(evidence.type);
      }

      await mockPage.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle page navigation errors', async () => {
      mockPage = await mockBrowser.newPage();
      const context: TestContext = {
        screenshotDir: '/tmp/test-screenshots',
        testQueries: {
          basic: 'test',
          brand: 'test',
          typo: 'test',
          synonym: 'test',
          nlp: 'test'
        }
      };

      // Use an invalid domain that will fail
      const result = await library.executeTest('homepage-load', mockPage, 'invalid-domain-12345.com', context);

      expect(result.status).toBe('failed');
      expect(result.score).toBe(0);
      expect(result.findings.length).toBeGreaterThan(0);

      await mockPage.close();
    });

    it('should return structured error result on test failure', async () => {
      mockPage = await mockBrowser.newPage();
      const context: TestContext = {
        screenshotDir: '/tmp/test-screenshots',
        testQueries: {
          basic: 'test',
          brand: 'test',
          typo: 'test',
          synonym: 'test',
          nlp: 'test'
        }
      };

      const result = await library.executeTest('homepage-load', mockPage, 'invalid-domain.com', context);

      expect(result).toHaveProperty('testId');
      expect(result).toHaveProperty('testName');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('score');
      expect(result.status).toBe('failed');

      await mockPage.close();
    });
  });
});
