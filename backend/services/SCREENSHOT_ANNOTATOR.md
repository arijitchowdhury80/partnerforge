# Screenshot Annotation Engine

## Overview

The Screenshot Annotation Engine automatically detects issues in screenshots and adds visual annotations. It uses the `sharp` library for image processing and SVG compositing to draw boxes, arrows, underlines, and text labels.

## Architecture

### Annotation Flow

```
Screenshot Image (PNG)
  ↓
Issue Detection (6 detectors)
  ↓
Annotation Generation (suggested annotations)
  ↓
Image Compositing (SVG overlay)
  ↓
Annotated Screenshot (PNG with -annotated suffix)
```

## Annotation Types

### 1. Box

**Purpose**: Highlight areas of concern or success

**Use Cases**:
- Red box: Critical issues (empty results, broken features)
- Yellow box: Warnings (poor relevance, slow load)
- Green box: Good examples (correct behavior)
- Blue box: Informational (analytics, tracking)

**Parameters**:
```typescript
{
  type: 'box',
  x: 100,           // Top-left X coordinate
  y: 200,           // Top-left Y coordinate
  width: 300,       // Box width
  height: 200,      // Box height
  color: '#DC2626', // Red (Tailwind red-600)
  label: 'Critical Issue',
  severity: 'critical'
}
```

### 2. Arrow

**Purpose**: Point to specific elements

**Use Cases**:
- Direct attention to small UI elements
- Show relationships between elements
- Indicate flow or sequence

**Parameters**:
```typescript
{
  type: 'arrow',
  x: 100,           // Start X coordinate
  y: 100,           // Start Y coordinate
  width: 150,       // Horizontal length
  height: 150,      // Vertical length
  color: '#F59E0B', // Amber (Tailwind amber-500)
  label: 'Warning',
  severity: 'warning'
}
```

### 3. Underline

**Purpose**: Highlight text or input fields

**Use Cases**:
- Show typos in search input
- Highlight misspelled text
- Emphasize specific text

**Parameters**:
```typescript
{
  type: 'underline',
  x: 300,           // Start X coordinate
  y: 150,           // Y coordinate
  width: 400,       // Line width
  height: 3,        // Line thickness
  color: '#DC2626', // Red
  severity: 'critical'
}
```

### 4. Text Label

**Purpose**: Add standalone text annotations

**Use Cases**:
- Add context to unmarked areas
- Provide explanations
- Show metrics or counts

**Parameters**:
```typescript
{
  type: 'text',
  x: 100,           // X coordinate
  y: 300,           // Y coordinate
  color: '#10B981', // Green (Tailwind green-500)
  label: 'Success',
  severity: 'success'
}
```

---

## Issue Detection

### 1. Empty State Detection

**Looks for**:
- White/empty areas where results should be
- "No results" text patterns
- Zero result count indicators

**Detection Logic**:
```typescript
// Patterns checked:
const noResultsPatterns = [
  'no results found',
  'no products found',
  '0 results',
  'try another search',
  'no matches',
];
```

**Output**:
```typescript
{
  issueType: 'empty_state',
  location: {
    x: 240,    // 20% from left (assuming 1200px width)
    y: 240,    // 30% from top (assuming 800px height)
    width: 720,
    height: 320
  },
  severity: 'critical',
  description: 'No search results found - empty state detected',
  suggestedAnnotation: {
    type: 'box',
    color: '#DC2626',
    label: 'Empty Results',
    severity: 'critical'
  }
}
```

### 2. Typo Detection

**Looks for**:
- Search input box with typo text
- Red underline or spelling suggestions
- Excessive spacing in input

**Detection Logic**:
```typescript
const searchInput = await page.$('input[type="search"]');
if (searchInput) {
  const value = await searchInput.inputValue();
  if (value && /\s{2,}/.test(value)) {
    // Detected spacing issues
  }
}
```

**Output**:
```typescript
{
  issueType: 'typo',
  location: {
    x: 360,    // 30% from left
    y: 96,     // 12% from top (search box area)
    width: 480,
    height: 50
  },
  severity: 'warning',
  description: 'Typo detected in search query',
  suggestedAnnotation: {
    type: 'underline',
    color: '#DC2626',
    label: 'Typo',
    severity: 'warning'
  }
}
```

### 3. Poor Relevance Detection

**Looks for**:
- Results that don't match query
- Wrong product types in top positions
- Misaligned categories

**Output**:
```typescript
{
  issueType: 'poor_relevance',
  location: {
    x: 120,    // 10% from left
    y: 200,    // 25% from top (first result area)
    width: 360,
    height: 160
  },
  severity: 'warning',
  description: 'Top result does not match query intent',
  suggestedAnnotation: {
    type: 'box',
    color: '#F59E0B',
    label: 'Poor Relevance',
    severity: 'warning'
  }
}
```

### 4. Missing SAYT Detection

**Looks for**:
- Search input without suggestions dropdown
- Empty autocomplete area
- No query suggestions

**Output**:
```typescript
{
  issueType: 'missing_sayt',
  location: {
    x: 360,    // 30% from left
    y: 120,    // 15% from top
    width: 480,
    height: 200
  },
  severity: 'warning',
  description: 'Search-as-you-type suggestions not visible',
  suggestedAnnotation: {
    type: 'box',
    color: '#F59E0B',
    label: 'Missing SAYT',
    severity: 'warning'
  }
}
```

### 5. Broken Facets Detection

**Looks for**:
- Facets with zero counts
- Non-functional filter checkboxes
- Empty facet sections

**Output**:
```typescript
{
  issueType: 'broken_facets',
  location: {
    x: 60,     // 5% from left (sidebar area)
    y: 200,    // 25% from top
    width: 300,
    height: 240
  },
  severity: 'warning',
  description: 'Facets showing zero counts or not functional',
  suggestedAnnotation: {
    type: 'box',
    color: '#F59E0B',
    label: 'Broken Facets',
    severity: 'warning'
  }
}
```

### 6. Slow Load Detection

**Looks for**:
- Loading spinner still visible
- Skeleton screens
- Placeholder content
- Network requests in progress

**Output**:
```typescript
{
  issueType: 'slow_load',
  location: {
    x: 540,    // 45% from left (center area)
    y: 280,    // 35% from top
    width: 120,
    height: 80
  },
  severity: 'info',
  description: 'Loading indicator visible - slow response time',
  suggestedAnnotation: {
    type: 'box',
    color: '#3B82F6',
    label: 'Slow Load',
    severity: 'info'
  }
}
```

---

## Color Palette

### Algolia Brand Colors

```typescript
const COLORS = {
  algoliaBlue: '#003DFF',    // Algolia Nebula Blue (primary)
  algoliaPurple: '#5468FF',  // Algolia Purple (accents)
};
```

### Severity Colors (Tailwind)

```typescript
const COLORS = {
  critical: '#DC2626',  // Red (red-600)
  warning: '#F59E0B',   // Amber (amber-500)
  success: '#10B981',   // Green (green-500)
  info: '#3B82F6',      // Blue (blue-500)
};
```

---

## Usage

### Basic Annotation (Auto-Detect)

```typescript
import { ScreenshotAnnotator } from './screenshot-annotator';

const annotator = new ScreenshotAnnotator();

// Auto-detect issues and annotate
const annotatedPath = await annotator.annotateScreenshot(
  '/path/to/screenshot.png'
);

console.log('Annotated screenshot:', annotatedPath);
// Output: /path/to/screenshot-annotated.png
```

### Manual Annotation

```typescript
const annotation = {
  type: 'box',
  x: 100,
  y: 200,
  width: 300,
  height: 200,
  color: '#DC2626',
  label: 'Empty Results',
  severity: 'critical'
};

const annotatedPath = await annotator.annotateScreenshot(
  '/path/to/screenshot.png',
  [annotation]
);
```

### Multiple Annotations

```typescript
const annotations = [
  {
    type: 'box',
    x: 100,
    y: 200,
    width: 200,
    height: 150,
    color: '#DC2626',
    label: 'Issue 1',
    severity: 'critical'
  },
  {
    type: 'arrow',
    x: 400,
    y: 100,
    width: 100,
    height: 100,
    color: '#F59E0B',
    label: 'Issue 2',
    severity: 'warning'
  },
  {
    type: 'underline',
    x: 300,
    y: 50,
    width: 400,
    height: 3,
    color: '#DC2626',
    severity: 'critical'
  }
];

const annotatedPath = await annotator.annotateScreenshot(
  '/path/to/screenshot.png',
  annotations
);
```

### Batch Annotation

```typescript
const screenshotPaths = [
  '/path/to/screenshot1.png',
  '/path/to/screenshot2.png',
  '/path/to/screenshot3.png'
];

const annotatedPaths = await annotator.batchAnnotate(screenshotPaths);

console.log('Annotated screenshots:', annotatedPaths);
// Output:
// [
//   '/path/to/screenshot1-annotated.png',
//   '/path/to/screenshot2-annotated.png',
//   '/path/to/screenshot3-annotated.png'
// ]
```

### Issue Detection Only

```typescript
const issues = await annotator.detectIssues('/path/to/screenshot.png');

console.log('Detected issues:', issues);
// Output:
// [
//   {
//     issueType: 'empty_state',
//     location: { x: 240, y: 240, width: 720, height: 320 },
//     severity: 'critical',
//     description: 'No search results found - empty state detected',
//     suggestedAnnotation: { ... }
//   }
// ]
```

### Custom Configuration

```typescript
const annotator = new ScreenshotAnnotator({
  detectEmptyState: true,
  detectTypos: true,
  detectPoorRelevance: false,  // Disable poor relevance detection
  detectSlowLoad: true,
  detectMissingSAYT: true,
  detectBrokenFacets: false,   // Disable facet detection
  fontSize: 18,                // Larger labels
  lineWidth: 4                 // Thicker lines
});
```

### Create Comparison Screenshot

```typescript
const comparisonPath = await annotator.createComparison(
  '/path/to/before.png',
  '/path/to/after.png',
  '/path/to/comparison.png'
);

console.log('Comparison created:', comparisonPath);
// Output: Side-by-side comparison with "Before" and "After" labels
```

---

## Integration with Search Audit Workflow

### Step 1: Capture Screenshots (Browser Automation)

```typescript
import { BrowserAutomation } from './browser-automation';

const browser = new BrowserAutomation();
await browser.init();

const page = await browser.newPage();
await page.goto('https://example.com/search?q=laptop');

const screenshotPath = await page.screenshot({
  path: '/audit/screenshots/2c-simple-query.png',
  fullPage: true
});
```

### Step 2: Run Tests (Test Library)

```typescript
import { SearchTestLibrary } from './search-test-library';

const testLibrary = new SearchTestLibrary();
const result = await testLibrary.executeTest('2c', browser, 'example.com');

// result.screenshotPath = '/audit/screenshots/2c-simple-query.png'
// result.passed = false
// result.score = 3
```

### Step 3: Annotate Screenshots

```typescript
import { ScreenshotAnnotator } from './screenshot-annotator';

const annotator = new ScreenshotAnnotator();

// Auto-detect issues based on test result
if (!result.passed) {
  const annotatedPath = await annotator.annotateScreenshot(
    result.screenshotPath
  );

  console.log('Annotated:', annotatedPath);
  // Output: /audit/screenshots/2c-simple-query-annotated.png
}
```

### Step 4: Use in Report

```markdown
## Finding: Poor Relevance

**Test**: 2c - Simple Single-Word Query
**Score**: 3/10
**Severity**: CRITICAL

![Annotated Screenshot](./screenshots/2c-simple-query-annotated.png)

**Issue**: Search for "laptop" returns tablets and accessories in top 3 results.

**Business Impact**: Poor relevance leads to 25-40% revenue loss from abandoned searches.

**Algolia Solution**: Algolia Relevance with textual + semantic + business rules.
```

---

## Helper Functions

### Get Severity Color

```typescript
import { getSeverityColor } from './screenshot-annotator';

const color = getSeverityColor('critical');
console.log(color); // '#DC2626'
```

### Validate Screenshot Path

```typescript
import { validateScreenshotPath } from './screenshot-annotator';

const isValid = await validateScreenshotPath('/path/to/screenshot.png');
if (isValid) {
  // Proceed with annotation
}
```

### Get Screenshot Dimensions

```typescript
import { getScreenshotDimensions } from './screenshot-annotator';

const dimensions = await getScreenshotDimensions('/path/to/screenshot.png');
console.log(dimensions); // { width: 1920, height: 1080 }
```

---

## Advanced Features

### Custom Font Path

```typescript
const annotator = new ScreenshotAnnotator({
  fontPath: '/path/to/custom-font.ttf',
  fontSize: 20
});
```

### Custom Line Width

```typescript
const annotator = new ScreenshotAnnotator({
  lineWidth: 5  // Thicker annotation lines
});
```

### Selective Detection

```typescript
// Only detect typos and empty states
const annotator = new ScreenshotAnnotator({
  detectEmptyState: true,
  detectTypos: true,
  detectPoorRelevance: false,
  detectSlowLoad: false,
  detectMissingSAYT: false,
  detectBrokenFacets: false
});
```

---

## Performance Considerations

### Image Size

- **Large screenshots** (>5MB): Annotation takes ~2-3 seconds
- **Standard screenshots** (1-2MB): Annotation takes ~500-800ms
- **Small screenshots** (<500KB): Annotation takes ~200-300ms

### Batch Operations

Process screenshots in batches of 10-20 for optimal performance:

```typescript
const batchSize = 10;
for (let i = 0; i < screenshotPaths.length; i += batchSize) {
  const batch = screenshotPaths.slice(i, i + batchSize);
  await annotator.batchAnnotate(batch);
}
```

### Memory Usage

- Each screenshot uses ~50-100MB RAM during processing
- Sharp library automatically releases memory after processing
- For large batches (100+ screenshots), consider processing in chunks

---

## Error Handling

### Missing Screenshot File

```typescript
const annotatedPath = await annotator.annotateScreenshot('/non/existent/file.png');
// Returns original path on error
// Logs error: "Error annotating screenshot: ENOENT"
```

### Invalid Image Format

```typescript
const annotatedPath = await annotator.annotateScreenshot('/path/to/file.txt');
// Returns original path on error
// Logs error: "Input buffer contains unsupported image format"
```

### Corrupted Image

```typescript
const annotatedPath = await annotator.annotateScreenshot('/path/to/corrupted.png');
// Returns original path on error
// Logs error: "Input buffer contains corrupt image data"
```

---

## Testing

### Unit Tests

```bash
npm test screenshot-annotator.test.ts
```

### Test Coverage

- ✅ Box annotation
- ✅ Arrow annotation
- ✅ Underline annotation
- ✅ Text label annotation
- ✅ Multiple annotations
- ✅ Batch annotation
- ✅ Comparison screenshot
- ✅ Issue detection (6 types)
- ✅ Helper functions
- ✅ Error handling

### Mock Screenshots

Tests use generated screenshots (white background with colored blocks):

```typescript
await createTestScreenshot(1200, 800, 'test.png');
// Creates 1200x800px screenshot with:
// - Blue header (0-100px)
// - White search box (80-130px)
// - Light gray content area (150-800px)
```

---

## Troubleshooting

### Issue: Annotations Not Visible

**Cause**: Annotation coordinates outside image bounds

**Solution**: Validate coordinates before annotation:

```typescript
const dims = await getScreenshotDimensions(screenshotPath);
if (dims && annotation.x < dims.width && annotation.y < dims.height) {
  // Safe to annotate
}
```

### Issue: Labels Cut Off

**Cause**: Label text too long for box width

**Solution**: Calculate label width dynamically:

```typescript
const labelWidth = Math.max(label.length * 9 + 20, 100);
```

### Issue: Low Quality Output

**Cause**: Default PNG compression

**Solution**: Use higher quality settings:

```typescript
await sharp(imageBuffer)
  .png({ quality: 100, compressionLevel: 0 })
  .toBuffer();
```

---

## Best Practices

### 1. Annotate Failed Tests Only

Only annotate screenshots for failed tests to reduce processing time:

```typescript
if (!testResult.passed) {
  await annotator.annotateScreenshot(testResult.screenshotPath);
}
```

### 2. Use Severity-Appropriate Colors

Match annotation color to issue severity:

```typescript
const annotation = {
  type: 'box',
  color: testResult.severity === 'critical' ? '#DC2626' : '#F59E0B',
  ...
};
```

### 3. Keep Labels Concise

Use short, descriptive labels (3-5 words max):

```typescript
label: 'Empty Results'      // ✅ Good
label: 'No search results found in this area' // ❌ Too long
```

### 4. Save Original Screenshots

Keep both original and annotated versions:

```typescript
// Original: /audit/screenshots/2c-simple-query.png
// Annotated: /audit/screenshots/2c-simple-query-annotated.png
```

### 5. Use Comparison for Before/After

Show improvements with side-by-side comparisons:

```typescript
await annotator.createComparison(
  '/audit/before-algolia.png',
  '/audit/after-algolia.png',
  '/audit/comparison.png'
);
```

---

## Roadmap

### Future Enhancements

1. **OCR Integration**: Use tesseract.js to read text from screenshots for better issue detection
2. **ML-Based Detection**: Train model to detect UI patterns (empty states, spinners, etc.)
3. **Video Annotation**: Support annotating video frames (GIF/MP4)
4. **Heatmap Overlay**: Show click heatmaps on screenshots
5. **Custom Annotation Templates**: Save/load annotation sets for common issues

---

## Changelog

### v1.0.0 (2026-03-07)

- Initial implementation with 4 annotation types (box, arrow, underline, text)
- 6 issue detection algorithms
- SVG-based drawing with sharp library
- Batch annotation support
- Side-by-side comparison screenshots
- Comprehensive test suite (25+ tests)

---

## References

- [PHASE4_PLAN.md](../../PHASE4_PLAN.md) - Phase 4 architecture
- [search-test-library.ts](./search-test-library.ts) - Test implementations
- [search-audit-scoring.ts](./search-audit-scoring.ts) - Scoring algorithm
- [sharp Documentation](https://sharp.pixelplumbing.com/) - Image processing library

---

**Author**: Agent 2
**Date**: March 7, 2026
**Version**: 1.0.0
