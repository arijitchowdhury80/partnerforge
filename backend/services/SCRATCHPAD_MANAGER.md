# Scratchpad Manager Service

**Purpose**: Manage 12 intermediate scratchpad files that store structured audit research data before final report generation.

**File**: `backend/services/scratchpad-manager.ts`
**Lines**: ~400 lines
**Status**: ✅ Complete

---

## Overview

The Scratchpad Manager creates and manages a workspace of 12 numbered markdown files that serve as intermediate storage during the audit process. These files are progressively populated during Phase 1 (Research) and Phase 2 (Browser Testing), then consumed by the Report Generator in Phase 3.

## Architecture

```
scratchpads/
├── {companyId}/
│   └── {auditId}/
│       ├── {companyName}-{auditId}-01-company-context.md
│       ├── {companyName}-{auditId}-02-tech-stack.md
│       ├── {companyName}-{auditId}-03-traffic.md
│       ├── {companyName}-{auditId}-04-financials.md
│       ├── {companyName}-{auditId}-05-competitors.md
│       ├── {companyName}-{auditId}-06-hiring.md
│       ├── {companyName}-{auditId}-07-intel.md
│       ├── {companyName}-{auditId}-08-strategic.md
│       ├── {companyName}-{auditId}-09-search-tests.md
│       ├── {companyName}-{auditId}-10-screenshots.md
│       ├── {companyName}-{auditId}-11-scoring.md
│       └── {companyName}-{auditId}-12-recommendations.md
```

---

## The 12 Scratchpad Files

| # | File Name | Title | Purpose |
|---|-----------|-------|---------|
| 1 | `company-context` | Company Context | Company overview, industry, vertical, business model |
| 2 | `tech-stack` | Technology Stack | Technology stack from BuiltWith (e-commerce, CMS, search, analytics) |
| 3 | `traffic` | Traffic Analysis | Traffic analysis from SimilarWeb (visits, engagement, sources) |
| 4 | `financials` | Financial Profile | Financial data from Yahoo Finance (3-year trends, margins, growth) |
| 5 | `competitors` | Competitor Analysis | Competitor analysis (similar sites, search providers, positioning) |
| 6 | `hiring` | Hiring Signals | Hiring signals from Apify (open roles, growth areas) |
| 7 | `intel` | Investor Intelligence | Investor intelligence (10-K, earnings calls, executive quotes) |
| 8 | `strategic` | Strategic Context | Strategic angles and trigger events (why now?) |
| 9 | `search-tests` | Search Test Results | Search test results summary (20 tests, pass/fail, evidence) |
| 10 | `screenshots` | Screenshot Inventory | Screenshot inventory with annotations and issue detection |
| 11 | `scoring` | Scoring Breakdown | 10-dimension scores breakdown (relevance, typos, SAYT, etc.) |
| 12 | `recommendations` | Algolia Recommendations | Algolia value prop recommendations mapped to findings |

---

## Usage

### 1. Initialize Workspace

```typescript
import { ScratchpadManager } from './services/scratchpad-manager';

const scratchpad = new ScratchpadManager(
  'company-uuid',
  'audit-uuid',
  'Costco Wholesale'
);

// Create workspace and all 12 files
const workspace = await scratchpad.initialize();

console.log(workspace.workspaceDir); // ./scratchpads/company-uuid/audit-uuid
console.log(workspace.files.length);  // 12
```

### 2. Create/Update Files

```typescript
// Create file with content
await scratchpad.createFile(
  1, // fileNumber
  'company-context',
  `## Company Overview

**Industry**: Retail
**Revenue**: $254B (FY2025)
**Business Model**: Membership-based warehouse club
...`
);

// Update existing file
await scratchpad.updateFile(
  1,
  `## Company Overview (Updated)

**Industry**: Retail
**Revenue**: $254B (FY2025)
...`
);

// Append to existing file
await scratchpad.appendToFile(
  1,
  `## Recent News

- Q4 2025 earnings exceeded expectations
- Expanded e-commerce platform
...`
);
```

### 3. Read Files

```typescript
// Read single file
const content = await scratchpad.getFile(1);
console.log(content);

// Read all files
const allFiles = await scratchpad.getAllFiles();
console.log(allFiles[1]); // File 1 content
console.log(allFiles[2]); // File 2 content
...
```

### 4. File Metadata

```typescript
const metadata = await scratchpad.getFileMetadata(1);
console.log(metadata.filePath);      // Full path
console.log(metadata.size);          // Size in bytes
console.log(metadata.lastModified);  // Date object
```

### 5. Cleanup

```typescript
// Delete all files and workspace directory
await scratchpad.cleanup();
```

---

## File Format

Each scratchpad file has a standardized header:

```markdown
# Company Context

**Company**: costco-wholesale
**Audit ID**: a1b2c3d4-e5f6-7890-abcd-ef1234567890
**File**: 1 of 12
**Purpose**: Company overview, industry, vertical, business model
**Last Updated**: 2026-03-07T12:00:00.000Z

---

[Content goes here]
```

---

## Integration with Audit Workflow

### Phase 1: Research (Enrichment Workers)

Each enrichment worker populates its corresponding scratchpad file:

```typescript
// SimilarWeb worker
const trafficData = await similarweb.getTrafficData(domain);
await scratchpad.createFile(
  3,
  'traffic',
  formatTrafficData(trafficData)
);

// BuiltWith worker
const techStack = await builtwith.getTechnologies(domain);
await scratchpad.createFile(
  2,
  'tech-stack',
  formatTechStack(techStack)
);

// Yahoo Finance worker
const financials = await yahooFinance.getFinancials(ticker);
await scratchpad.createFile(
  4,
  'financials',
  formatFinancials(financials)
);
```

### Phase 2: Browser Testing (Search Audit Worker)

```typescript
// Search test results
const testResults = await executeSearchTests(domain);
await scratchpad.createFile(
  9,
  'search-tests',
  formatTestResults(testResults)
);

// Screenshots
const screenshots = await captureScreenshots(testResults);
await scratchpad.createFile(
  10,
  'screenshots',
  formatScreenshots(screenshots)
);

// Scoring
const scores = await calculateScores(testResults);
await scratchpad.createFile(
  11,
  'scoring',
  formatScores(scores)
);
```

### Phase 3: Report Generation

```typescript
// Report generator reads from scratchpad files
import { ScratchpadReportGenerator } from './services/scratchpad-report-generator';

const reportGen = new ScratchpadReportGenerator(scratchpad);
const report = await reportGen.generateReport();

console.log(report.markdown);    // Full markdown report
console.log(report.outputPath);  // Path to saved report
console.log(report.metadata);    // Word count, citations, etc.
```

---

## Error Handling

```typescript
try {
  await scratchpad.createFile(1, 'company-context', content);
} catch (error) {
  if (error.message.includes('Invalid file number')) {
    // File number must be 1-12
  } else if (error.message.includes('does not exist')) {
    // File hasn't been created yet
  }
}
```

---

## Best Practices

### 1. File Naming Convention

File numbers are ALWAYS 1-12. Use the predefined `SCRATCHPAD_FILES` constant:

```typescript
import { SCRATCHPAD_FILES } from './services/scratchpad-manager';

// Get file definition
const fileSpec = SCRATCHPAD_FILES.find(f => f.fileNumber === 1);
console.log(fileSpec.fileName);     // 'company-context'
console.log(fileSpec.title);        // 'Company Context'
console.log(fileSpec.description);  // 'Company overview...'
```

### 2. Incremental Updates

Use `appendToFile()` when adding new data without replacing existing content:

```typescript
// Initial creation
await scratchpad.createFile(7, 'intel', '## Executive Quotes\n\n');

// Add quotes incrementally
await scratchpad.appendToFile(7, '> "Quote 1"\n> — CEO, Q4 2025');
await scratchpad.appendToFile(7, '> "Quote 2"\n> — CFO, Q4 2025');
```

### 3. Workspace Cleanup

Clean up old workspaces after report generation:

```typescript
// Generate report
const report = await reportGen.generateReport();

// Optionally keep workspace for debugging
if (process.env.KEEP_SCRATCHPAD !== 'true') {
  await scratchpad.cleanup();
}
```

### 4. File Existence Checks

Check if workspace exists before creating files:

```typescript
const exists = await scratchpad.exists();

if (!exists) {
  await scratchpad.initialize();
}

// Now safe to create files
await scratchpad.createFile(1, 'company-context', content);
```

---

## Testing

```typescript
import { ScratchpadManager } from './services/scratchpad-manager';
import * as fs from 'fs/promises';

describe('ScratchpadManager', () => {
  let scratchpad: ScratchpadManager;

  beforeEach(() => {
    scratchpad = new ScratchpadManager(
      'test-company',
      'test-audit',
      'Test Company',
      './test-scratchpads'
    );
  });

  afterEach(async () => {
    await scratchpad.cleanup();
  });

  it('should initialize workspace with 12 files', async () => {
    const workspace = await scratchpad.initialize();
    expect(workspace.files.length).toBe(12);
  });

  it('should create file with header', async () => {
    await scratchpad.initialize();
    await scratchpad.createFile(1, 'company-context', 'Test content');
    const content = await scratchpad.getFile(1);
    expect(content).toContain('# Company Context');
    expect(content).toContain('Test content');
  });

  it('should update file', async () => {
    await scratchpad.initialize();
    await scratchpad.createFile(1, 'company-context', 'Original');
    await scratchpad.updateFile(1, 'Updated');
    const content = await scratchpad.getFile(1);
    expect(content).toContain('Updated');
    expect(content).not.toContain('Original');
  });

  it('should append to file', async () => {
    await scratchpad.initialize();
    await scratchpad.createFile(1, 'company-context', 'Original');
    await scratchpad.appendToFile(1, 'Appended');
    const content = await scratchpad.getFile(1);
    expect(content).toContain('Original');
    expect(content).toContain('Appended');
  });

  it('should read all files', async () => {
    await scratchpad.initialize();
    await scratchpad.createFile(1, 'company-context', 'File 1');
    await scratchpad.createFile(2, 'tech-stack', 'File 2');
    const files = await scratchpad.getAllFiles();
    expect(Object.keys(files).length).toBe(12);
    expect(files[1]).toContain('File 1');
    expect(files[2]).toContain('File 2');
  });

  it('should get file metadata', async () => {
    await scratchpad.initialize();
    await scratchpad.createFile(1, 'company-context', 'Test');
    const metadata = await scratchpad.getFileMetadata(1);
    expect(metadata.filePath).toBeDefined();
    expect(metadata.size).toBeGreaterThan(0);
    expect(metadata.lastModified).toBeInstanceOf(Date);
  });

  it('should cleanup workspace', async () => {
    await scratchpad.initialize();
    await scratchpad.cleanup();
    const exists = await scratchpad.exists();
    expect(exists).toBe(false);
  });
});
```

---

## File Size Expectations

| File | Expected Size | Notes |
|------|--------------|-------|
| 01-company-context | 1-2 KB | Company overview |
| 02-tech-stack | 2-5 KB | Technology list |
| 03-traffic | 3-8 KB | Traffic data tables |
| 04-financials | 2-5 KB | Financial tables |
| 05-competitors | 2-5 KB | Competitor list |
| 06-hiring | 1-3 KB | Hiring signals |
| 07-intel | 5-15 KB | Executive quotes |
| 08-strategic | 1-3 KB | Trigger events |
| 09-search-tests | 10-30 KB | Test results |
| 10-screenshots | 2-5 KB | Screenshot paths |
| 11-scoring | 3-8 KB | Scoring matrix |
| 12-recommendations | 2-5 KB | Recommendations |

**Total Workspace Size**: 30-90 KB (markdown text only, screenshots stored separately)

---

## Related Services

- **EnrichmentOrchestrator** - Populates files 1-8 (research data)
- **SearchAuditWorker** - Populates files 9-12 (test results)
- **ScratchpadReportGenerator** - Reads all files to generate final report
- **BrowserAutomation** - Captures screenshots referenced in file 10

---

## Configuration

Set custom base directory:

```typescript
const scratchpad = new ScratchpadManager(
  companyId,
  auditId,
  companyName,
  '/custom/path/scratchpads'  // Default: './scratchpads'
);
```

Environment variables:

```bash
# Keep scratchpad files after report generation
KEEP_SCRATCHPAD=true

# Custom scratchpad directory
SCRATCHPAD_BASE_DIR=/data/scratchpads
```

---

**Status**: ✅ Complete - Ready for Integration
**Next**: Integrate with EnrichmentOrchestrator and SearchAuditWorker
