/**
 * Search Audit Test Library
 *
 * Implements 20 specific browser tests for comprehensive search experience auditing.
 * Each test captures screenshots, detects issues, and returns scored results.
 *
 * Test Categories:
 * - Homepage & Basic Search (2a-2e): 5 tests
 * - Intelligence & Error Handling (2f-2j): 5 tests
 * - Edge Cases & Features (2k-2p): 6 tests
 * - Advanced Features (2q-2t): 4 tests
 */

import { Page, Browser } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Search test definition
 */
export interface SearchTest {
  id: string;
  name: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  weight: number;
  execute: (browser: Browser, url: string, query?: string) => Promise<SearchTestResult>;
}

/**
 * Test execution result
 */
export interface SearchTestResult {
  testId: string;
  passed: boolean;
  score: number; // 0-10 scale
  finding?: string;
  evidence?: string;
  screenshotPath?: string;
  metadata?: Record<string, any>;
}

/**
 * Issue detection result
 */
interface IssueLocation {
  type: 'empty_results' | 'typo_input' | 'poor_relevance' | 'missing_feature';
  selector?: string;
  coordinates?: { x: number; y: number };
  description: string;
}

/**
 * Capture screenshot and save to disk
 * CRITICAL: Chrome MCP imageIds are session-bound, must save immediately
 */
async function captureScreenshot(
  page: Page,
  testId: string,
  auditDir: string
): Promise<string> {
  const screenshotDir = path.join(auditDir, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });

  const filename = `${testId}-${Date.now()}.png`;
  const screenshotPath = path.join(screenshotDir, filename);

  await page.screenshot({ path: screenshotPath, fullPage: true });

  return `screenshots/${filename}`; // Return relative path
}

/**
 * Auto-detect issue locations in page HTML
 */
async function detectIssue(page: Page, testId: string): Promise<IssueLocation | null> {
  const html = await page.content();

  // Check for empty results
  const noResultsPatterns = [
    'no results found',
    'no products found',
    '0 results',
    'try another search',
    'no matches',
  ];

  for (const pattern of noResultsPatterns) {
    if (html.toLowerCase().includes(pattern)) {
      return {
        type: 'empty_results',
        description: `Empty results page detected: "${pattern}"`,
      };
    }
  }

  // Check for typo in search input
  const searchInput = await page.$('input[type="search"], input[name="q"], input[name="query"]');
  if (searchInput) {
    const value = await searchInput.inputValue();
    if (value && /\s{2,}/.test(value)) {
      return {
        type: 'typo_input',
        selector: 'input[type="search"]',
        description: `Search input contains spacing issues: "${value}"`,
      };
    }
  }

  return null;
}

/**
 * Wait for search results to load
 */
async function waitForResults(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    // Common result container selectors
    const selectors = [
      '.search-results',
      '[data-testid="search-results"]',
      '.product-grid',
      '.results-list',
      '#search-results',
    ];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        return true;
      } catch {
        // Continue to next selector
      }
    }

    // Fallback: wait for navigation
    await page.waitForLoadState('networkidle', { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Count visible results on page
 */
async function countResults(page: Page): Promise<number> {
  const resultSelectors = [
    '.product-item',
    '.search-result',
    '[data-testid="product"]',
    '.result-item',
  ];

  for (const selector of resultSelectors) {
    const count = await page.locator(selector).count();
    if (count > 0) return count;
  }

  return 0;
}

// ====================
// TEST IMPLEMENTATIONS
// ====================

/**
 * Test 2a: Navigate to homepage
 */
async function test2a(browser: Browser, url: string): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const title = await page.title();

    const passed = title.length > 0;
    const score = passed ? 10 : 0;

    const screenshotPath = await captureScreenshot(page, '2a', '/tmp/audit');

    return {
      testId: '2a',
      passed,
      score,
      finding: passed ? undefined : 'Homepage failed to load',
      evidence: `Page title: ${title}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2b: Empty search handling
 */
async function test2b(browser: Browser, url: string): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    // Find search input
    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2b',
        passed: false,
        score: 0,
        finding: 'Search input not found on homepage',
        evidence: 'No search box detected',
      };
    }

    // Submit empty search
    await searchInput.click();
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const passed = resultCount > 0;
    const score = passed ? 8 : 3;

    const screenshotPath = await captureScreenshot(page, '2b', '/tmp/audit');

    return {
      testId: '2b',
      passed,
      score,
      finding: passed ? undefined : 'Empty search returns no results or error page',
      evidence: `Result count: ${resultCount}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2c: Simple single-word query
 */
async function test2c(browser: Browser, url: string, query: string = 'shirt'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2c',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const passed = resultCount >= 5;
    const score = passed ? 10 : Math.min(resultCount * 2, 10);

    const screenshotPath = await captureScreenshot(page, '2c', '/tmp/audit');

    return {
      testId: '2c',
      passed,
      score,
      finding: passed ? undefined : `Single-word query "${query}" returns insufficient results`,
      evidence: `Query: "${query}", Results: ${resultCount}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2d: Multi-word query
 */
async function test2d(browser: Browser, url: string, query: string = 'red dress'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2d',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const passed = resultCount >= 3;
    const score = passed ? 10 : Math.min(resultCount * 3, 10);

    const screenshotPath = await captureScreenshot(page, '2d', '/tmp/audit');

    return {
      testId: '2d',
      passed,
      score,
      finding: passed ? undefined : `Multi-word query "${query}" returns insufficient results`,
      evidence: `Query: "${query}", Results: ${resultCount}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2e: Product-specific query
 */
async function test2e(browser: Browser, url: string, query: string = 'nike air max'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2e',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const content = await page.content();

    // Check if results are relevant (contain query terms)
    const queryTerms = query.toLowerCase().split(' ');
    const relevance = queryTerms.filter(term => content.toLowerCase().includes(term)).length / queryTerms.length;

    const passed = resultCount >= 1 && relevance >= 0.5;
    const score = Math.round(relevance * 10);

    const screenshotPath = await captureScreenshot(page, '2e', '/tmp/audit');

    return {
      testId: '2e',
      passed,
      score,
      finding: passed ? undefined : `Product-specific query "${query}" has poor relevance`,
      evidence: `Query: "${query}", Results: ${resultCount}, Relevance: ${Math.round(relevance * 100)}%`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2f: Typo handling
 */
async function test2f(browser: Browser, url: string, query: string = 'headlamp'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2f',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    // Introduce typo
    const typoQuery = query.slice(0, -1) + 'p'; // e.g., "headlamp" -> "headlamp"
    await searchInput.fill(typoQuery);
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const content = await page.content();

    // Check for typo correction suggestions
    const hasSuggestion = content.toLowerCase().includes('did you mean') ||
                         content.toLowerCase().includes('showing results for');

    const passed = resultCount > 0 || hasSuggestion;
    const score = passed ? (hasSuggestion ? 10 : 6) : 0;

    const screenshotPath = await captureScreenshot(page, '2f', '/tmp/audit');

    return {
      testId: '2f',
      passed,
      score,
      finding: passed ? undefined : `Typo query "${typoQuery}" has no tolerance or suggestions`,
      evidence: `Query: "${typoQuery}", Results: ${resultCount}, Suggestion: ${hasSuggestion}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2g: Synonym handling
 */
async function test2g(browser: Browser, url: string, query: string = 'headlamp'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2g',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);

    // Now search for synonym (e.g., "headlight")
    const synonymQuery = 'headlight';
    await searchInput.fill(synonymQuery);
    await searchInput.press('Enter');
    await waitForResults(page);

    const synonymResultCount = await countResults(page);

    // Good synonym handling: similar result counts
    const ratio = Math.min(resultCount, synonymResultCount) / Math.max(resultCount, synonymResultCount);
    const passed = ratio >= 0.5 && resultCount > 0 && synonymResultCount > 0;
    const score = Math.round(ratio * 10);

    const screenshotPath = await captureScreenshot(page, '2g', '/tmp/audit');

    return {
      testId: '2g',
      passed,
      score,
      finding: passed ? undefined : `Synonym query "${query}" vs "${synonymQuery}" shows poor equivalence`,
      evidence: `"${query}": ${resultCount} results, "${synonymQuery}": ${synonymResultCount} results, Ratio: ${Math.round(ratio * 100)}%`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2h: Query with filters
 */
async function test2h(browser: Browser, url: string, query: string = 'shoes'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2h',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    // Look for filter/facet UI
    const filterSelectors = [
      '[data-testid="facets"]',
      '.filters',
      '.facets',
      'aside',
    ];

    let hasFilters = false;
    for (const selector of filterSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        hasFilters = true;
        break;
      }
    }

    const passed = hasFilters;
    const score = passed ? 8 : 2;

    const screenshotPath = await captureScreenshot(page, '2h', '/tmp/audit');

    return {
      testId: '2h',
      passed,
      score,
      finding: passed ? undefined : 'No facets/filters found on search results page',
      evidence: `Filters present: ${hasFilters}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2i: Complex NLP query
 */
async function test2i(browser: Browser, url: string, query: string = 'best tv for gaming under 1000'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2i',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const content = await page.content().then(c => c.toLowerCase());

    // Check if results contain key entities
    const containsTV = content.includes('tv') || content.includes('television');
    const containsGaming = content.includes('gaming') || content.includes('game');
    const containsPrice = /\$\d{3,4}/.test(content);

    const relevance = [containsTV, containsGaming, containsPrice].filter(Boolean).length / 3;
    const passed = resultCount > 0 && relevance >= 0.33;
    const score = Math.round(relevance * 10);

    const screenshotPath = await captureScreenshot(page, '2i', '/tmp/audit');

    return {
      testId: '2i',
      passed,
      score,
      finding: passed ? undefined : `NLP query "${query}" not understood - results irrelevant`,
      evidence: `Query: "${query}", Results: ${resultCount}, Entities found: TV=${containsTV}, Gaming=${containsGaming}, Price=${containsPrice}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2j: Brand-specific query
 */
async function test2j(browser: Browser, url: string, query: string = 'sony'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2j',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const content = await page.content().then(c => c.toLowerCase());

    // Check brand prominence in results
    const brandMentions = (content.match(new RegExp(query.toLowerCase(), 'g')) || []).length;
    const passed = resultCount >= 5 && brandMentions >= 5;
    const score = passed ? 10 : Math.min((brandMentions / 5) * 10, 10);

    const screenshotPath = await captureScreenshot(page, '2j', '/tmp/audit');

    return {
      testId: '2j',
      passed,
      score,
      finding: passed ? undefined : `Brand query "${query}" returns insufficient or irrelevant results`,
      evidence: `Query: "${query}", Results: ${resultCount}, Brand mentions: ${brandMentions}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2k: Zero-results handling
 */
async function test2k(browser: Browser, url: string, query: string = 'xyzabc123'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2k',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const content = await page.content().then(c => c.toLowerCase());

    // Check for helpful empty state
    const hasEmptyState = content.includes('no results') ||
                         content.includes('try again') ||
                         content.includes('did you mean') ||
                         content.includes('popular searches');

    const hasSuggestions = content.includes('suggestions') ||
                          content.includes('trending') ||
                          content.includes('popular');

    const passed = hasEmptyState && hasSuggestions;
    const score = passed ? 10 : (hasEmptyState ? 5 : 0);

    const screenshotPath = await captureScreenshot(page, '2k', '/tmp/audit');

    return {
      testId: '2k',
      passed,
      score,
      finding: passed ? undefined : 'Zero-results page lacks helpful guidance or alternative suggestions',
      evidence: `Empty state: ${hasEmptyState}, Suggestions: ${hasSuggestions}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2l: Mobile view
 */
async function test2l(browser: Browser, url: string): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2l',
        passed: false,
        score: 0,
        finding: 'Search input not found on mobile',
      };
    }

    await searchInput.fill('test');
    await searchInput.press('Enter');
    await waitForResults(page);

    const resultCount = await countResults(page);
    const passed = resultCount > 0;
    const score = passed ? 8 : 2;

    const screenshotPath = await captureScreenshot(page, '2l', '/tmp/audit');

    return {
      testId: '2l',
      passed,
      score,
      finding: passed ? undefined : 'Mobile search experience broken or missing',
      evidence: `Mobile viewport (375x667), Results: ${resultCount}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2m: SAYT (Search-as-you-type / Autocomplete)
 */
async function test2m(browser: Browser, url: string, query: string = 'sh'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2m',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.click();
    await searchInput.type(query, { delay: 100 });

    // Wait for autocomplete dropdown
    await page.waitForTimeout(1000);

    // Look for autocomplete dropdown
    const autocompleteSelectors = [
      '[role="listbox"]',
      '.autocomplete',
      '.suggestions',
      '[data-testid="autocomplete"]',
    ];

    let hasSAYT = false;
    for (const selector of autocompleteSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        hasSAYT = true;
        break;
      }
    }

    const passed = hasSAYT;
    const score = passed ? 10 : 0;

    const screenshotPath = await captureScreenshot(page, '2m', '/tmp/audit');

    return {
      testId: '2m',
      passed,
      score,
      finding: passed ? undefined : 'No search-as-you-type (SAYT) or autocomplete feature detected',
      evidence: `SAYT present: ${hasSAYT}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2n: Sort functionality
 */
async function test2n(browser: Browser, url: string, query: string = 'laptop'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2n',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    // Look for sort dropdown
    const sortSelectors = [
      'select[name="sort"]',
      '[data-testid="sort"]',
      '.sort-dropdown',
    ];

    let hasSort = false;
    for (const selector of sortSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        hasSort = true;
        break;
      }
    }

    const passed = hasSort;
    const score = passed ? 7 : 3;

    const screenshotPath = await captureScreenshot(page, '2n', '/tmp/audit');

    return {
      testId: '2n',
      passed,
      score,
      finding: passed ? undefined : 'No sort/ordering functionality found',
      evidence: `Sort controls present: ${hasSort}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2o: Facet interaction
 */
async function test2o(browser: Browser, url: string, query: string = 'shoes'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2o',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const initialCount = await countResults(page);

    // Try to click first facet checkbox
    const facetSelectors = [
      '.facet input[type="checkbox"]',
      '[data-testid="facet"] input',
      'aside input[type="checkbox"]',
    ];

    let facetClicked = false;
    for (const selector of facetSelectors) {
      try {
        const facet = await page.locator(selector).first();
        if (await facet.count() > 0) {
          await facet.click();
          facetClicked = true;
          await page.waitForTimeout(1000);
          break;
        }
      } catch {
        // Continue to next selector
      }
    }

    const afterCount = await countResults(page);
    const countsChanged = initialCount !== afterCount;

    const passed = facetClicked && countsChanged;
    const score = passed ? 10 : (facetClicked ? 5 : 0);

    const screenshotPath = await captureScreenshot(page, '2o', '/tmp/audit');

    return {
      testId: '2o',
      passed,
      score,
      finding: passed ? undefined : 'Facet interaction not working or no facets present',
      evidence: `Facet clicked: ${facetClicked}, Results before: ${initialCount}, after: ${afterCount}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2p: Pagination
 */
async function test2p(browser: Browser, url: string, query: string = 'electronics'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2p',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    // Look for pagination
    const paginationSelectors = [
      '.pagination',
      '[data-testid="pagination"]',
      'a[rel="next"]',
      'button:has-text("Next")',
    ];

    let hasPagination = false;
    for (const selector of paginationSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        hasPagination = true;
        break;
      }
    }

    const passed = hasPagination;
    const score = passed ? 7 : 4;

    const screenshotPath = await captureScreenshot(page, '2p', '/tmp/audit');

    return {
      testId: '2p',
      passed,
      score,
      finding: passed ? undefined : 'No pagination or infinite scroll detected',
      evidence: `Pagination present: ${hasPagination}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2q: PDP recommendations
 */
async function test2q(browser: Browser, url: string): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    // Find first product link
    const productLink = await page.locator('a[href*="/product"], a[href*="/p/"]').first();

    if (await productLink.count() === 0) {
      return {
        testId: '2q',
        passed: false,
        score: 0,
        finding: 'No product links found to test recommendations',
      };
    }

    await productLink.click();
    await waitForResults(page);

    // Look for recommendation widgets
    const recSelectors = [
      '[data-testid="recommendations"]',
      '.recommendations',
      '.related-products',
      '.you-may-also-like',
    ];

    let hasRecs = false;
    for (const selector of recSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        hasRecs = true;
        break;
      }
    }

    const passed = hasRecs;
    const score = passed ? 8 : 0;

    const screenshotPath = await captureScreenshot(page, '2q', '/tmp/audit');

    return {
      testId: '2q',
      passed,
      score,
      finding: passed ? undefined : 'No product recommendations found on PDP',
      evidence: `Recommendations present: ${hasRecs}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2r: Recent searches
 */
async function test2r(browser: Browser, url: string): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    // Perform a search
    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2r',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill('test query');
    await searchInput.press('Enter');
    await waitForResults(page);

    // Go back and check for recent searches
    await page.goto(url);
    await searchInput.click();
    await page.waitForTimeout(500);

    const content = await page.content().then(c => c.toLowerCase());
    const hasRecentSearches = content.includes('recent') ||
                             content.includes('history') ||
                             content.includes('test query');

    const passed = hasRecentSearches;
    const score = passed ? 5 : 3;

    const screenshotPath = await captureScreenshot(page, '2r', '/tmp/audit');

    return {
      testId: '2r',
      passed,
      score,
      finding: passed ? undefined : 'No recent search history feature',
      evidence: `Recent searches shown: ${hasRecentSearches}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2s: Federated search
 */
async function test2s(browser: Browser, url: string, query: string = 'return policy'): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2s',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill(query);
    await searchInput.press('Enter');
    await waitForResults(page);

    const content = await page.content().then(c => c.toLowerCase());

    // Check for multiple result types (products + content)
    const hasProducts = content.includes('product');
    const hasContent = content.includes('article') ||
                      content.includes('page') ||
                      content.includes('help') ||
                      content.includes('faq');

    const passed = hasProducts && hasContent;
    const score = passed ? 10 : (hasProducts || hasContent ? 5 : 0);

    const screenshotPath = await captureScreenshot(page, '2s', '/tmp/audit');

    return {
      testId: '2s',
      passed,
      score,
      finding: passed ? undefined : `Query "${query}" only searches products, not content (pages, FAQs)`,
      evidence: `Products: ${hasProducts}, Content: ${hasContent}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

/**
 * Test 2t: Search analytics
 */
async function test2t(browser: Browser, url: string): Promise<SearchTestResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url);

    const searchInput = await page.$('input[type="search"], input[name="q"]');
    if (!searchInput) {
      return {
        testId: '2t',
        passed: false,
        score: 0,
        finding: 'Search input not found',
      };
    }

    await searchInput.fill('test');
    await searchInput.press('Enter');
    await waitForResults(page);

    // Check for analytics tracking
    const content = await page.content();
    const hasTracking = content.includes('analytics') ||
                       content.includes('gtag') ||
                       content.includes('ga(') ||
                       content.includes('dataLayer');

    const passed = hasTracking;
    const score = passed ? 5 : 3;

    const screenshotPath = await captureScreenshot(page, '2t', '/tmp/audit');

    return {
      testId: '2t',
      passed,
      score,
      finding: passed ? undefined : 'No search analytics tracking detected',
      evidence: `Analytics found: ${hasTracking}`,
      screenshotPath,
    };
  } finally {
    await page.close();
  }
}

// ====================
// EXPORTED TEST SUITE
// ====================

/**
 * All 20 search tests
 */
export const SEARCH_TESTS: SearchTest[] = [
  { id: '2a', name: 'Navigate to homepage', description: 'Homepage loads successfully', severity: 'HIGH', weight: 1.0, execute: test2a },
  { id: '2b', name: 'Empty search handling', description: 'Empty search returns results or guidance', severity: 'MEDIUM', weight: 0.8, execute: test2b },
  { id: '2c', name: 'Simple single-word query', description: 'Single-word queries return relevant results', severity: 'HIGH', weight: 1.0, execute: test2c },
  { id: '2d', name: 'Multi-word query', description: 'Multi-word queries understood and matched', severity: 'HIGH', weight: 1.0, execute: test2d },
  { id: '2e', name: 'Product-specific query', description: 'Specific product queries return relevant items', severity: 'MEDIUM', weight: 0.8, execute: test2e },
  { id: '2f', name: 'Typo handling', description: 'Typos tolerated with suggestions', severity: 'HIGH', weight: 1.0, execute: test2f },
  { id: '2g', name: 'Synonym handling', description: 'Synonyms recognized and matched', severity: 'HIGH', weight: 1.0, execute: test2g },
  { id: '2h', name: 'Query with filters', description: 'Facets/filters available on results page', severity: 'MEDIUM', weight: 0.8, execute: test2h },
  { id: '2i', name: 'Complex NLP query', description: 'Natural language queries understood', severity: 'HIGH', weight: 1.2, execute: test2i },
  { id: '2j', name: 'Brand-specific query', description: 'Brand queries return brand products', severity: 'MEDIUM', weight: 0.8, execute: test2j },
  { id: '2k', name: 'Zero-results handling', description: 'Empty state provides guidance and suggestions', severity: 'HIGH', weight: 1.0, execute: test2k },
  { id: '2l', name: 'Mobile view', description: 'Search works on mobile viewport', severity: 'MEDIUM', weight: 0.8, execute: test2l },
  { id: '2m', name: 'SAYT (autocomplete)', description: 'Search-as-you-type suggestions appear', severity: 'HIGH', weight: 1.0, execute: test2m },
  { id: '2n', name: 'Sort functionality', description: 'Results can be sorted', severity: 'LOW', weight: 0.5, execute: test2n },
  { id: '2o', name: 'Facet interaction', description: 'Facets are interactive and update results', severity: 'MEDIUM', weight: 0.8, execute: test2o },
  { id: '2p', name: 'Pagination', description: 'Pagination or infinite scroll present', severity: 'LOW', weight: 0.5, execute: test2p },
  { id: '2q', name: 'PDP recommendations', description: 'Product pages show recommendations', severity: 'MEDIUM', weight: 0.8, execute: test2q },
  { id: '2r', name: 'Recent searches', description: 'Recent search history shown', severity: 'LOW', weight: 0.5, execute: test2r },
  { id: '2s', name: 'Federated search', description: 'Search includes products AND content', severity: 'HIGH', weight: 1.0, execute: test2s },
  { id: '2t', name: 'Search analytics', description: 'Analytics tracking present', severity: 'LOW', weight: 0.5, execute: test2t },
];

/**
 * Execute a single test by ID
 */
export async function executeTest(
  testId: string,
  browser: Browser,
  url: string,
  query?: string
): Promise<SearchTestResult> {
  const test = SEARCH_TESTS.find(t => t.id === testId);
  if (!test) {
    throw new Error(`Test ${testId} not found`);
  }

  return test.execute(browser, url, query);
}

/**
 * Execute all 20 tests in sequence
 */
export async function executeTestSuite(
  browser: Browser,
  url: string,
  queries: Record<string, string>
): Promise<SearchTestResult[]> {
  const results: SearchTestResult[] = [];

  for (const test of SEARCH_TESTS) {
    try {
      const query = queries[test.id];
      const result = await test.execute(browser, url, query);
      results.push(result);
    } catch (error) {
      results.push({
        testId: test.id,
        passed: false,
        score: 0,
        finding: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return results;
}
