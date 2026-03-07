import { Page } from 'playwright';
import { logger } from '../utils/logger';
import { APIError } from '../utils/errors';
import * as path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Search Test Library
 *
 * Contains 20 browser test implementations organized in 4 waves:
 * - Wave 1: Foundation Tests (5 tests)
 * - Wave 2: Core Search Quality (5 tests)
 * - Wave 3: Advanced Features (5 tests)
 * - Wave 4: Intelligence & Mobile (5 tests)
 *
 * Based on /algolia-search-audit skill methodology adapted for web application.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SearchTest {
  id: string;
  name: string;
  description: string;
  wave: number;
  execute: (page: Page, domain: string, context: TestContext) => Promise<TestResult>;
}

export interface TestContext {
  screenshotDir: string;
  testQueries?: TestQueries;
  verticalContext?: VerticalContext;
}

export interface TestQueries {
  basic: string; // e.g., "laptop"
  brand: string; // e.g., "macbook"
  typo: string; // e.g., "labtop"
  synonym: string; // e.g., "notebook"
  nlp: string; // e.g., "best laptop for gaming under 1000"
}

export interface VerticalContext {
  industry: string; // e.g., "electronics", "fashion", "grocery"
  expectedCategories: string[]; // e.g., ["laptops", "computers", "electronics"]
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'warning';
  score: number; // 0-10
  duration: number; // ms
  screenshots: Screenshot[];
  findings: string[];
  evidence: Evidence[];
}

export interface Screenshot {
  sequenceNumber: number;
  caption: string;
  filePath: string;
  annotations?: Annotation[];
}

export interface Annotation {
  type: 'box' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  label?: string;
}

export interface Evidence {
  type: 'element' | 'network' | 'console' | 'metric';
  description: string;
  value: any;
}

// ============================================================================
// SEARCH TEST LIBRARY CLASS
// ============================================================================

export class SearchTestLibrary {
  private tests: Map<string, SearchTest> = new Map();

  constructor() {
    this.registerTests();
  }

  /**
   * Register all 20 tests
   */
  private registerTests() {
    // Wave 1: Foundation Tests
    this.registerTest(this.createHomepageLoadTest());
    this.registerTest(this.createSearchBoxVisibilityTest());
    this.registerTest(this.createSAYTBasicTest());
    this.registerTest(this.createFirstSearchTest());
    this.registerTest(this.createResultsCountTest());

    // Wave 2: Core Search Quality
    this.registerTest(this.createRelevanceTest());
    this.registerTest(this.createTypoHandlingTest());
    this.registerTest(this.createSynonymDetectionTest());
    this.registerTest(this.createStopWordsTest());
    this.registerTest(this.createSpecialCharactersTest());

    // Wave 3: Advanced Features
    this.registerTest(this.createNLPQueryTest());
    this.registerTest(this.createFederatedSearchTest());
    this.registerTest(this.createFacetsTest());
    this.registerTest(this.createSortOptionsTest());
    this.registerTest(this.createEmptyStateTest());

    // Wave 4: Intelligence & Mobile
    this.registerTest(this.createMobileResponsivenessTest());
    this.registerTest(this.createPersonalizationTest());
    this.registerTest(this.createRecommendationsTest());
    this.registerTest(this.createSearchAnalyticsTest());
    this.registerTest(this.createAlgoliaDetectionTest());
  }

  private registerTest(test: SearchTest) {
    this.tests.set(test.id, test);
  }

  /**
   * Execute a single test by ID
   */
  async executeTest(
    testId: string,
    page: Page,
    domain: string,
    context: TestContext
  ): Promise<TestResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new APIError(404, `Test not found: ${testId}`, 'SearchTestLibrary', false);
    }

    logger.info('Executing test', { testId, testName: test.name });
    const startTime = Date.now();

    try {
      const result = await test.execute(page, domain, context);
      result.duration = Date.now() - startTime;

      logger.info('Test completed', {
        testId,
        status: result.status,
        score: result.score,
        duration: result.duration
      });

      return result;
    } catch (error: any) {
      logger.error('Test execution failed', { testId, error: error.message });

      return {
        testId: test.id,
        testName: test.name,
        status: 'failed',
        score: 0,
        duration: Date.now() - startTime,
        screenshots: [],
        findings: [`Test execution error: ${error.message}`],
        evidence: []
      };
    }
  }

  /**
   * Execute all tests in a specific wave
   */
  async executeWave(
    waveNumber: number,
    page: Page,
    domain: string,
    context: TestContext
  ): Promise<TestResult[]> {
    const waveTests = Array.from(this.tests.values()).filter(
      test => test.wave === waveNumber
    );

    logger.info('Executing wave', { waveNumber, testCount: waveTests.length });

    const results: TestResult[] = [];

    for (const test of waveTests) {
      const result = await this.executeTest(test.id, page, domain, context);
      results.push(result);

      // Small delay between tests to avoid rate limiting
      await this.delay(500);
    }

    return results;
  }

  /**
   * Execute all tests (all 4 waves)
   */
  async executeAll(
    page: Page,
    domain: string,
    context: TestContext
  ): Promise<TestResult[]> {
    const allResults: TestResult[] = [];

    for (let wave = 1; wave <= 4; wave++) {
      const waveResults = await this.executeWave(wave, page, domain, context);
      allResults.push(...waveResults);
    }

    return allResults;
  }

  /**
   * Get test by ID
   */
  getTest(testId: string): SearchTest | undefined {
    return this.tests.get(testId);
  }

  /**
   * Get all tests in a wave
   */
  getWaveTests(waveNumber: number): SearchTest[] {
    return Array.from(this.tests.values()).filter(test => test.wave === waveNumber);
  }

  /**
   * Get all tests
   */
  getAllTests(): SearchTest[] {
    return Array.from(this.tests.values());
  }

  // ============================================================================
  // WAVE 1: FOUNDATION TESTS (5 tests)
  // ============================================================================

  private createHomepageLoadTest(): SearchTest {
    return {
      id: 'homepage-load',
      name: 'Homepage Load',
      description: 'Verify homepage loads successfully and search box is present',
      wave: 1,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        // Navigate to homepage
        const loadStartTime = Date.now();
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });
        const loadTime = Date.now() - loadStartTime;

        evidence.push({
          type: 'metric',
          description: 'Page load time',
          value: `${loadTime}ms`
        });

        // Check if page loaded successfully
        const title = await page.title();
        evidence.push({
          type: 'element',
          description: 'Page title',
          value: title
        });

        if (!title || title.toLowerCase().includes('error')) {
          findings.push('Homepage failed to load or returned error');
          score = 0;
        }

        // Check for search box
        const hasSearchBox = await this.findSearchInput(page);
        if (!hasSearchBox) {
          findings.push('Search box not found on homepage');
          score = Math.max(score - 5, 0);
        } else {
          evidence.push({
            type: 'element',
            description: 'Search box found',
            value: true
          });
        }

        // Take screenshot
        const screenshot = await this.captureScreenshot(
          page,
          'homepage-load',
          1,
          'Homepage loaded',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        // Slow load time warning
        if (loadTime > 5000) {
          findings.push(`Slow homepage load time: ${loadTime}ms (> 5s)`);
          score = Math.max(score - 2, 0);
        }

        return {
          testId: 'homepage-load',
          testName: 'Homepage Load',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createSearchBoxVisibilityTest(): SearchTest {
    return {
      id: 'search-box-visibility',
      name: 'Search Box Visibility',
      description: 'Check if search box is visible and functional',
      wave: 1,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        // Find search input
        const searchSelector = await this.findSearchInput(page);

        if (!searchSelector) {
          findings.push('Search box not found on page');
          score = 0;
        } else {
          // Check if visible
          const isVisible = await page.locator(searchSelector).isVisible();
          if (!isVisible) {
            findings.push('Search box exists but is not visible');
            score = 3;
          }

          // Check if enabled
          const isEnabled = await page.locator(searchSelector).isEnabled();
          if (!isEnabled) {
            findings.push('Search box is disabled');
            score = Math.max(score - 3, 0);
          }

          // Check placeholder text
          const placeholder = await page.locator(searchSelector).getAttribute('placeholder');
          evidence.push({
            type: 'element',
            description: 'Search box placeholder',
            value: placeholder || 'none'
          });

          if (!placeholder || placeholder.length === 0) {
            findings.push('Search box has no placeholder text (poor UX)');
            score = Math.max(score - 1, 0);
          }
        }

        // Take screenshot
        const screenshot = await this.captureScreenshot(
          page,
          'search-box-visibility',
          1,
          'Search box visibility check',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'search-box-visibility',
          testName: 'Search Box Visibility',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createSAYTBasicTest(): SearchTest {
    return {
      id: 'sayt-basic',
      name: 'SAYT Basic',
      description: 'Test if search-as-you-type shows suggestions',
      wave: 1,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'sayt-basic',
            testName: 'SAYT Basic',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Type a search query slowly
        const query = context.testQueries?.basic || 'laptop';
        await page.locator(searchSelector).click();
        await this.humanTypeText(page, searchSelector, query.substring(0, 3));

        // Wait for suggestions to appear
        await page.waitForTimeout(1000);

        // Look for suggestion dropdowns
        const suggestionSelectors = [
          '[role="listbox"]',
          '.autocomplete-suggestions',
          '.search-suggestions',
          '.suggestions',
          '[data-testid="suggestions"]',
          '.typeahead-dropdown',
          '.aa-dropdown-menu' // Algolia Autocomplete
        ];

        let suggestionsFound = false;
        let suggestionCount = 0;

        for (const selector of suggestionSelectors) {
          const suggestionElements = await page.locator(selector).count();
          if (suggestionElements > 0) {
            suggestionsFound = true;
            suggestionCount = suggestionElements;
            break;
          }
        }

        if (!suggestionsFound) {
          findings.push('No SAYT suggestions found');
          score = 0;
        } else {
          evidence.push({
            type: 'element',
            description: 'SAYT suggestions found',
            value: suggestionCount
          });

          if (suggestionCount < 3) {
            findings.push(`Only ${suggestionCount} suggestions shown (expected 5-10)`);
            score = 5;
          }
        }

        // Take screenshot
        const screenshot = await this.captureScreenshot(
          page,
          'sayt-basic',
          1,
          'SAYT suggestions',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'sayt-basic',
          testName: 'SAYT Basic',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createFirstSearchTest(): SearchTest {
    return {
      id: 'first-search',
      name: 'First Search',
      description: 'Execute first search and verify results appear',
      wave: 1,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'first-search',
            testName: 'First Search',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Execute search
        const query = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, query);

        // Check if results page loaded
        const currentUrl = page.url();
        evidence.push({
          type: 'element',
          description: 'Results page URL',
          value: currentUrl
        });

        // Count results
        const resultCount = await this.countSearchResults(page);
        evidence.push({
          type: 'element',
          description: 'Result count',
          value: resultCount
        });

        if (resultCount === 0) {
          findings.push('No search results found');
          score = 0;
        } else if (resultCount < 10) {
          findings.push(`Only ${resultCount} results found (expected 10+)`);
          score = 6;
        }

        // Take screenshot
        const screenshot = await this.captureScreenshot(
          page,
          'first-search',
          1,
          `Search results for "${query}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'first-search',
          testName: 'First Search',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createResultsCountTest(): SearchTest {
    return {
      id: 'results-count',
      name: 'Results Count Display',
      description: 'Verify result count is displayed to user',
      wave: 1,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'results-count',
            testName: 'Results Count Display',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        const query = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, query);

        // Look for results count display
        const countPatterns = [
          /\d+\s+(results?|items?|products?)/i,
          /showing\s+\d+/i,
          /found\s+\d+/i
        ];

        const pageText = await page.textContent('body');
        let countDisplayFound = false;

        for (const pattern of countPatterns) {
          if (pageText && pattern.test(pageText)) {
            countDisplayFound = true;
            const match = pageText.match(pattern);
            evidence.push({
              type: 'element',
              description: 'Results count display',
              value: match ? match[0] : 'found'
            });
            break;
          }
        }

        if (!countDisplayFound) {
          findings.push('No results count display found (poor UX)');
          score = 5;
        }

        // Take screenshot
        const screenshot = await this.captureScreenshot(
          page,
          'results-count',
          1,
          'Results count display',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'results-count',
          testName: 'Results Count Display',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  // ============================================================================
  // WAVE 2: CORE SEARCH QUALITY (5 tests)
  // ============================================================================

  private createRelevanceTest(): SearchTest {
    return {
      id: 'relevance',
      name: 'Search Relevance',
      description: 'Test if product name search returns exact match first',
      wave: 2,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'relevance',
            testName: 'Search Relevance',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        const query = context.testQueries?.brand || 'macbook';
        await this.executeSearch(page, searchSelector, query);

        // Get first 3 results
        const firstResults = await this.getFirstNResults(page, 3);
        evidence.push({
          type: 'element',
          description: 'First 3 results',
          value: firstResults
        });

        // Check if query terms appear in first result
        const firstResult = firstResults[0]?.toLowerCase() || '';
        const queryLower = query.toLowerCase();

        if (!firstResult.includes(queryLower)) {
          findings.push(`First result doesn't contain query term "${query}"`);
          score = 4;
        }

        // Check if query terms appear in top 3
        const relevantInTop3 = firstResults.filter(r =>
          r.toLowerCase().includes(queryLower)
        ).length;

        evidence.push({
          type: 'element',
          description: 'Relevant results in top 3',
          value: `${relevantInTop3}/3`
        });

        if (relevantInTop3 === 0) {
          findings.push('No relevant results in top 3');
          score = 0;
        } else if (relevantInTop3 < 3) {
          findings.push(`Only ${relevantInTop3}/3 top results are relevant`);
          score = Math.min(score, 7);
        }

        // Take screenshot
        const screenshot = await this.captureScreenshot(
          page,
          'relevance',
          1,
          `Relevance test for "${query}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'relevance',
          testName: 'Search Relevance',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createTypoHandlingTest(): SearchTest {
    return {
      id: 'typo-handling',
      name: 'Typo Tolerance',
      description: 'Test if common typos return correct results',
      wave: 2,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'typo-handling',
            testName: 'Typo Tolerance',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Test with typo
        const typoQuery = context.testQueries?.typo || 'labtop'; // "laptop" typo
        await this.executeSearch(page, searchSelector, typoQuery);

        const typoResultCount = await this.countSearchResults(page);
        evidence.push({
          type: 'element',
          description: `Results for typo "${typoQuery}"`,
          value: typoResultCount
        });

        // Take screenshot of typo results
        const screenshot1 = await this.captureScreenshot(
          page,
          'typo-handling',
          1,
          `Typo search: "${typoQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot1);

        // Test with correct spelling
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });
        const correctQuery = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, correctQuery);

        const correctResultCount = await this.countSearchResults(page);
        evidence.push({
          type: 'element',
          description: `Results for correct "${correctQuery}"`,
          value: correctResultCount
        });

        // Take screenshot of correct results
        const screenshot2 = await this.captureScreenshot(
          page,
          'typo-handling',
          2,
          `Correct search: "${correctQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot2);

        // Compare results
        if (typoResultCount === 0 && correctResultCount > 0) {
          findings.push('Typo returns zero results (no typo tolerance)');
          score = 0;
        } else if (typoResultCount > 0 && Math.abs(typoResultCount - correctResultCount) > correctResultCount * 0.5) {
          findings.push(`Typo results (${typoResultCount}) very different from correct (${correctResultCount})`);
          score = 5;
        } else if (typoResultCount > 0) {
          evidence.push({
            type: 'element',
            description: 'Typo tolerance working',
            value: true
          });
        }

        return {
          testId: 'typo-handling',
          testName: 'Typo Tolerance',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createSynonymDetectionTest(): SearchTest {
    return {
      id: 'synonym-detection',
      name: 'Synonym Detection',
      description: 'Test if synonyms return similar results',
      wave: 2,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'synonym-detection',
            testName: 'Synonym Detection',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Test with original query
        const originalQuery = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, originalQuery);
        const originalCount = await this.countSearchResults(page);

        evidence.push({
          type: 'element',
          description: `Results for "${originalQuery}"`,
          value: originalCount
        });

        const screenshot1 = await this.captureScreenshot(
          page,
          'synonym-detection',
          1,
          `Original: "${originalQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot1);

        // Test with synonym
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });
        const synonymQuery = context.testQueries?.synonym || 'notebook';
        await this.executeSearch(page, searchSelector, synonymQuery);
        const synonymCount = await this.countSearchResults(page);

        evidence.push({
          type: 'element',
          description: `Results for synonym "${synonymQuery}"`,
          value: synonymCount
        });

        const screenshot2 = await this.captureScreenshot(
          page,
          'synonym-detection',
          2,
          `Synonym: "${synonymQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot2);

        // Compare results
        if (originalCount > 0 && synonymCount === 0) {
          findings.push('Synonym returns zero results (no synonym detection)');
          score = 0;
        } else if (originalCount > 0 && Math.abs(originalCount - synonymCount) > originalCount * 0.7) {
          findings.push(`Synonym results (${synonymCount}) very different from original (${originalCount})`);
          score = 4;
        } else if (synonymCount > 0) {
          evidence.push({
            type: 'element',
            description: 'Synonym detection working',
            value: true
          });
        }

        return {
          testId: 'synonym-detection',
          testName: 'Synonym Detection',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createStopWordsTest(): SearchTest {
    return {
      id: 'stop-words',
      name: 'Stop Words Handling',
      description: 'Test if stop words are handled correctly',
      wave: 2,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'stop-words',
            testName: 'Stop Words Handling',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Test with stop words
        const queryWithStopWords = 'the best laptop';
        await this.executeSearch(page, searchSelector, queryWithStopWords);
        const countWithStopWords = await this.countSearchResults(page);

        evidence.push({
          type: 'element',
          description: `Results for "${queryWithStopWords}"`,
          value: countWithStopWords
        });

        const screenshot1 = await this.captureScreenshot(
          page,
          'stop-words',
          1,
          `With stop words: "${queryWithStopWords}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot1);

        // Test without stop words
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });
        const queryWithoutStopWords = 'laptop';
        await this.executeSearch(page, searchSelector, queryWithoutStopWords);
        const countWithoutStopWords = await this.countSearchResults(page);

        evidence.push({
          type: 'element',
          description: `Results for "${queryWithoutStopWords}"`,
          value: countWithoutStopWords
        });

        const screenshot2 = await this.captureScreenshot(
          page,
          'stop-words',
          2,
          `Without stop words: "${queryWithoutStopWords}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot2);

        // Compare - stop words should not significantly affect results
        if (countWithStopWords === 0 && countWithoutStopWords > 0) {
          findings.push('Stop words cause zero results (poor handling)');
          score = 3;
        } else if (Math.abs(countWithStopWords - countWithoutStopWords) > countWithoutStopWords * 0.3) {
          findings.push('Stop words significantly affect result count');
          score = 6;
        } else {
          evidence.push({
            type: 'element',
            description: 'Stop words handled correctly',
            value: true
          });
        }

        return {
          testId: 'stop-words',
          testName: 'Stop Words Handling',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createSpecialCharactersTest(): SearchTest {
    return {
      id: 'special-characters',
      name: 'Special Characters',
      description: 'Test searches with special characters (&, %, @, etc.)',
      wave: 2,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'special-characters',
            testName: 'Special Characters',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Test with special characters
        const specialQuery = 'laptop & accessories';
        await this.executeSearch(page, searchSelector, specialQuery);

        // Check if page crashed or errored
        const pageText = await page.textContent('body');
        if (pageText?.toLowerCase().includes('error') || pageText?.toLowerCase().includes('invalid')) {
          findings.push('Special characters cause error page');
          score = 0;
        }

        const resultCount = await this.countSearchResults(page);
        evidence.push({
          type: 'element',
          description: `Results for "${specialQuery}"`,
          value: resultCount
        });

        if (resultCount === 0) {
          findings.push('Special characters return zero results');
          score = Math.min(score, 5);
        }

        const screenshot = await this.captureScreenshot(
          page,
          'special-characters',
          1,
          `Special characters: "${specialQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'special-characters',
          testName: 'Special Characters',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  // ============================================================================
  // WAVE 3: ADVANCED FEATURES (5 tests)
  // ============================================================================

  private createNLPQueryTest(): SearchTest {
    return {
      id: 'nlp-query',
      name: 'Natural Language Query',
      description: 'Test natural language understanding',
      wave: 3,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'nlp-query',
            testName: 'Natural Language Query',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Test with NLP query
        const nlpQuery = context.testQueries?.nlp || 'best laptop for gaming under 1000';
        await this.executeSearch(page, searchSelector, nlpQuery);

        const resultCount = await this.countSearchResults(page);
        evidence.push({
          type: 'element',
          description: `Results for NLP query "${nlpQuery}"`,
          value: resultCount
        });

        // Check if results exist
        if (resultCount === 0) {
          findings.push('NLP query returns zero results (no NLP understanding)');
          score = 0;
        } else {
          // Check if results are relevant (contain "gaming" or "laptop")
          const firstResults = await this.getFirstNResults(page, 5);
          const relevantCount = firstResults.filter(r =>
            r.toLowerCase().includes('gaming') ||
            r.toLowerCase().includes('laptop') ||
            r.toLowerCase().includes('computer')
          ).length;

          evidence.push({
            type: 'element',
            description: 'Relevant results in top 5',
            value: `${relevantCount}/5`
          });

          if (relevantCount === 0) {
            findings.push('No relevant results for NLP query (poor understanding)');
            score = 2;
          } else if (relevantCount < 3) {
            findings.push('Few relevant results for NLP query (limited understanding)');
            score = 5;
          } else {
            evidence.push({
              type: 'element',
              description: 'NLP understanding working',
              value: true
            });
          }
        }

        const screenshot = await this.captureScreenshot(
          page,
          'nlp-query',
          1,
          `NLP query: "${nlpQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'nlp-query',
          testName: 'Natural Language Query',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createFederatedSearchTest(): SearchTest {
    return {
      id: 'federated-search',
      name: 'Federated Search',
      description: 'Test if help/blog content appears in results',
      wave: 3,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'federated-search',
            testName: 'Federated Search',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Test with informational query
        const infoQuery = 'return policy';
        await this.executeSearch(page, searchSelector, infoQuery);

        const pageText = await page.textContent('body');

        // Look for federated content indicators
        const federatedIndicators = [
          /help\s+(articles?|center)/i,
          /support/i,
          /blog/i,
          /article/i,
          /guide/i,
          /faq/i
        ];

        let federatedContentFound = false;
        for (const indicator of federatedIndicators) {
          if (pageText && indicator.test(pageText)) {
            federatedContentFound = true;
            evidence.push({
              type: 'element',
              description: 'Federated content type found',
              value: indicator.toString()
            });
            break;
          }
        }

        if (!federatedContentFound) {
          findings.push('No federated content found (help, blog, support)');
          score = 3;
        }

        const screenshot = await this.captureScreenshot(
          page,
          'federated-search',
          1,
          `Federated search: "${infoQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'federated-search',
          testName: 'Federated Search',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createFacetsTest(): SearchTest {
    return {
      id: 'facets',
      name: 'Faceted Search',
      description: 'Test facet filtering and counts',
      wave: 3,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'facets',
            testName: 'Faceted Search',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        const query = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, query);

        // Look for facets/filters
        const facetSelectors = [
          '[data-testid="filters"]',
          '.filters',
          '.facets',
          '[role="group"]',
          '.sidebar-filters',
          '.refinement-bar'
        ];

        let facetsFound = false;
        let facetCount = 0;

        for (const selector of facetSelectors) {
          const elements = await page.locator(selector).count();
          if (elements > 0) {
            facetsFound = true;
            facetCount = elements;
            break;
          }
        }

        if (!facetsFound) {
          findings.push('No facets/filters found');
          score = 0;
        } else {
          evidence.push({
            type: 'element',
            description: 'Facet groups found',
            value: facetCount
          });

          // Check if facets have counts
          const pageText = await page.textContent('body');
          const hasCountPattern = /\(\d+\)/;

          if (pageText && !hasCountPattern.test(pageText)) {
            findings.push('Facets found but no counts displayed');
            score = 6;
          }
        }

        const screenshot = await this.captureScreenshot(
          page,
          'facets',
          1,
          `Faceted search for "${query}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'facets',
          testName: 'Faceted Search',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createSortOptionsTest(): SearchTest {
    return {
      id: 'sort-options',
      name: 'Sort Options',
      description: 'Test sort by price, rating, popularity',
      wave: 3,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'sort-options',
            testName: 'Sort Options',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        const query = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, query);

        // Look for sort dropdown
        const sortSelectors = [
          'select[name*="sort" i]',
          '[data-testid*="sort" i]',
          '.sort-by',
          '#sort',
          '[aria-label*="sort" i]'
        ];

        let sortFound = false;
        let sortOptions: string[] = [];

        for (const selector of sortSelectors) {
          const elements = await page.locator(selector).count();
          if (elements > 0) {
            sortFound = true;

            // Try to get options
            try {
              const options = await page.locator(`${selector} option`).allTextContents();
              sortOptions = options;
            } catch {
              // Not a select element
            }
            break;
          }
        }

        if (!sortFound) {
          findings.push('No sort options found');
          score = 5;
        } else {
          evidence.push({
            type: 'element',
            description: 'Sort options',
            value: sortOptions.length > 0 ? sortOptions : 'found'
          });

          // Check for common sort options
          const commonSorts = ['price', 'rating', 'popularity', 'relevance'];
          const pageText = await page.textContent('body');
          const foundSorts = commonSorts.filter(sort =>
            pageText?.toLowerCase().includes(sort)
          );

          if (foundSorts.length === 0) {
            findings.push('Limited sort options');
            score = 7;
          }
        }

        const screenshot = await this.captureScreenshot(
          page,
          'sort-options',
          1,
          `Sort options for "${query}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'sort-options',
          testName: 'Sort Options',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createEmptyStateTest(): SearchTest {
    return {
      id: 'empty-state',
      name: 'Empty State Handling',
      description: 'Test zero-results handling',
      wave: 3,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'empty-state',
            testName: 'Empty State Handling',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Search for nonsense query
        const emptyQuery = 'xyzabc123notfound';
        await this.executeSearch(page, searchSelector, emptyQuery);

        const resultCount = await this.countSearchResults(page);

        if (resultCount > 0) {
          // Not an empty state, skip test
          findings.push('Query returned results (not testing empty state)');
          return {
            testId: 'empty-state',
            testName: 'Empty State Handling',
            status: 'warning',
            score: 5,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Check for helpful empty state messaging
        const pageText = await page.textContent('body');

        const helpfulPatterns = [
          /no results? found/i,
          /didn't match any/i,
          /try a different search/i,
          /suggestions?:/i,
          /did you mean/i
        ];

        let helpfulMessageFound = false;
        for (const pattern of helpfulPatterns) {
          if (pageText && pattern.test(pageText)) {
            helpfulMessageFound = true;
            evidence.push({
              type: 'element',
              description: 'Helpful empty state message',
              value: true
            });
            break;
          }
        }

        if (!helpfulMessageFound) {
          findings.push('No helpful message on empty results page');
          score = 3;
        }

        const screenshot = await this.captureScreenshot(
          page,
          'empty-state',
          1,
          `Empty state for "${emptyQuery}"`,
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'empty-state',
          testName: 'Empty State Handling',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  // ============================================================================
  // WAVE 4: INTELLIGENCE & MOBILE (5 tests)
  // ============================================================================

  private createMobileResponsivenessTest(): SearchTest {
    return {
      id: 'mobile-responsiveness',
      name: 'Mobile Search',
      description: 'Test search on mobile viewport',
      wave: 4,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found on mobile');
          score = 0;
        } else {
          // Check if search box is visible on mobile
          const isVisible = await page.locator(searchSelector).isVisible();
          if (!isVisible) {
            findings.push('Search box not visible on mobile viewport');
            score = 3;
          }

          // Try to execute search
          const query = context.testQueries?.basic || 'laptop';
          await this.executeSearch(page, searchSelector, query);

          const resultCount = await this.countSearchResults(page);
          evidence.push({
            type: 'element',
            description: 'Mobile search results',
            value: resultCount
          });

          if (resultCount === 0) {
            findings.push('No results on mobile (possible responsive issue)');
            score = Math.min(score, 5);
          }
        }

        const screenshot = await this.captureScreenshot(
          page,
          'mobile-responsiveness',
          1,
          'Mobile search view',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        // Reset viewport
        await page.setViewportSize({ width: 1920, height: 1080 });

        return {
          testId: 'mobile-responsiveness',
          testName: 'Mobile Search',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createPersonalizationTest(): SearchTest {
    return {
      id: 'personalization',
      name: 'Personalization',
      description: 'Test if results change based on behavior',
      wave: 4,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 5; // Neutral score (hard to test)

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        // Look for personalization indicators
        const pageText = await page.textContent('body');

        const personalizationIndicators = [
          /recommended for you/i,
          /based on your/i,
          /you might like/i,
          /recently viewed/i,
          /popular with you/i
        ];

        let personalizationFound = false;
        for (const indicator of personalizationIndicators) {
          if (pageText && indicator.test(pageText)) {
            personalizationFound = true;
            evidence.push({
              type: 'element',
              description: 'Personalization indicator found',
              value: indicator.toString()
            });
            score = 8;
            break;
          }
        }

        if (!personalizationFound) {
          findings.push('No obvious personalization features detected');
        }

        const screenshot = await this.captureScreenshot(
          page,
          'personalization',
          1,
          'Personalization check',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'personalization',
          testName: 'Personalization',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createRecommendationsTest(): SearchTest {
    return {
      id: 'recommendations',
      name: 'Recommendations',
      description: 'Test if product page shows recommendations',
      wave: 4,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 10;

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'recommendations',
            testName: 'Recommendations',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        // Search and click first result
        const query = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, query);

        // Try to click first product
        const productSelectors = [
          '.product-item a',
          '[data-testid="product-link"]',
          '.search-result a',
          'a[href*="/product"]',
          'a[href*="/item"]'
        ];

        let clickedProduct = false;
        for (const selector of productSelectors) {
          try {
            const firstProduct = page.locator(selector).first();
            const count = await firstProduct.count();
            if (count > 0) {
              await firstProduct.click();
              await page.waitForLoadState('networkidle', { timeout: 10000 });
              clickedProduct = true;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!clickedProduct) {
          findings.push('Could not navigate to product page');
          score = 5;
        } else {
          // Look for recommendations
          const pageText = await page.textContent('body');

          const recommendationIndicators = [
            /you may also like/i,
            /similar products/i,
            /customers also bought/i,
            /recommended/i,
            /frequently bought together/i
          ];

          let recommendationsFound = false;
          for (const indicator of recommendationIndicators) {
            if (pageText && indicator.test(pageText)) {
              recommendationsFound = true;
              evidence.push({
                type: 'element',
                description: 'Recommendations section found',
                value: indicator.toString()
              });
              break;
            }
          }

          if (!recommendationsFound) {
            findings.push('No product recommendations found');
            score = 3;
          }
        }

        const screenshot = await this.captureScreenshot(
          page,
          'recommendations',
          1,
          'Product page recommendations',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'recommendations',
          testName: 'Recommendations',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createSearchAnalyticsTest(): SearchTest {
    return {
      id: 'search-analytics',
      name: 'Search Analytics',
      description: 'Test if search events are tracked',
      wave: 4,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 5; // Neutral score

        // Monitor network requests
        const analyticsRequests: string[] = [];

        page.on('request', (request) => {
          const url = request.url();
          if (
            url.includes('analytics') ||
            url.includes('tracking') ||
            url.includes('events') ||
            url.includes('ga') || // Google Analytics
            url.includes('segment') ||
            url.includes('amplitude')
          ) {
            analyticsRequests.push(url);
          }
        });

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (!searchSelector) {
          findings.push('Search box not found');
          return {
            testId: 'search-analytics',
            testName: 'Search Analytics',
            status: 'failed',
            score: 0,
            duration: 0,
            screenshots,
            findings,
            evidence
          };
        }

        const query = context.testQueries?.basic || 'laptop';
        await this.executeSearch(page, searchSelector, query);

        // Wait a moment for analytics to fire
        await page.waitForTimeout(2000);

        if (analyticsRequests.length > 0) {
          evidence.push({
            type: 'network',
            description: 'Analytics requests detected',
            value: analyticsRequests.length
          });
          score = 8;
        } else {
          findings.push('No analytics tracking detected');
          score = 3;
        }

        const screenshot = await this.captureScreenshot(
          page,
          'search-analytics',
          1,
          'Search analytics check',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'search-analytics',
          testName: 'Search Analytics',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  private createAlgoliaDetectionTest(): SearchTest {
    return {
      id: 'algolia-detection',
      name: 'Algolia Detection',
      description: 'Test if Algolia is in use',
      wave: 4,
      execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
        const findings: string[] = [];
        const evidence: Evidence[] = [];
        const screenshots: Screenshot[] = [];
        let score = 0; // Assume not using Algolia

        // Monitor network requests
        const algoliaRequests: string[] = [];

        page.on('request', (request) => {
          const url = request.url();
          if (url.includes('algolia')) {
            algoliaRequests.push(url);
          }
        });

        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

        const searchSelector = await this.findSearchInput(page);
        if (searchSelector) {
          const query = context.testQueries?.basic || 'laptop';
          await this.executeSearch(page, searchSelector, query);
          await page.waitForTimeout(2000);
        }

        // Check for Algolia in network requests
        if (algoliaRequests.length > 0) {
          evidence.push({
            type: 'network',
            description: 'Algolia API calls detected',
            value: algoliaRequests.length
          });
          score = 10;
        }

        // Check for Algolia in page source
        const pageContent = await page.content();
        if (pageContent.includes('algolia') || pageContent.includes('instantsearch')) {
          evidence.push({
            type: 'element',
            description: 'Algolia found in page source',
            value: true
          });
          score = 10;
        }

        if (score === 0) {
          findings.push('Algolia not detected (opportunity for displacement)');
        }

        const screenshot = await this.captureScreenshot(
          page,
          'algolia-detection',
          1,
          'Algolia detection check',
          context.screenshotDir
        );
        screenshots.push(screenshot);

        return {
          testId: 'algolia-detection',
          testName: 'Algolia Detection',
          status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
          score,
          duration: 0,
          screenshots,
          findings,
          evidence
        };
      }
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Find search input using common selectors
   */
  private async findSearchInput(page: Page): Promise<string | null> {
    const searchSelectors = [
      'input[type="search"]',
      'input[name="q"]',
      'input[name="search"]',
      'input[placeholder*="Search" i]',
      'input[placeholder*="search" i]',
      '[data-testid="search-input"]',
      '.search-input',
      '#search',
      '#search-input',
      'input[aria-label*="search" i]'
    ];

    for (const selector of searchSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          return selector;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Execute a search query
   */
  private async executeSearch(page: Page, searchSelector: string, query: string) {
    await page.locator(searchSelector).click();
    await page.locator(searchSelector).fill('');
    await this.humanTypeText(page, searchSelector, query);
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);
  }

  /**
   * Human-like typing
   */
  private async humanTypeText(page: Page, selector: string, text: string) {
    for (const char of text) {
      await page.locator(selector).pressSequentially(char);
      const delay = 50 + Math.random() * 100;
      await page.waitForTimeout(delay);
    }
  }

  /**
   * Count search results
   */
  private async countSearchResults(page: Page): Promise<number> {
    const resultSelectors = [
      '.search-result',
      '.product-item',
      '[data-testid="result"]',
      '[data-testid="product"]',
      '.product',
      '.result',
      'article[data-product]',
      '[data-testid="product-card"]'
    ];

    for (const selector of resultSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          return count;
        }
      } catch {
        continue;
      }
    }

    return 0;
  }

  /**
   * Get first N results text
   */
  private async getFirstNResults(page: Page, n: number): Promise<string[]> {
    const resultSelectors = [
      '.search-result',
      '.product-item',
      '[data-testid="result"]',
      '[data-testid="product"]',
      '.product',
      '.result'
    ];

    for (const selector of resultSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          const results: string[] = [];
          const max = Math.min(n, count);

          for (let i = 0; i < max; i++) {
            const text = await page.locator(selector).nth(i).textContent();
            if (text) {
              results.push(text.trim());
            }
          }

          return results;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(
    page: Page,
    testId: string,
    sequenceNumber: number,
    caption: string,
    screenshotDir: string
  ): Promise<Screenshot> {
    // Ensure screenshot directory exists
    if (!existsSync(screenshotDir)) {
      await mkdir(screenshotDir, { recursive: true });
    }

    const filename = `${testId}-${sequenceNumber}.png`;
    const filePath = path.join(screenshotDir, filename);

    await page.screenshot({ path: filePath, fullPage: true });

    return {
      sequenceNumber,
      caption,
      filePath,
      annotations: []
    };
  }

  /**
   * Delay helper
   */
  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
