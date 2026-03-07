# Scratchpad Report Generator Service

**Purpose**: Generate professional markdown reports from scratchpad files following the Algolia Search Audit skill format.

**File**: `backend/services/scratchpad-report-generator.ts`
**Lines**: ~1,000 lines
**Status**: ✅ Complete

---

## Overview

The Scratchpad Report Generator reads from 12 intermediate scratchpad files and synthesizes them into a comprehensive, professional markdown report. It follows the report structure from the `/algolia-search-audit` skill, including executive summary, strategic intelligence, findings, "In Their Own Words" section, ROI projections, and recommendations.

## Report Structure

```
# Algolia Search Audit - {Company Name}

1. Executive Summary
   - Overall score
   - Top 3-5 findings
   - Opportunity statement

2. Strategic Intelligence
   - Company context
   - Financial position
   - Technology stack
   - Market position
   - Strategic timing (Why Now?)

3. Search Audit Results
   - 10-dimension scoring table
   - Score interpretation

4. Key Findings
   - 🔴 Critical Gaps (Score < 4)
   - ⚠️ Opportunities (Score 4-6)
   - ✅ Strengths (Score 7+)

5. In Their Own Words
   - Executive quotes matched to findings
   - Strategy vs. execution gaps

6. ROI Projection
   - Current state metrics
   - Potential impact with Algolia
   - 3-year revenue projection

7. Competitor Landscape
   - Competitor list with search providers
   - Competitive analysis

8. Recommendations
   - Immediate actions (30-60 days)
   - Short-term (60-90 days)
   - Long-term (6-12 months)

9. Appendix
   - Test query strategy
   - Screenshot inventory
   - Detailed scoring breakdown

10. Bibliography
    - All sources cited in report
```

---

## Usage

### 1. Initialize Report Generator

```typescript
import { ScratchpadManager } from './services/scratchpad-manager';
import { ScratchpadReportGenerator } from './services/scratchpad-report-generator';

// Create scratchpad manager
const scratchpad = new ScratchpadManager(
  'company-uuid',
  'audit-uuid',
  'Costco Wholesale'
);

// Create report generator
const reportGen = new ScratchpadReportGenerator(scratchpad, {
  includeScreenshots: true,
  includeAppendix: true,
  includeROI: true,
  maxFindings: 10,
});
```

### 2. Generate Report

```typescript
const report = await reportGen.generateReport();

console.log(report.markdown);    // Full markdown report
console.log(report.outputPath);  // Path to saved report file
console.log(report.metadata);    // Metadata object
```

### 3. Report Metadata

```typescript
console.log(report.metadata);
// {
//   companyName: 'Costco Wholesale',
//   auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
//   generatedAt: Date,
//   sectionCount: 9,
//   wordCount: 5432,
//   citationCount: 78,
//   screenshotCount: 12
// }
```

---

## Configuration

### Report Configuration Options

```typescript
interface ReportConfig {
  includeScreenshots: boolean;  // Embed screenshot images (default: true)
  includeAppendix: boolean;     // Include appendix section (default: true)
  includeROI: boolean;          // Include ROI projection (default: true)
  maxFindings: number;          // Max findings to include (default: 10)
}
```

### Example Configurations

**Full Report** (Default):
```typescript
const reportGen = new ScratchpadReportGenerator(scratchpad, {
  includeScreenshots: true,
  includeAppendix: true,
  includeROI: true,
  maxFindings: 10,
});
```

**Executive Summary Only**:
```typescript
const reportGen = new ScratchpadReportGenerator(scratchpad, {
  includeScreenshots: false,
  includeAppendix: false,
  includeROI: false,
  maxFindings: 3,
});
```

**AE Briefing**:
```typescript
const reportGen = new ScratchpadReportGenerator(scratchpad, {
  includeScreenshots: true,
  includeAppendix: false,
  includeROI: true,
  maxFindings: 5,
});
```

---

## Report Sections in Detail

### 1. Executive Summary

**Purpose**: High-level overview for executives

**Data Sources**:
- File 1: Company Context
- File 11: Scoring
- File 9: Search Tests

**Content**:
- Overall search experience score (0-10)
- Score status (EXCELLENT/GOOD/FAIR/POOR)
- Top 3-5 critical findings
- Opportunity statement
- Bottom line recommendation

**Example**:
```markdown
## Executive Summary

**Overall Search Experience Score**: 4.4/10 (FAIR)

Costco Wholesale operates in the retail space. Our comprehensive search
audit reveals 3 critical gaps that are impacting conversion rates and
customer experience.

**Top 3 Findings**:
1. **Zero NLP Understanding** (CRITICAL) - Natural language queries return
   irrelevant results, frustrating customers
2. **No Product Recommendations** (CRITICAL) - Missing cross-sell and upsell
   opportunities worth $50M+ annually
3. **Poor Empty State Handling** (HIGH) - Zero-results page offers no
   alternatives or suggestions

**Opportunity**: With optimized search powered by Algolia, Costco Wholesale
can address these gaps and unlock significant revenue growth through improved
conversion rates and customer satisfaction.

**Bottom Line**: While functional, your search has 3 critical gaps that
represent significant opportunities for improvement.
```

### 2. Strategic Intelligence

**Purpose**: Context for timing and positioning

**Data Sources**:
- File 1: Company Context
- File 4: Financials
- File 2: Tech Stack
- File 3: Traffic
- File 8: Strategic Context

**Content**:
- Company overview (industry, business model, market position)
- Financial position (revenue, growth, margins)
- Technology stack (e-commerce platform, search provider, CMS)
- Market position (traffic, engagement)
- Strategic timing (trigger events, why now?)

### 3. Search Audit Results

**Purpose**: Detailed 10-dimension scoring

**Data Sources**:
- File 11: Scoring

**Content**:
- 10-dimension scoring table
- Overall score interpretation

**Scoring Dimensions**:
1. Relevance (15%)
2. Typo Tolerance (10%)
3. Synonym Detection (10%)
4. SAYT Quality (10%)
5. Facets (10%)
6. Empty State Handling (10%)
7. Semantic/NLP (10%)
8. Dynamic Facets & Personalization (10%)
9. Recommendations & Merchandising (10%)
10. Search Intelligence (5%)

### 4. Key Findings

**Purpose**: Detailed findings by severity

**Data Sources**:
- File 9: Search Tests
- File 11: Scoring

**Content**:
- Critical Gaps (🔴 Score < 4)
- Opportunities (⚠️ Score 4-6)
- Strengths (✅ Score 7+)

**Finding Format**:
```markdown
#### 1. Zero NLP Understanding (CRITICAL)

**Test**: NLP Query Test (test-2i)
**Evidence**: Query "best tv for gaming under 1000" returned insurance plans
instead of TVs

![Screenshot](screenshots/11-nlp-query.png)

**Business Impact**: Customers frustrated by irrelevant results, leading to
high bounce rates and lost conversions

**Algolia Solution**: Algolia NeuralSearch understands natural language and
intent, returning semantically relevant results
```

### 5. In Their Own Words

**Purpose**: Match executive quotes to audit findings (Strategy vs. Execution)

**Data Sources**:
- File 7: Investor Intelligence
- File 9: Search Tests

**Content**:
- Executive quotes from earnings calls, 10-Ks, etc.
- Matched to audit findings using keyword similarity
- Shows gap between what leadership says and what exists

**Example**:
```markdown
## In Their Own Words

**Strategy vs. Execution**: What the leadership says vs. what we found.

> "We're investing heavily in our digital experience to drive member
> satisfaction and conversion."
> — Ron Vachris, CEO, [Q4 2025 Earnings Call](url), Dec 12, 2025

**What we found**: Zero product recommendations on PDPs, missing cross-sell
opportunities worth $50M+ annually

**The gap**: Leadership commits to digital experience, but basic merchandising
features are missing

**Algolia solution**: Algolia Recommend provides AI-powered product
recommendations that increase AOV by 15-25%
```

### 6. ROI Projection

**Purpose**: Quantify business impact

**Data Sources**:
- File 4: Financials
- File 3: Traffic
- File 11: Scoring

**Content**:
- Current state metrics (revenue, traffic, bounce rate, conversion rate)
- Potential impact with Algolia (conversion lift, bounce reduction, AOV increase)
- 3-year revenue projection

**ROI Calculation Logic**:
```typescript
const gap = maxScore (10) - currentScore;
const liftFactor = gap / maxScore; // 0-1 range

const expectedLift = {
  conversion: 15 + (liftFactor * 10),  // 15-25%
  bounce: 10 + (liftFactor * 10),      // 10-20%
  aov: 5 + (liftFactor * 5),           // 5-10%
};
```

### 7. Competitor Landscape

**Purpose**: Competitive positioning

**Data Sources**:
- File 5: Competitors

**Content**:
- Competitor list with domains
- Search providers used by competitors
- Affinity scores
- Competitive analysis

### 8. Recommendations

**Purpose**: Actionable next steps

**Data Sources**:
- File 12: Recommendations
- File 9: Search Tests

**Content**:
- Immediate actions (30-60 days)
- Short-term (60-90 days)
- Long-term (6-12 months)

### 9. Appendix

**Purpose**: Supporting details

**Data Sources**:
- File 9: Search Tests
- File 10: Screenshots
- File 11: Scoring

**Content**:
- Test query strategy
- Screenshot inventory
- Detailed scoring breakdown

---

## Data Parsing

The report generator parses structured data from markdown scratchpad files:

### Parsing Methods

```typescript
// Extract field value
this.extractField(content, 'Company');  // Returns: "Costco Wholesale"

// Extract section
this.extractSection(content, 'Summary');  // Returns: full section content

// Extract list
this.extractList(content, 'Immediate Actions');  // Returns: array of items

// Extract competitor list
this.extractCompetitorList(content);  // Returns: array of competitor objects

// Extract executive quotes
this.extractExecutiveQuotes(content);  // Returns: array of quote objects

// Extract trigger events
this.extractTriggerEvents(content);  // Returns: array of event objects

// Extract findings
this.extractFindings(content);  // Returns: array of finding objects

// Extract scoring dimensions
this.extractScoringDimensions(content);  // Returns: array of dimension objects
```

### Markdown Parsing Patterns

**Field Extraction**:
```markdown
**Company**: Costco Wholesale
**Industry**: Retail
```
→ `extractField(content, 'Company')` → `"Costco Wholesale"`

**Section Extraction**:
```markdown
### Summary

This is the summary content...

### Next Section
```
→ `extractSection(content, 'Summary')` → `"This is the summary content..."`

**List Extraction**:
```markdown
### Immediate Actions

- Action 1
- Action 2
- Action 3
```
→ `extractList(content, 'Immediate Actions')` → `[{description: 'Action 1'}, ...]`

**Quote Extraction**:
```markdown
> "Quote text"
> — Speaker Name, Title, [Source](url), Date
```
→ `extractExecutiveQuotes(content)` → `[{quote, speaker, title, source, sourceUrl, sourceDate}]`

---

## Quote-Finding Matching Algorithm

The "In Their Own Words" section uses keyword similarity to match executive quotes to audit findings:

```typescript
private calculateRelevance(quote: string, finding: string): number {
  const quoteWords = new Set(quote.toLowerCase().match(/\b\w+\b/g) || []);
  const findingWords = new Set(finding.toLowerCase().match(/\b\w+\b/g) || []);

  const intersection = new Set(
    Array.from(quoteWords).filter(word => findingWords.has(word))
  );

  const union = new Set([
    ...Array.from(quoteWords),
    ...Array.from(findingWords)
  ]);

  return Math.round((intersection.size / union.size) * 100);  // 0-100
}
```

**Threshold**: Relevance score > 30 is considered a match

**Top Matches**: Returns top 5 matches sorted by relevance score

---

## Score Interpretation

```typescript
private getScoreStatus(score: number): string {
  if (score >= 8) return 'EXCELLENT';
  if (score >= 6) return 'GOOD';
  if (score >= 4) return 'FAIR';
  return 'POOR';
}

private interpretScore(score: number): string {
  if (score >= 8) {
    return 'Your search experience is best-in-class with strong fundamentals
            across all dimensions.';
  } else if (score >= 6) {
    return 'Your search experience is above average but has room for
            optimization in key areas.';
  } else if (score >= 4) {
    return 'Your search experience has significant gaps that are likely
            impacting conversion rates and user satisfaction.';
  }
  return 'Your search experience has critical gaps that are severely impacting
          business metrics and user experience.';
}
```

---

## Screenshot Embedding

```markdown
![Screenshot](screenshots/11-nlp-query.png)
```

Screenshots are referenced with **relative paths** from the report directory.

**Screenshot Directory Structure**:
```
scratchpads/
├── {companyId}/
│   └── {auditId}/
│       ├── screenshots/
│       │   ├── 01-homepage.png
│       │   ├── 02-search-box.png
│       │   ├── 03-sayt.png
│       │   └── ...
│       └── {company}-search-audit-report.md
```

---

## Citation Format

All data points are hyperlinked to sources:

```markdown
**Revenue**: [$254B](https://finance.yahoo.com/quote/COST)
**Traffic**: [2.5M monthly visits](https://www.similarweb.com/website/costco.com)
```

**Bibliography Section**:
```markdown
## Bibliography

All data points in this report are sourced and hyperlinked. Sources include:

- **SimilarWeb** - Traffic & engagement data
- **BuiltWith** - Technology stack analysis
- **Yahoo Finance** - Financial data
- **SEC Edgar** - 10-K, 10-Q filings
- **Company website** - Screenshots, product catalog
- **Apify** - Hiring signals, social data
- **Apollo.io** - Buying committee, intent signals
```

---

## Output Files

### Report File

**Path**: `scratchpads/{companyId}/{auditId}/{company}-search-audit-report.md`

**Size**: 15-40 KB (text only)

**Format**: Markdown with embedded screenshots (relative paths)

### Report Metadata

```typescript
{
  companyName: 'Costco Wholesale',
  auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  generatedAt: Date,
  sectionCount: 9,
  wordCount: 5432,
  citationCount: 78,
  screenshotCount: 12
}
```

---

## Testing

```typescript
import { ScratchpadManager } from './services/scratchpad-manager';
import { ScratchpadReportGenerator } from './services/scratchpad-report-generator';

describe('ScratchpadReportGenerator', () => {
  let scratchpad: ScratchpadManager;
  let reportGen: ScratchpadReportGenerator;

  beforeEach(async () => {
    scratchpad = new ScratchpadManager(
      'test-company',
      'test-audit',
      'Test Company',
      './test-scratchpads'
    );
    await scratchpad.initialize();

    // Populate scratchpad files with test data
    await scratchpad.createFile(1, 'company-context', mockCompanyContext);
    await scratchpad.createFile(11, 'scoring', mockScoring);
    await scratchpad.createFile(9, 'search-tests', mockSearchTests);
    // ... populate other files

    reportGen = new ScratchpadReportGenerator(scratchpad);
  });

  afterEach(async () => {
    await scratchpad.cleanup();
  });

  it('should generate complete report', async () => {
    const report = await reportGen.generateReport();
    expect(report.markdown).toBeDefined();
    expect(report.markdown).toContain('# Algolia Search Audit');
    expect(report.metadata.sectionCount).toBeGreaterThan(0);
  });

  it('should include executive summary', async () => {
    const report = await reportGen.generateReport();
    expect(report.markdown).toContain('## Executive Summary');
    expect(report.markdown).toContain('Overall Search Experience Score');
  });

  it('should include 10-dimension scoring', async () => {
    const report = await reportGen.generateReport();
    expect(report.markdown).toContain('## Search Audit Results');
    expect(report.markdown).toContain('| Dimension | Score | Status |');
  });

  it('should match quotes to findings', async () => {
    const report = await reportGen.generateReport();
    expect(report.markdown).toContain('## In Their Own Words');
  });

  it('should calculate ROI projection', async () => {
    const report = await reportGen.generateReport();
    expect(report.markdown).toContain('## ROI Projection');
    expect(report.markdown).toContain('3-Year Projection');
  });

  it('should save report to file', async () => {
    const report = await reportGen.generateReport();
    expect(report.outputPath).toBeDefined();
    const exists = await fs.access(report.outputPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});
```

---

## Integration with Audit Workflow

```typescript
// Phase 1: Research (populate scratchpad files 1-8)
const scratchpad = new ScratchpadManager(companyId, auditId, companyName);
await scratchpad.initialize();

// Enrichment workers populate files
await enrichmentOrchestrator.run(companyId, auditId, scratchpad);

// Phase 2: Browser Testing (populate scratchpad files 9-12)
await searchAuditWorker.run(companyId, auditId, scratchpad);

// Phase 3: Report Generation
const reportGen = new ScratchpadReportGenerator(scratchpad);
const report = await reportGen.generateReport();

// Store report in database
await db.upsert('audit_deliverables', {
  company_id: companyId,
  audit_id: auditId,
  deliverable_type: 'report',
  format: 'markdown',
  content: report.markdown,
  generated_at: new Date(),
});

// Cleanup (optional)
if (process.env.KEEP_SCRATCHPAD !== 'true') {
  await scratchpad.cleanup();
}
```

---

## Related Services

- **ScratchpadManager** - Creates and manages scratchpad files
- **EnrichmentOrchestrator** - Populates scratchpad files 1-8
- **SearchAuditWorker** - Populates scratchpad files 9-12
- **ReportGenerator** (database-based) - Alternative approach using database queries

---

## Future Enhancements

1. **PDF Generation**: Convert markdown to PDF using Puppeteer
2. **HTML Landing Page**: Generate interactive HTML version
3. **PowerPoint Deck**: Generate McKinsey Pyramid deck (30-33 slides)
4. **AE Pre-Call Brief**: Generate AE-facing brief
5. **Executive Summary**: Generate 1-page standalone summary
6. **Content Spec**: Generate landing page content spec

---

**Status**: ✅ Complete - Ready for Integration
**Next**: Integrate with SearchAuditWorker and EnrichmentOrchestrator
