import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { EventEmitter } from 'events';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Logger will be imported from utils/logger.ts once Agent 1 completes
const logger = {
  info: (message: string, meta?: any) => console.log('[INFO]', message, meta || ''),
  error: (message: string, meta?: any) => console.error('[ERROR]', message, meta || ''),
  warn: (message: string, meta?: any) => console.warn('[WARN]', message, meta || ''),
};

// AppError will be imported from utils/errors.ts once Agent 1 completes
class AppError extends Error {
  constructor(message: string, public code: string, public statusCode: number) {
    super(message);
    this.name = 'AppError';
  }
}

export interface BrowserTestStep {
  id: string;
  name: string;
  query?: string;
  action: 'navigate' | 'search' | 'click' | 'scroll' | 'wait';
  selector?: string;
  expectedResults?: {
    minResults?: number;
    contains?: string[];
    excludes?: string[];
  };
}

export interface Screenshot {
  testId: string;
  query?: string;
  imagePath: string;
  imageBase64: string;
  timestamp: Date;
  annotations?: Annotation[];
}

export interface Annotation {
  type: 'box' | 'arrow' | 'label';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
}

export interface BrowserTestResult {
  testId: string;
  passed: boolean;
  finding?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  screenshot: Screenshot;
  duration?: number;
}

export class BrowserAutomationService extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshotPath: string;

  constructor(screenshotPath = './screenshots') {
    super();
    this.screenshotPath = screenshotPath;
  }

  async initialize() {
    logger.info('Initializing browser automation');

    // Ensure screenshot directory exists
    if (!existsSync(this.screenshotPath)) {
      await mkdir(this.screenshotPath, { recursive: true });
    }

    this.browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS === 'true',
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Human-like headers to avoid WAF detection
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    this.page = await this.context.newPage();

    logger.info('Browser initialized successfully');
  }

  async runSearchAudit(
    domain: string,
    testSteps: BrowserTestStep[]
  ): Promise<BrowserTestResult[]> {
    if (!this.page) {
      throw new AppError('Browser not initialized', 'BROWSER_ERROR', 500);
    }

    const results: BrowserTestResult[] = [];

    this.emit('audit:started', { domain, totalSteps: testSteps.length });

    for (const [index, step] of testSteps.entries()) {
      this.emit('test:started', {
        step: step.name,
        query: step.query,
        progress: `${index + 1}/${testSteps.length}`,
      });

      const startTime = Date.now();

      try {
        const result = await this.runTestStep(domain, step);
        result.duration = Date.now() - startTime;
        results.push(result);

        this.emit('test:completed', {
          testId: step.id,
          passed: result.passed,
          finding: result.finding,
          duration: result.duration,
        });

        // Stream screenshot to frontend
        this.emit('screenshot:captured', {
          testId: step.id,
          query: step.query,
          image: result.screenshot.imageBase64,
          timestamp: result.screenshot.timestamp,
        });

        if (!result.passed && result.finding) {
          this.emit('finding:detected', {
            testId: step.id,
            severity: result.severity,
            title: result.finding,
            screenshotPath: result.screenshot.imagePath,
          });
        }

        // Human-like delay between tests (avoid bot detection)
        await this.humanDelay(500, 1500);
      } catch (error: any) {
        logger.error('Test step failed', { step: step.name, error: error.message });
        this.emit('test:failed', { testId: step.id, error: error.message });
      }
    }

    this.emit('audit:completed', { totalTests: results.length });

    return results;
  }

  private async runTestStep(
    domain: string,
    step: BrowserTestStep
  ): Promise<BrowserTestResult> {
    const page = this.page!;

    switch (step.action) {
      case 'navigate':
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });
        // Wait for page to fully render
        await page.waitForTimeout(2000);
        break;

      case 'search':
        if (!step.query) throw new Error('Search query required');

        // Find search input (try common selectors)
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
        ];

        let searchInput = null;
        for (const selector of searchSelectors) {
          try {
            searchInput = await page.waitForSelector(selector, { timeout: 5000 });
            if (searchInput) break;
          } catch {
            continue;
          }
        }

        if (!searchInput) {
          throw new Error('Search input not found on page');
        }

        // Human-like typing with delays between keystrokes
        await this.humanTypeText(searchInput, step.query);

        // Wait a moment before pressing Enter (like a real user)
        await this.humanDelay(300, 800);

        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 30000 });

        // Wait for results to render
        await page.waitForTimeout(2000);
        break;

      case 'click':
        if (!step.selector) throw new Error('Selector required for click');
        await page.click(step.selector);
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        await page.waitForTimeout(1000);
        break;

      case 'scroll':
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(500);
        break;

      case 'wait':
        await page.waitForTimeout(2000);
        break;
    }

    // Capture screenshot
    const screenshot = await this.captureScreenshot(step.id, step.query);

    // Analyze results
    const analysis = await this.analyzeResults(page, step);

    return {
      testId: step.id,
      passed: analysis.passed,
      finding: analysis.finding,
      severity: analysis.severity,
      screenshot,
    };
  }

  private async captureScreenshot(
    testId: string,
    query?: string
  ): Promise<Screenshot> {
    const page = this.page!;
    const timestamp = new Date();
    const filename = `${testId}-${timestamp.getTime()}.png`;
    const imagePath = path.join(this.screenshotPath, filename);

    const screenshotBuffer = await page.screenshot({
      path: imagePath,
      fullPage: true,
    });

    const imageBase64 = screenshotBuffer.toString('base64');

    logger.info('Screenshot captured', { testId, imagePath });

    return {
      testId,
      query,
      imagePath,
      imageBase64,
      timestamp,
      annotations: [], // Will be populated by annotation engine in future
    };
  }

  private async analyzeResults(
    page: Page,
    step: BrowserTestStep
  ): Promise<{ passed: boolean; finding?: string; severity?: 'critical' | 'high' | 'medium' | 'low' }> {
    if (!step.expectedResults) {
      return { passed: true };
    }

    // Count results using common e-commerce/search result selectors
    const resultSelectors = [
      '.search-result',
      '.product-item',
      '[data-testid="result"]',
      '[data-testid="product"]',
      '.product',
      '.result',
      'article[data-product]',
    ];

    let resultCount = 0;
    for (const selector of resultSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          resultCount = count;
          break;
        }
      } catch {
        continue;
      }
    }

    // Check minimum results
    if (step.expectedResults.minResults && resultCount < step.expectedResults.minResults) {
      return {
        passed: false,
        finding: `Only ${resultCount} results found (expected at least ${step.expectedResults.minResults})`,
        severity: 'high',
      };
    }

    // Check for required content
    if (step.expectedResults.contains) {
      const pageContent = await page.textContent('body');
      for (const keyword of step.expectedResults.contains) {
        if (!pageContent?.toLowerCase().includes(keyword.toLowerCase())) {
          return {
            passed: false,
            finding: `Expected content "${keyword}" not found`,
            severity: 'medium',
          };
        }
      }
    }

    // Check for excluded content
    if (step.expectedResults.excludes) {
      const pageContent = await page.textContent('body');
      for (const keyword of step.expectedResults.excludes) {
        if (pageContent?.toLowerCase().includes(keyword.toLowerCase())) {
          return {
            passed: false,
            finding: `Unwanted content "${keyword}" found in results`,
            severity: 'low',
          };
        }
      }
    }

    return { passed: true };
  }

  /**
   * Human-like typing with random delays between keystrokes (50-150ms)
   */
  private async humanTypeText(element: any, text: string) {
    for (const char of text) {
      await element.type(char);
      // Random delay between 50-150ms (human-like typing speed)
      const delay = 50 + Math.random() * 100;
      await this.page!.waitForTimeout(delay);
    }
  }

  /**
   * Human-like delay with random variance
   */
  private async humanDelay(min: number, max: number) {
    const delay = min + Math.random() * (max - min);
    await this.page!.waitForTimeout(delay);
  }

  async cleanup() {
    if (this.context) {
      await this.context.close();
      logger.info('Browser context closed');
    }
    if (this.browser) {
      await this.browser.close();
      logger.info('Browser closed');
    }
    logger.info('Browser cleaned up successfully');
  }
}
