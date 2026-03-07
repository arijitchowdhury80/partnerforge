# Search Test Library

**File**: `backend/services/search-test-library.ts`
**Lines**: ~1,500
**Purpose**: 20 specific browser test implementations for comprehensive search experience auditing

---

## Overview

The Search Test Library implements 20 browser-based tests organized in 4 waves to comprehensively evaluate search experience quality. Each test captures screenshots, detects issues, and returns scored results.

Based on the `/algolia-search-audit` skill methodology, adapted for a web application with database persistence and real-time updates.

---

## Test Catalog (20 Tests)

### Wave 1: Foundation Tests (5 tests)

| ID | Name | Description | Scoring |
|----|------|-------------|---------|
| `homepage-load` | Homepage Load | Verify homepage loads successfully and search box is present | 10 pts: Fast load + search box present<br>5 pts: Slow load or missing search box<br>0 pts: Failed to load |
| `search-box-visibility` | Search Box Visibility | Check if search box is visible and functional | 10 pts: Visible, enabled, with placeholder<br>7 pts: Visible but missing placeholder<br>3 pts: Exists but not visible<br>0 pts: Not found |
| `sayt-basic` | SAYT Basic | Test if search-as-you-type shows suggestions | 10 pts: Suggestions appear (5-10)<br>5 pts: Few suggestions (< 3)<br>0 pts: No SAYT |
| `first-search` | First Search | Execute first search and verify results appear | 10 pts: 10+ results<br>6 pts: 1-9 results<br>0 pts: No results |
| `results-count` | Results Count Display | Verify result count is displayed to user | 10 pts: Count displayed<br>5 pts: No count display<br>0 pts: No search |

### Wave 2: Core Search Quality (5 tests)

| ID | Name | Description | Scoring |
|----|------|-------------|---------|
| `relevance` | Search Relevance | Test if product name search returns exact match first | 10 pts: Query term in top 3 results<br>7 pts: Query term in 1-2 results<br>4 pts: Query term in first result only<br>0 pts: No relevant results in top 3 |
| `typo-handling` | Typo Tolerance | Test if common typos return correct results | 10 pts: Typo results similar to correct<br>5 pts: Typo returns some results<br>0 pts: Typo returns zero results |
| `synonym-detection` | Synonym Detection | Test if synonyms return similar results | 10 pts: Synonym results similar to original<br>4 pts: Synonym returns some results<br>0 pts: Synonym returns zero results |
| `stop-words` | Stop Words Handling | Test if stop words are handled correctly | 10 pts: Stop words don't affect results<br>6 pts: Stop words slightly affect results<br>3 pts: Stop words cause zero results |
| `special-characters` | Special Characters | Test searches with special characters (&, %, @, etc.) | 10 pts: Special chars handled<br>5 pts: Special chars return zero results<br>0 pts: Special chars cause error |

### Wave 3: Advanced Features (5 tests)

| ID | Name | Description | Scoring |
|----|------|-------------|---------|
| `nlp-query` | Natural Language Query | Test natural language understanding | 10 pts: NLP query understood (3+ relevant in top 5)<br>5 pts: Partial understanding (1-2 relevant)<br>2 pts: Few results<br>0 pts: No results |
| `federated-search` | Federated Search | Test if help/blog content appears in results | 10 pts: Federated content found<br>3 pts: No federated content |
| `facets` | Faceted Search | Test facet filtering and counts | 10 pts: Facets with counts<br>6 pts: Facets without counts<br>0 pts: No facets |
| `sort-options` | Sort Options | Test sort by price, rating, popularity | 10 pts: Multiple sort options<br>7 pts: Limited sort options<br>5 pts: No sort options |
| `empty-state` | Empty State Handling | Test zero-results handling | 10 pts: Helpful message + suggestions<br>5 pts: Generic message<br>3 pts: No helpful message |

### Wave 4: Intelligence & Mobile (5 tests)

| ID | Name | Description | Scoring |
|----|------|-------------|---------|
| `mobile-responsiveness` | Mobile Search | Test search on mobile viewport (375x667) | 10 pts: Search works on mobile<br>5 pts: Search broken on mobile<br>3 pts: Search not visible on mobile |
| `personalization` | Personalization | Test if results change based on behavior | 8 pts: Personalization features detected<br>5 pts: No personalization (neutral) |
| `recommendations` | Recommendations | Test if product page shows recommendations | 10 pts: Recommendations found<br>5 pts: No product page<br>3 pts: No recommendations |
| `search-analytics` | Search Analytics | Test if search events are tracked | 8 pts: Analytics detected<br>5 pts: No analytics (neutral)<br>3 pts: No analytics |
| `algolia-detection` | Algolia Detection | Test if Algolia is in use | 10 pts: Algolia detected<br>0 pts: Algolia not detected (opportunity) |

---

## Architecture

### Class Structure

```typescript
export class SearchTestLibrary {
  // Test registry
  private tests: Map<string, SearchTest>

  // Execution methods
  async executeTest(testId, page, domain, context): Promise<TestResult>
  async executeWave(waveNumber, page, domain, context): Promise<TestResult[]>
  async executeAll(page, domain, context): Promise<TestResult[]>

  // Query methods
  getTest(testId): SearchTest | undefined
  getWaveTests(waveNumber): SearchTest[]
  getAllTests(): SearchTest[]
}
```

### Types

```typescript
interface SearchTest {
  id: string
  name: string
  description: string
  wave: number
  execute: (page, domain, context) => Promise<TestResult>
}

interface TestResult {
  testId: string
  testName: string
  status: 'passed' | 'failed' | 'warning'
  score: number // 0-10
  duration: number // ms
  screenshots: Screenshot[]
  findings: string[]
  evidence: Evidence[]
}

interface Screenshot {
  sequenceNumber: number
  caption: string
  filePath: string
  annotations?: Annotation[]
}

interface Evidence {
  type: 'element' | 'network' | 'console' | 'metric'
  description: string
  value: any
}

interface TestContext {
  screenshotDir: string
  testQueries?: TestQueries
  verticalContext?: VerticalContext
}

interface TestQueries {
  basic: string // e.g., "laptop"
  brand: string // e.g., "macbook"
  typo: string // e.g., "labtop"
  synonym: string // e.g., "notebook"
  nlp: string // e.g., "best laptop for gaming under 1000"
}
```

---

## Usage

### Basic Usage

```typescript
import { SearchTestLibrary } from './services/search-test-library';
import { chromium } from 'playwright';

const library = new SearchTestLibrary();
const browser = await chromium.launch();
const page = await browser.newPage();

const context = {
  screenshotDir: './screenshots/company-audit',
  testQueries: {
    basic: 'laptop',
    brand: 'macbook',
    typo: 'labtop',
    synonym: 'notebook',
    nlp: 'best laptop for gaming under 1000'
  }
};

// Execute a single test
const result = await library.executeTest('homepage-load', page, 'example.com', context);

console.log(`Test: ${result.testName}`);
console.log(`Status: ${result.status}`);
console.log(`Score: ${result.score}/10`);
console.log(`Findings: ${result.findings.join(', ')}`);
```

### Execute by Wave

```typescript
// Execute all Wave 1 tests (Foundation)
const wave1Results = await library.executeWave(1, page, 'example.com', context);

console.log(`Wave 1: ${wave1Results.length} tests completed`);
wave1Results.forEach(result => {
  console.log(`  ${result.testName}: ${result.score}/10`);
});
```

### Execute All Tests

```typescript
// Execute all 20 tests
const allResults = await library.executeAll(page, 'example.com', context);

const avgScore = allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length;
console.log(`Overall Score: ${avgScore.toFixed(1)}/10`);

await browser.close();
```

### Integration with Worker

```typescript
import { SearchTestLibrary } from '../services/search-test-library';
import { BrowserAutomationService } from '../services/browser-automation';

async function runSearchAudit(auditId: string, companyId: string, domain: string) {
  const browserService = new BrowserAutomationService();
  await browserService.initialize();

  const page = browserService.getPage();
  const library = new SearchTestLibrary();

  const context = {
    screenshotDir: `./audits/${auditId}/screenshots`,
    testQueries: generateTestQueries(companyId) // From strategic analysis
  };

  // Execute tests in waves with WebSocket progress updates
  for (let wave = 1; wave <= 4; wave++) {
    emitProgress(auditId, wave, `Wave ${wave}`, 'running', wave * 20);

    const waveResults = await library.executeWave(wave, page, domain, context);

    // Persist to database
    await persistTestResults(auditId, waveResults);

    emitProgress(auditId, wave, `Wave ${wave}`, 'completed', wave * 25);
  }

  await browserService.cleanup();
}
```

---

## Utility Methods

### Private Helper Methods

```typescript
// Find search input using common selectors
private async findSearchInput(page: Page): Promise<string | null>

// Execute a search query with human-like typing
private async executeSearch(page: Page, selector: string, query: string)

// Human-like typing with random delays
private async humanTypeText(page: Page, selector: string, text: string)

// Count search results using common selectors
private async countSearchResults(page: Page): Promise<number>

// Get first N results text content
private async getFirstNResults(page: Page, n: number): Promise<string[]>

// Capture screenshot and save to disk
private async captureScreenshot(
  page: Page,
  testId: string,
  sequenceNumber: number,
  caption: string,
  screenshotDir: string
): Promise<Screenshot>

// Delay helper
private async delay(ms: number)
```

---

## Test Implementation Patterns

### Standard Test Structure

Every test follows this pattern:

```typescript
private createTestName(): SearchTest {
  return {
    id: 'test-id',
    name: 'Test Name',
    description: 'Test description',
    wave: 1, // 1-4
    execute: async (page: Page, domain: string, context: TestContext): Promise<TestResult> => {
      const findings: string[] = [];
      const evidence: Evidence[] = [];
      const screenshots: Screenshot[] = [];
      let score = 10; // Start optimistic

      // 1. Navigate to page
      await page.goto(`https://${domain}`, { waitUntil: 'networkidle', timeout: 30000 });

      // 2. Find search input
      const searchSelector = await this.findSearchInput(page);
      if (!searchSelector) {
        findings.push('Search box not found');
        return { /* error result */ };
      }

      // 3. Execute test logic
      // ... test-specific logic

      // 4. Capture screenshot
      const screenshot = await this.captureScreenshot(
        page,
        'test-id',
        1,
        'Screenshot caption',
        context.screenshotDir
      );
      screenshots.push(screenshot);

      // 5. Determine status based on score
      return {
        testId: 'test-id',
        testName: 'Test Name',
        status: score >= 7 ? 'passed' : score >= 4 ? 'warning' : 'failed',
        score,
        duration: 0, // Set by executeTest wrapper
        screenshots,
        findings,
        evidence
      };
    }
  };
}
```

---

## Score Calculation

### Status Mapping

```typescript
score >= 7: 'passed'   // Good
score >= 4: 'warning'  // Needs improvement
score <  4: 'failed'   // Critical issue
```

### Score Ranges

- **10 points**: Perfect implementation
- **7-9 points**: Good with minor issues
- **4-6 points**: Functional but limited
- **1-3 points**: Poor implementation
- **0 points**: Not implemented or broken

---

## Screenshot Capture

### CRITICAL: Session-Bound IDs

Chrome MCP imageIds are session-bound. Screenshots MUST be persisted to disk immediately.

```typescript
// ✅ CORRECT: Persist immediately
const screenshot = await page.screenshot({ path: filePath, fullPage: true });

// ❌ WRONG: Store imageId for later retrieval (will fail)
const imageId = await captureScreenshot();
// ... later ...
const image = await getScreenshot(imageId); // FAILS - session expired
```

### Screenshot Directory Structure

```
audits/
  {audit_id}/
    screenshots/
      homepage-load-1.png
      search-box-visibility-1.png
      sayt-basic-1.png
      first-search-1.png
      results-count-1.png
      relevance-1.png
      typo-handling-1.png
      typo-handling-2.png
      ...
```

---

## Error Handling

### Test Execution Errors

```typescript
try {
  const result = await test.execute(page, domain, context);
  result.duration = Date.now() - startTime;
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
```

### Page Navigation Errors

All tests handle navigation errors gracefully:

- Timeout after 30 seconds
- Return `failed` status with `score: 0`
- Include error message in `findings` array

---

## Browser Resilience

### Human-Like Behavior

```typescript
// Human-like typing with random delays
private async humanTypeText(page: Page, selector: string, text: string) {
  for (const char of text) {
    await page.locator(selector).pressSequentially(char);
    const delay = 50 + Math.random() * 100; // 50-150ms variance
    await page.waitForTimeout(delay);
  }
}
```

### WAF Detection Avoidance

- Random delays between tests (500ms)
- Human-like typing speed (50-150ms per character)
- Natural page interaction (click before type, wait before submit)

---

## Testing

### Unit Tests

**File**: `backend/tests/search-test-library.test.ts`
**Coverage**: 50+ tests

```bash
npm test search-test-library
```

### Test Categories

1. **Test Registration** (3 tests)
   - All 20 tests registered
   - Tests organized into 4 waves
   - Unique test IDs

2. **Wave 1-4 Tests** (20 tests)
   - Each test has correct ID, name, wave

3. **Test Execution** (4 tests)
   - Throws error for non-existent test
   - Returns TestResult with required fields
   - Captures screenshots
   - Records execution duration

4. **Wave Execution** (2 tests)
   - Executes all tests in wave
   - Handles test failures gracefully

5. **Test Result Structure** (2 tests)
   - Includes findings array
   - Includes evidence array with correct types

6. **Error Handling** (2 tests)
   - Handles page navigation errors
   - Returns structured error result

---

## Performance

### Execution Time

- **Single test**: 2-5 seconds
- **Wave (5 tests)**: 15-30 seconds
- **All tests (20 tests)**: 60-120 seconds

### Optimization

- Tests run sequentially within wave (avoid rate limiting)
- 500ms delay between tests
- Reuses same page instance for wave
- Parallel wave execution possible with multiple pages

---

## Dependencies

```json
{
  "playwright": "^1.40.0"
}
```

**Runtime Dependencies**:
- `utils/logger` - Winston logger
- `utils/errors` - APIError class
- `fs/promises` - Screenshot file operations
- `path` - File path handling

---

## Integration Points

### Search Audit Worker

```typescript
import { SearchTestLibrary } from '../services/search-test-library';

// In worker job handler
const library = new SearchTestLibrary();
const results = await library.executeAll(page, domain, context);
```

### Screenshot Annotator

```typescript
import { ScreenshotAnnotator } from '../services/screenshot-annotator';

// After test execution
const annotator = new ScreenshotAnnotator();
for (const result of allResults) {
  for (const screenshot of result.screenshots) {
    await annotator.annotateScreenshot(screenshot.filePath, result);
  }
}
```

### Search Scoring System

```typescript
import { SearchScoring } from '../services/search-scoring';

// Calculate 10-dimension scores from test results
const scores = await SearchScoring.calculateScores(allResults);
```

---

## Maintenance

### Adding New Tests

1. Create test method following standard pattern
2. Register in `registerTests()` method
3. Assign to appropriate wave (1-4)
4. Add unit test in `search-test-library.test.ts`
5. Update this documentation

### Updating Scoring Logic

1. Modify score calculation in test implementation
2. Update documentation table
3. Update unit tests with new expected values
4. Test on multiple domains to validate

---

## Related Files

- `backend/services/browser-automation.ts` - Playwright wrapper
- `backend/services/search-scoring.ts` - 10-dimension scoring
- `backend/services/screenshot-annotator.ts` - Screenshot annotation
- `backend/workers/search-audit-worker.ts` - Worker integration
- `backend/tests/search-test-library.test.ts` - Unit tests

---

**Last Updated**: March 7, 2026
**Status**: ✅ Complete - Ready for integration
