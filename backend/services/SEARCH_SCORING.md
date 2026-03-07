# Search Audit Scoring Engine

## Overview

The Search Audit Scoring Engine calculates a comprehensive 10-dimension search quality score (0-10 scale) from browser test results. It provides weighted scoring, severity classification, and actionable findings with business impact analysis.

## Architecture

### Scoring Flow

```
Test Results (20 tests)
  ↓
10 Scoring Dimensions
  ↓
Weighted Average Calculation
  ↓
Overall Score (0-10)
  ↓
Findings Generation + Severity Classification
  ↓
Business Impact Analysis + Algolia Product Mapping
```

## 10 Scoring Dimensions

### 1. Relevance (15%)

**Tests**: 2c (Single-Word), 2d (Multi-Word), 2e (Product-Specific)

**Scoring**:
- 10 pts: Top result matches query exactly
- 7 pts: Top 3 results are relevant
- 4 pts: Some relevant results in top 10
- 0 pts: No relevant results

**Business Impact**: Poor relevance leads to 25-40% revenue loss from abandoned searches.

**Algolia Solution**: Algolia Relevance (textual, semantic, business rules)

---

### 2. Typo & Synonym Tolerance (15%)

**Tests**: 2f (Typo Handling), 2g (Synonym Handling)

**Scoring**:
- 10 pts: All typos/synonyms handled correctly
- 7 pts: Most typos/synonyms work
- 4 pts: Some handling present
- 0 pts: No tolerance

**Business Impact**: No typo tolerance means 10-15% of searches fail; missing synonyms loses 15-20% of matches.

**Algolia Solution**: Algolia Typo Tolerance, Algolia Synonyms

---

### 3. Federated Search (10%)

**Tests**: 2s (Federated Search)

**Scoring**:
- 10 pts: Search includes products + blog + help content
- 7 pts: Partial federation (2 sources)
- 4 pts: Basic cross-index search
- 0 pts: Single-index only

**Business Impact**: Informational queries return only products, increasing bounce rate.

**Algolia Solution**: Algolia Federated Search

---

### 4. SAYT / Autocomplete (10%)

**Tests**: 2m (SAYT/Autocomplete)

**Scoring**:
- 10 pts: Instant, relevant suggestions with categories
- 7 pts: Good suggestions, slight delay
- 4 pts: Basic suggestions
- 0 pts: No SAYT

**Business Impact**: No autocomplete increases search friction and time-to-result by 3-5 seconds.

**Algolia Solution**: Algolia Autocomplete

---

### 5. Facets & Filters (10%)

**Tests**: 2h (Query with Filters), 2o (Facet Interaction)

**Scoring**:
- 10 pts: Dynamic facets with accurate counts, multiple selections
- 7 pts: Static facets work correctly
- 4 pts: Basic facets present
- 0 pts: No facets

**Business Impact**: No facets means users can't narrow results, increasing time-to-purchase by 40%.

**Algolia Solution**: Algolia Facets, Algolia Dynamic Facets

---

### 6. Empty State Handling (10%)

**Tests**: 2k (Zero-Results Handling)

**Scoring**:
- 10 pts: Helpful suggestions, query relaxation, alternative products
- 7 pts: Basic message with suggestions
- 4 pts: Generic "no results" message
- 0 pts: No handling

**Business Impact**: Poor empty state increases bounce rate by 30-50%.

**Algolia Solution**: Algolia Query Suggestions

---

### 7. Semantic / NLP (10%)

**Tests**: 2i (Complex NLP Query)

**Scoring**:
- 10 pts: Understands natural language ("best tv under 1000")
- 7 pts: Partial understanding (extracts some intent)
- 4 pts: Keyword matching only
- 0 pts: No NLP

**Business Impact**: NLP queries failing means natural language searches return irrelevant results.

**Algolia Solution**: Algolia NLP

---

### 8. Dynamic Facets & Personalization (5%)

**Tests**: 2o (Facet Interaction), 2t (Search Analytics)

**Scoring**:
- 10 pts: Context-aware, personalized facets based on behavior
- 7 pts: Some personalization present
- 4 pts: Static experience for all users
- 0 pts: No personalization

**Business Impact**: Static experience reduces conversion by 10-15% vs. personalized.

**Algolia Solution**: Algolia Dynamic Facets, Algolia Personalization

---

### 9. Recommendations & Merchandising (10%)

**Tests**: 2q (PDP Recommendations)

**Scoring**:
- 10 pts: AI-powered, contextual recommendations with high relevance
- 7 pts: Basic recommendations (frequently bought together)
- 4 pts: Manual merchandising rules
- 0 pts: No recommendations

**Business Impact**: No recommendations loses 10-30% of upsell/cross-sell revenue.

**Algolia Solution**: Algolia Recommend

---

### 10. Search Intelligence (5%)

**Tests**: 2r (Recent Searches), 2t (Search Analytics)

**Scoring**:
- 10 pts: Full analytics, A/B testing, insights dashboard
- 7 pts: Basic analytics (top queries, no-results)
- 4 pts: Manual tracking
- 0 pts: No intelligence

**Business Impact**: No analytics means no visibility into search performance or optimization opportunities.

**Algolia Solution**: Algolia Analytics, Algolia Insights

---

## Overall Score Calculation

```typescript
overallScore =
  (Relevance × 0.15) +
  (Typo & Synonym × 0.15) +
  (Federated Search × 0.10) +
  (SAYT × 0.10) +
  (Facets × 0.10) +
  (Empty State × 0.10) +
  (Semantic/NLP × 0.10) +
  (Dynamic Facets × 0.05) +
  (Recommendations × 0.10) +
  (Search Intelligence × 0.05)
```

**Total**: 100% (weights sum to 1.0)

---

## Score Interpretation

| Score | Grade | Label | Description |
|-------|-------|-------|-------------|
| 8.0-10.0 | A | Excellent | Well-optimized search with minimal gaps. Focus on incremental improvements. |
| 6.0-7.9 | B | Good | Solid foundation with some areas for improvement. Address medium-priority gaps. |
| 4.0-5.9 | C | Fair | Basic functionality but significant gaps. Prioritize typo tolerance, NLP, SAYT. |
| 2.0-3.9 | D | Poor | Major deficiencies affecting satisfaction. Urgent overhaul needed. |
| 0.0-1.9 | F | Critical | Search is broken or severely lacking. Immediate action required - likely driving revenue loss. |

---

## Severity Classification

### Severity Logic

```typescript
if (score < 3 && baseSeverity === 'HIGH') → CRITICAL
if (score < 5 && baseSeverity === 'HIGH') → HIGH
if (score < 7) → MEDIUM
if (score >= 7) → LOW
```

### Base Severity by Test

| Test ID | Test Name | Base Severity |
|---------|-----------|---------------|
| 2a | Homepage Navigation | HIGH |
| 2c | Simple Query | HIGH |
| 2d | Multi-Word Query | HIGH |
| 2f | Typo Handling | HIGH |
| 2g | Synonym Handling | HIGH |
| 2i | NLP Query | HIGH |
| 2k | Zero-Results | HIGH |
| 2m | SAYT | HIGH |
| 2s | Federated Search | HIGH |
| 2b, 2e, 2h, 2j, 2l, 2o, 2q | Medium Tests | MEDIUM |
| 2n, 2p, 2r, 2t | Low Tests | LOW |

---

## Findings Generation

Each failed test generates a **Finding** with:

1. **Test ID** (e.g., "2c")
2. **Test Name** (e.g., "Simple Single-Word Query")
3. **Finding** (description of what failed)
4. **Severity** (CRITICAL, HIGH, MEDIUM, LOW)
5. **Evidence** (specific data from test)
6. **Screenshot Path** (visual proof)
7. **Business Impact** (revenue/conversion impact)
8. **Algolia Product** (recommended solution)

### Example Finding

```typescript
{
  testId: '2f',
  testName: 'Typo Handling',
  finding: 'Search fails when user types "headlamp" instead of "headlight"',
  severity: 'HIGH',
  evidence: 'Query "headlamp" returned 0 results, but "headlight" returned 23 results',
  screenshotPath: 'screenshots/2f-typo-headlamp.png',
  businessImpact: 'No typo tolerance means 10-15% of searches fail unnecessarily',
  algoliaProduct: 'Algolia Typo Tolerance'
}
```

---

## Usage

### Calculate Audit Score

```typescript
import { calculateAuditScore } from './search-audit-scoring';
import { SearchTestResult } from './search-test-library';

const testResults: SearchTestResult[] = [
  { testId: '2a', passed: true, score: 10, ... },
  { testId: '2b', passed: false, score: 3, finding: 'Empty search returns error', ... },
  // ... 18 more test results
];

const auditScore = await calculateAuditScore(
  'company-uuid',
  'audit-uuid',
  testResults
);

console.log('Overall Score:', auditScore.overallScore); // e.g., 6.2/10
console.log('Grade:', getScoreInterpretation(auditScore.overallScore).grade); // e.g., "B"
console.log('Critical Findings:', auditScore.findings.filter(f => f.severity === 'CRITICAL').length);
```

### Get Dimension Breakdown

```typescript
const dimensionScores = auditScore.dimensionScores;

dimensionScores.forEach(dim => {
  console.log(`${dim.dimension}: ${dim.score}/10 (${dim.weight * 100}% weight)`);
});

// Example output:
// Relevance: 7.3/10 (15% weight)
// Typo & Synonym Tolerance: 3.5/10 (15% weight) ← Critical gap
// Federated Search: 0.0/10 (10% weight) ← Missing entirely
```

### Format for Report

```typescript
import { formatDimensionScores, formatFindings } from './search-audit-scoring';

const dimensionTable = formatDimensionScores(auditScore.dimensionScores);
const findingsMarkdown = formatFindings(auditScore.findings);

// Output markdown for report
console.log(dimensionTable);
console.log(findingsMarkdown);
```

---

## Statistics

### Get Score Stats

```typescript
import { getScoreStats } from './search-audit-scoring';

const stats = getScoreStats(auditScore);

console.log(`Passed: ${stats.passedTests}/${stats.totalTests} (${stats.passRate.toFixed(1)}%)`);
console.log(`Critical: ${stats.criticalCount}, High: ${stats.highCount}`);
console.log(`Medium: ${stats.mediumCount}, Low: ${stats.lowCount}`);
```

### Get Interpretation

```typescript
import { getScoreInterpretation } from './search-audit-scoring';

const interpretation = getScoreInterpretation(6.2);

console.log(interpretation);
// {
//   grade: 'B',
//   label: 'Good',
//   description: 'Solid search foundation with some areas for improvement.',
//   action: 'Address medium-priority gaps to reach excellence.'
// }
```

---

## Database Persistence

### Store Score

```typescript
import { storeAuditScore } from './search-audit-scoring';

await storeAuditScore(auditScore);

// Stores:
// - audits.score (overall score)
// - audit_dimension_scores table (10 dimension rows)
```

### Retrieve Score

```typescript
import { getAuditScore } from './search-audit-scoring';

const storedScore = await getAuditScore('company-uuid', 'audit-uuid');

if (storedScore) {
  console.log('Retrieved score:', storedScore.overallScore);
}
```

---

## Test Mapping Reference

### Wave 1: Foundation (5 tests)
- **2a**: Homepage Navigation → Relevance
- **2b**: Empty Search Handling → Empty State
- **2c**: Simple Query → Relevance (PRIMARY)
- **2d**: Multi-Word Query → Relevance (PRIMARY)
- **2e**: Product-Specific Query → Relevance

### Wave 2: Intelligence (5 tests)
- **2f**: Typo Handling → Typo & Synonym (PRIMARY)
- **2g**: Synonym Handling → Typo & Synonym (PRIMARY)
- **2h**: Query with Filters → Facets (PRIMARY)
- **2i**: Complex NLP Query → Semantic/NLP (PRIMARY)
- **2j**: Brand-Specific Query → Merchandising

### Wave 3: Edge Cases (6 tests)
- **2k**: Zero-Results Handling → Empty State (PRIMARY)
- **2l**: Mobile View → Relevance
- **2m**: SAYT → SAYT (PRIMARY)
- **2n**: Sort Functionality → Facets
- **2o**: Facet Interaction → Facets + Dynamic Facets
- **2p**: Pagination → (not scored, UX only)

### Wave 4: Advanced (4 tests)
- **2q**: PDP Recommendations → Recommendations (PRIMARY)
- **2r**: Recent Searches → Search Intelligence
- **2s**: Federated Search → Federated Search (PRIMARY)
- **2t**: Search Analytics → Search Intelligence + Dynamic Facets

---

## Error Handling

### Missing Test Results

If a test is missing from results, it contributes 0 to its dimension:

```typescript
// If test 2f (typo) is missing, dimension score is:
// (0 + 2g_score) / 2 tests
```

### Invalid Scores

Scores are clamped to 0-10 range:

```typescript
// Negative scores → 0
// Scores > 10 → 10
```

### Weight Validation

On module load, weights are verified to sum to 1.0:

```typescript
const totalWeight = SCORING_DIMENSIONS.reduce((sum, dim) => sum + dim.weight, 0);
if (Math.abs(totalWeight - 1.0) > 0.01) {
  throw new Error(`Weights must sum to 1.0, got ${totalWeight}`);
}
```

---

## Best Practices

### 1. Run All 20 Tests

Scoring accuracy depends on running all 20 tests. Partial runs will skew dimension scores.

### 2. Use Screenshots for Evidence

Always capture screenshots for failed tests. Visual proof is critical for audit credibility.

### 3. Include Business Impact

Findings without business impact are less actionable. Always map test failures to revenue/conversion metrics.

### 4. Sort by Severity

Present findings in severity order (CRITICAL → HIGH → MEDIUM → LOW) for maximum impact.

### 5. Link to Algolia Products

Map each finding to a specific Algolia product/feature for clear next steps.

---

## Scoring Philosophy

### Why 0-10 Scale?

- **Intuitive**: Similar to school grades (A-F)
- **Granular**: 11 discrete values (0, 1, 2, ..., 10)
- **Weighted**: Dimensions combine into overall score
- **Actionable**: Clear threshold for "passing" (7+)

### Why These Weights?

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Relevance | 15% | Core search quality - most important |
| Typo/Synonym | 15% | Critical for user success - 25-35% of queries affected |
| Federated | 10% | Important for content-rich sites |
| SAYT | 10% | High user engagement, reduces friction |
| Facets | 10% | Core discovery feature |
| Empty State | 10% | Prevents abandonment (30-50% bounce rate) |
| Semantic/NLP | 10% | Growing trend (20-30% of queries) |
| Dynamic Facets | 5% | Advanced feature, smaller impact |
| Recommendations | 10% | High revenue impact (10-30% of sales) |
| Intelligence | 5% | Enabling feature, indirect impact |

**Total**: 100%

---

## Changelog

### v1.0.0 (2026-03-07)

- Initial implementation with 10 scoring dimensions
- Test mapping for 20 browser tests
- Severity classification (4 levels)
- Business impact analysis
- Algolia product mapping
- Markdown formatting functions
- Database persistence (placeholder)

---

## References

- [PHASE4_PLAN.md](../../PHASE4_PLAN.md) - Phase 4 architecture
- [search-test-library.ts](./search-test-library.ts) - Test implementations
- [screenshot-annotator.ts](./screenshot-annotator.ts) - Screenshot annotations
- [Search Audit Framework PDF](https://docs.google.com/document/d/...) - Original methodology

---

**Author**: Agent 2
**Date**: March 7, 2026
**Version**: 1.0.0
