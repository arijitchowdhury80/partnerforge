# Phase 4: Search Audit Workers - Detailed Plan

**Status**: 🎯 PLANNING
**Target Date**: March 8-10, 2026
**Estimated Time**: 10-12 hours (parallelized with 4 agents)
**Dependencies**: Phase 1 (Browser Automation), Phase 3 (Scoring System)

---

## 📋 Overview

Phase 4 builds the core search audit execution system - the browser-based testing, scoring, and reporting that makes Algolia Arian a comprehensive search audit platform.

**Key Principle**: Mirrors the `/algolia-search-audit` skill methodology but adapted for a web application with database persistence and real-time updates.

---

## 🎯 Success Criteria

- [ ] 20 browser tests implemented and working
- [ ] 10-dimension scoring algorithm calculates accurate scores
- [ ] Report generation creates professional markdown reports
- [ ] Screenshot annotation auto-detects issues
- [ ] Real-time WebSocket progress updates working
- [ ] All data persisted to `search_audit_tests` and `search_audit_screenshots` tables
- [ ] TypeScript compiles with 0 errors
- [ ] Integration tests passing

---

## 🏗️ Architecture

### Component Structure

```
backend/
├── services/
│   ├── search-test-library.ts          # 20 browser test implementations
│   ├── search-scoring.ts               # 10-dimension scoring algorithm
│   ├── screenshot-annotator.ts         # Screenshot annotation engine
│   ├── report-generator.ts             # Markdown report generator
│   └── scratchpad-manager.ts           # Scratchpad workspace manager
├── workers/
│   └── search-audit-worker.ts          # Main audit orchestrator (UPDATE)
└── tests/
    ├── search-test-library.test.ts     # Unit tests for tests
    └── search-scoring.test.ts          # Unit tests for scoring
```

### Data Flow

```
Audit Request
  ↓
Search Audit Worker
  ↓
Wave 1: Basic Tests (Homepage, Search Box, SAYT) ← WebSocket Progress
  ↓
Wave 2: Core Search Tests (Relevance, Typos, Synonyms) ← WebSocket Progress
  ↓
Wave 3: Advanced Tests (NLP, Federated, Facets) ← WebSocket Progress
  ↓
Wave 4: Mobile & Intelligence Tests ← WebSocket Progress
  ↓
Screenshot Annotation
  ↓
10-Dimension Scoring
  ↓
Scratchpad Creation (12 files)
  ↓
Report Generation
  ↓
Database Persistence (search_audit_tests, search_audit_screenshots)
  ↓
Return Complete Audit Result
```

---

## 🔧 Component 1: Search Test Library

**File**: `backend/services/search-test-library.ts`
**Estimated Lines**: ~1,500 lines
**Purpose**: 20 specific browser test implementations

### Test Catalog (20 tests)

#### Wave 1: Foundation Tests (5 tests)
1. **Homepage Load** - Verify homepage loads and search box is present
2. **Search Box Visibility** - Check search box is visible and functional
3. **SAYT Basic** - Test search-as-you-type shows suggestions
4. **First Search** - Execute first search and verify results appear
5. **Results Count** - Verify result count displayed

#### Wave 2: Core Search Quality (5 tests)
6. **Relevance Test** - Test product name search returns exact match first
7. **Typo Handling** - Test common typos (e.g., "headlamp" vs "headlight")
8. **Synonym Detection** - Test synonyms return same results
9. **Stop Words** - Test stop words handled correctly
10. **Special Characters** - Test searches with &, %, @, etc.

#### Wave 3: Advanced Features (5 tests)
11. **NLP Query** - Test natural language ("best tv for gaming under 1000")
12. **Federated Search** - Test if help/blog content appears in results
13. **Facets** - Test facet filtering and counts
14. **Sort Options** - Test sort by price, rating, popularity
15. **Empty State** - Test zero-results handling

#### Wave 4: Intelligence & Mobile (5 tests)
16. **Mobile Responsiveness** - Test search on mobile viewport
17. **Personalization** - Test if results change based on behavior
18. **Recommendations** - Test if product page shows recommendations
19. **Search Analytics** - Test if search events tracked
20. **Algolia Detection** - Test if Algolia is in use (network requests)

### Test Interface

```typescript
export interface SearchTest {
  id: string;
  name: string;
  description: string;
  wave: number;
  execute: (page: Page, domain: string, context: TestContext) => Promise<TestResult>;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'warning';
  score: number; // 0-10
  duration: number; // ms
  screenshots: Screenshot[];
  findings: string[];
  evidence: {
    type: 'element' | 'network' | 'console' | 'metric';
    description: string;
    value: any;
  }[];
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
```

---

## 🔧 Component 2: Screenshot Annotation Engine

**File**: `backend/services/screenshot-annotator.ts`
**Estimated Lines**: ~600 lines
**Purpose**: Auto-detect issues in screenshots and add visual annotations

### Features

1. **Issue Detection Rules**:
   - Empty results area (no products found)
   - Typo in search input (red underline)
   - Poor relevance (wrong product type in top 3)
   - Missing SAYT dropdown
   - Broken facets (zero counts)
   - Slow load time (loading spinner)

2. **Annotation Types**:
   - **Red Box**: Critical issues (empty state, broken feature)
   - **Yellow Box**: Warnings (poor relevance, slow load)
   - **Green Box**: Good examples (correct behavior)
   - **Arrows**: Point to specific elements
   - **Text Labels**: Describe what's wrong/right

3. **Canvas Manipulation**:
   - Use `sharp` library for image processing
   - Draw boxes, arrows, and text on screenshots
   - Save annotated versions with `-annotated` suffix

### Interface

```typescript
export interface AnnotatorOptions {
  detectEmptyState?: boolean;
  detectTypos?: boolean;
  detectPoorRelevance?: boolean;
  detectSlowLoad?: boolean;
}

export async function annotateScreenshot(
  screenshotPath: string,
  testResult: TestResult,
  options?: AnnotatorOptions
): Promise<string> {
  // Returns path to annotated screenshot
}
```

---

## 🔧 Component 3: 10-Dimension Scoring Algorithm

**File**: `backend/services/search-scoring.ts`
**Estimated Lines**: ~800 lines
**Purpose**: Calculate 10-dimension search quality scores

### Scoring Dimensions (0-10 each)

1. **Relevance** (Weight: 15%)
   - Top result matches query (10 pts)
   - Top 3 relevant (7 pts)
   - Some relevant in top 10 (4 pts)
   - No relevant results (0 pts)

2. **Typo Tolerance** (Weight: 10%)
   - All typos handled (10 pts)
   - Most typos handled (7 pts)
   - Some typos handled (4 pts)
   - No typo handling (0 pts)

3. **Synonym Detection** (Weight: 10%)
   - All synonyms return same results (10 pts)
   - Most synonyms work (7 pts)
   - Some synonyms work (4 pts)
   - No synonym detection (0 pts)

4. **SAYT Quality** (Weight: 10%)
   - Instant, relevant suggestions (10 pts)
   - Good suggestions, slight delay (7 pts)
   - Basic suggestions (4 pts)
   - No SAYT (0 pts)

5. **Facets** (Weight: 10%)
   - Dynamic facets with accurate counts (10 pts)
   - Static facets work (7 pts)
   - Basic facets (4 pts)
   - No facets (0 pts)

6. **Empty State Handling** (Weight: 10%)
   - Helpful suggestions, alternatives (10 pts)
   - Basic message (7 pts)
   - Generic message (4 pts)
   - No handling (0 pts)

7. **Semantic/NLP** (Weight: 10%)
   - Understands natural language (10 pts)
   - Partial understanding (7 pts)
   - Keyword matching only (4 pts)
   - No NLP (0 pts)

8. **Dynamic Facets & Personalization** (Weight: 10%)
   - Context-aware, personalized (10 pts)
   - Some personalization (7 pts)
   - Static experience (4 pts)
   - No personalization (0 pts)

9. **Recommendations & Merchandising** (Weight: 10%)
   - AI-powered, relevant recs (10 pts)
   - Basic recs (7 pts)
   - Manual merchandising (4 pts)
   - No recs (0 pts)

10. **Search Intelligence** (Weight: 5%)
    - Analytics, A/B testing, insights (10 pts)
    - Basic analytics (7 pts)
    - Manual tracking (4 pts)
    - No intelligence (0 pts)

### Overall Score Calculation

```typescript
const overallScore =
  (relevance * 0.15) +
  (typoTolerance * 0.10) +
  (synonymDetection * 0.10) +
  (saytQuality * 0.10) +
  (facets * 0.10) +
  (emptyState * 0.10) +
  (semanticNLP * 0.10) +
  (dynamicFacets * 0.10) +
  (recommendations * 0.10) +
  (searchIntelligence * 0.05);
```

### Score to Status Mapping

- **8.0-10.0**: EXCELLENT (Best-in-class search)
- **6.0-7.9**: GOOD (Above average)
- **4.0-5.9**: FAIR (Room for improvement)
- **0.0-3.9**: POOR (Critical gaps)

---

## 🔧 Component 4: Scratchpad Manager

**File**: `backend/services/scratchpad-manager.ts`
**Estimated Lines**: ~400 lines
**Purpose**: Create and manage 12 intermediate scratchpad files

### Scratchpad Files (12 files)

1. `01-company-context.md` - Company overview, industry, vertical
2. `02-tech-stack.md` - Technology stack from BuiltWith
3. `03-traffic.md` - Traffic analysis from SimilarWeb
4. `04-financials.md` - Financial data from Yahoo Finance
5. `05-competitors.md` - Competitor analysis
6. `06-hiring.md` - Hiring signals from Apify
7. `07-intel.md` - Investor intelligence (10-K, earnings calls)
8. `08-strategic.md` - Strategic angles and trigger events
9. `09-search-tests.md` - Search test results summary
10. `10-screenshots.md` - Screenshot inventory with annotations
11. `11-scoring.md` - 10-dimension scores breakdown
12. `12-recommendations.md` - Algolia value prop recommendations

### Interface

```typescript
export class ScratchpadManager {
  private outputDir: string;
  private companyName: string;
  private auditId: string;

  async createFile(fileNumber: number, fileName: string, content: string): Promise<string>;
  async updateFile(fileNumber: number, content: string): Promise<void>;
  async getFile(fileNumber: number): Promise<string>;
  async getAllFiles(): Promise<Record<number, string>>;
  async cleanup(): Promise<void>;
}
```

---

## 🔧 Component 5: Report Generator

**File**: `backend/services/report-generator.ts`
**Estimated Lines**: ~1,000 lines
**Purpose**: Generate professional markdown report from scratchpad files

### Report Structure

```markdown
# Algolia Search Audit - {Company Name}

**Audit Date**: {Date}
**Audit ID**: {UUID}
**Overall Score**: {Score}/10 ({Status})

---

## Executive Summary

[One-paragraph summary of key findings and recommendations]

---

## Strategic Intelligence

### Company Context
[From 01-company-context.md]

### Financial Position
[From 04-financials.md - Key metrics]

### Technology Stack
[From 02-tech-stack.md - Key technologies]

### Market Position
[From 03-traffic.md - Traffic trends]

### Strategic Timing
[From 08-strategic.md - Trigger events]

---

## Search Audit Results

### Overall Score: {Score}/10

| Dimension | Score | Status | Key Findings |
|-----------|-------|--------|-------------|
| Relevance | X/10 | ✅/⚠️/❌ | ... |
| Typo Tolerance | X/10 | ✅/⚠️/❌ | ... |
| ... | ... | ... | ... |

---

## Key Findings

### 🔴 Critical Gaps (Score < 4)

#### 1. {Finding Title}
**Dimension**: {Dimension}
**Score**: {Score}/10
**Impact**: {Business Impact}

![Screenshot]({screenshot-path})

**What We Found**:
- {Finding 1}
- {Finding 2}
- {Finding 3}

**Why It Matters**:
{Impact on business metrics - conversions, revenue, UX}

**Algolia Solution**:
{Specific Algolia feature/capability}

---

### ⚠️ Opportunities (Score 4-6)

[Same format as Critical Gaps]

---

### ✅ Strengths (Score 7+)

[Same format as Critical Gaps]

---

## ROI Projection

### Current State
- Monthly traffic: {X}M visits
- Bounce rate: {X}%
- Avg. session duration: {X} min

### Potential Impact with Algolia
- 15-25% reduction in bounce rate → {$X}M recovered revenue
- 10-20% increase in conversions → {$X}M additional revenue
- 30-40% faster search → {X}% improved customer satisfaction

**Total Annual Impact**: ${X}M - ${Y}M

---

## Competitor Landscape

[From 05-competitors.md]

| Competitor | Search Provider | Score Estimate | Notes |
|------------|----------------|---------------|-------|
| {Competitor 1} | {Provider} | X/10 | ... |

---

## Recommendations

### Immediate Actions (30-60 days)
1. {Recommendation 1}
2. {Recommendation 2}

### Short-Term (60-90 days)
1. {Recommendation 1}
2. {Recommendation 2}

### Long-Term (6-12 months)
1. {Recommendation 1}
2. {Recommendation 2}

---

## Appendix

### Test Query Strategy
[From 09-search-tests.md]

### Screenshot Inventory
[From 10-screenshots.md]

### Detailed Scoring Breakdown
[From 11-scoring.md]

---

**Generated by Algolia Arian**
**Report ID**: {audit_id}
**Generated**: {timestamp}
```

### Interface

```typescript
export async function generateReport(
  auditId: string,
  companyId: string,
  scratchpadDir: string
): Promise<string> {
  // Returns markdown report string
}

export async function saveReport(
  report: string,
  outputPath: string
): Promise<void> {
  // Saves to filesystem
}
```

---

## 🔧 Component 6: Worker Integration

**File**: `backend/workers/search-audit-worker.ts` (UPDATE)
**Changes**: Integrate all Phase 4 components

### Integration Points

1. **Import All Components**:
```typescript
import { SearchTestLibrary } from '../services/search-test-library';
import { SearchScoring } from '../services/search-scoring';
import { ScreenshotAnnotator } from '../services/screenshot-annotator';
import { ReportGenerator } from '../services/report-generator';
import { ScratchpadManager } from '../services/scratchpad-manager';
```

2. **Execute Tests in Waves**:
```typescript
async function executeSearchAudit(job: Job) {
  const { auditId, companyId, domain } = job.data;

  // Initialize
  const testLibrary = new SearchTestLibrary();
  const scratchpad = new ScratchpadManager(outputDir, companyName, auditId);

  // Wave 1: Foundation
  const wave1Results = await testLibrary.executeWave(1, page, domain);
  emitProgress(auditId, 1, 'Foundation Tests', 'completed', 20);

  // Wave 2: Core Search
  const wave2Results = await testLibrary.executeWave(2, page, domain);
  emitProgress(auditId, 2, 'Core Search Tests', 'completed', 40);

  // Wave 3: Advanced
  const wave3Results = await testLibrary.executeWave(3, page, domain);
  emitProgress(auditId, 3, 'Advanced Tests', 'completed', 60);

  // Wave 4: Intelligence
  const wave4Results = await testLibrary.executeWave(4, page, domain);
  emitProgress(auditId, 4, 'Intelligence Tests', 'completed', 80);

  // Annotate screenshots
  const annotator = new ScreenshotAnnotator();
  for (const result of allResults) {
    await annotator.annotateScreenshot(result.screenshots);
  }

  // Calculate scores
  const scores = await SearchScoring.calculateScores(allResults);

  // Create scratchpad files
  await scratchpad.createFile(9, 'search-tests.md', formatTestResults(allResults));
  await scratchpad.createFile(11, 'scoring.md', formatScores(scores));

  // Generate report
  const report = await ReportGenerator.generate(auditId, companyId, scratchpadDir);

  // Persist to database
  await persistTestResults(auditId, allResults);
  await persistScreenshots(auditId, allResults);

  emitProgress(auditId, 5, 'Report Generation', 'completed', 100);
}
```

---

## 🧪 Testing Strategy

### Unit Tests

1. **search-test-library.test.ts** (~300 lines)
   - Test each of 20 tests individually
   - Mock Playwright page object
   - Verify test results structure

2. **search-scoring.test.ts** (~200 lines)
   - Test scoring algorithm with known inputs
   - Edge cases (all 0s, all 10s, mixed)
   - Overall score calculation

3. **screenshot-annotator.test.ts** (~150 lines)
   - Test annotation logic
   - Mock image files
   - Verify output files created

### Integration Tests

1. **full-audit.test.ts** (~200 lines)
   - End-to-end audit on test domain
   - Verify all 20 tests execute
   - Verify report generated
   - Verify database persistence

---

## 📦 Dependencies

### New NPM Packages

```json
{
  "sharp": "^0.33.0",          // Image processing for annotations
  "canvas": "^2.11.2",         // Canvas API for drawing
  "marked": "^11.0.0"          // Markdown parsing (if needed)
}
```

### Install

```bash
npm install sharp canvas marked
```

---

## 🚀 Execution Plan (4 Parallel Agents)

### Agent 1: Search Test Library
**Files**: `search-test-library.ts` + tests
**Time**: ~4 hours
**Deliverable**: 20 tests implemented and tested

### Agent 2: Scoring & Annotation
**Files**: `search-scoring.ts`, `screenshot-annotator.ts` + tests
**Time**: ~3 hours
**Deliverable**: Scoring algorithm and annotation engine

### Agent 3: Scratchpad & Reports
**Files**: `scratchpad-manager.ts`, `report-generator.ts` + tests
**Time**: ~3 hours
**Deliverable**: Report generation system

### Agent 4: Worker Integration
**Files**: `search-audit-worker.ts` (updates) + integration tests
**Time**: ~2 hours (depends on Agents 1-3)
**Deliverable**: Fully integrated search audit worker

### Timeline

```
Hour 0:   Launch Agents 1-3 in parallel
Hour 3-4: Agents 2-3 complete
Hour 4:   Agent 1 completes
Hour 4:   Launch Agent 4 (integration)
Hour 6:   Agent 4 completes
Hour 6-7: Documentation, testing, commit
```

**Total**: ~7 hours with parallelization

---

## 📚 Documentation Updates

### Files to Update

1. **PHASE4_COMPLETE.md** (NEW)
   - Complete summary of Phase 4 work
   - Component breakdown
   - Test catalog
   - Scoring dimensions

2. **backend/README.md** (UPDATE)
   - Add Phase 4 section
   - Update completion: 85% → 95%

3. **memory/MEMORY.md** (UPDATE)
   - Update current status to Phase 4 COMPLETE
   - Add Phase 4 summary

4. **README.md** (UPDATE)
   - Update project status
   - Add Phase 4 milestone

5. **Service Documentation** (4 NEW files)
   - `backend/services/SEARCH_TEST_LIBRARY.md` - Test catalog reference
   - `backend/services/SEARCH_SCORING.md` - Scoring algorithm guide
   - `backend/services/SCREENSHOT_ANNOTATOR.md` - Annotation guide
   - `backend/services/REPORT_GENERATOR.md` - Report generation guide

---

## 🎯 Acceptance Criteria

- [ ] All 20 browser tests implemented
- [ ] Tests can be executed individually or in waves
- [ ] 10-dimension scoring algorithm working
- [ ] Screenshots annotated with issue detection
- [ ] Scratchpad files created (12 files)
- [ ] Professional markdown report generated
- [ ] All data persisted to database
- [ ] Real-time WebSocket updates working
- [ ] TypeScript compiles with 0 errors
- [ ] Unit tests passing (50+ tests)
- [ ] Integration test passing
- [ ] Documentation complete
- [ ] Git committed with proper message

---

## 📝 Git Commit Message Template

```
feat: Phase 4 - Search Audit Workers

Complete browser-based search audit execution system with 20 tests,
10-dimension scoring, screenshot annotation, and report generation.

## Summary
- 4 major components built in parallel
- 5 files created, 1 file updated (~3,800 lines)
- 20 browser tests, 10 scoring dimensions
- Scratchpad workspace (12 files) + Report generator
- Full integration with existing workers

## Component 1: Search Test Library
**Created**: backend/services/search-test-library.ts (1,500 lines)
- 20 browser tests in 4 waves
- Homepage, SAYT, Relevance, Typos, Synonyms, NLP, Federated Search, Facets, etc.
- Returns TestResult with screenshots, findings, evidence

## Component 2: Scoring & Annotation
**Created**: backend/services/search-scoring.ts (800 lines)
**Created**: backend/services/screenshot-annotator.ts (600 lines)
- 10-dimension scoring algorithm (Relevance, Typos, SAYT, Facets, etc.)
- Auto-detect issues in screenshots (empty state, typos, poor relevance)
- Canvas-based annotation (boxes, arrows, labels)

## Component 3: Scratchpad & Reports
**Created**: backend/services/scratchpad-manager.ts (400 lines)
**Created**: backend/services/report-generator.ts (1,000 lines)
- 12 scratchpad files (company context, tests, scores, recommendations)
- Professional markdown report (Executive Summary, Findings, ROI, Recommendations)

## Component 4: Worker Integration
**Updated**: backend/workers/search-audit-worker.ts (+300 lines)
- Integrated all Phase 4 components
- Wave-based test execution with WebSocket progress
- Database persistence for test results and screenshots

## Testing
- 50+ unit tests across 5 test files
- Integration test for full audit workflow
- All tests passing

## Documentation
- PHASE4_COMPLETE.md - Complete milestone summary
- 4 service documentation files
- Updated backend/README.md, memory/MEMORY.md

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

**Plan Status**: ✅ COMPLETE
**Ready for Execution**: YES
**Next Step**: Launch 4 parallel agents

