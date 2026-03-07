# Composite Scoring Service

**Purpose**: Calculate Fit, Intent, Value, and Displacement scores for enriched companies

**Location**: `backend/services/scoring.ts`

**Status**: ✅ Complete (March 7, 2026)

---

## Overview

The Composite Scoring Service evaluates companies across four dimensions to determine their value as displacement opportunities for Algolia. Each dimension contributes 25% to the overall score (0-100), which determines the company's status:

- **70-100**: HOT (ready for outreach)
- **40-69**: WARM (nurture pipeline)
- **0-39**: COLD (low priority)

---

## Scoring Dimensions

### 1. Fit Score (25% weight)

**Measures**: How well the company matches Algolia's ICP

| Factor | Max Points | Criteria |
|--------|-----------|----------|
| Industry match | 25 | Target verticals (ecommerce, SaaS, media): +25<br>Non-target: +10 |
| Company size | 20 | 1000-10000 employees: +20 (sweet spot)<br>>10000: +15<br>100-1000: +10 |
| Geography | 15 | US/Europe: +15<br>Other: +10 |
| Public vs Private | 15 | Public: +15<br>Private: +10 |
| Revenue range | 20 | >$1B: +20<br>$100M-$1B: +15<br>$10M-$100M: +10 |

**Data Sources**:
- `companies` table (industry, employee_count, headquarters_country, is_public, annual_revenue)

**Example**:
```typescript
{
  score: 85.0,
  breakdown: [
    "Target vertical (ecommerce): +25",
    "Mid-market sweet spot (5,000 employees): +20",
    "Prime geography (US): +15",
    "Public company (EXMP): +15",
    "Mid-market revenue (500M): +15"
  ]
}
```

---

### 2. Intent Score (25% weight)

**Measures**: Buying signals and urgency

| Factor | Max Points | Criteria |
|--------|-----------|----------|
| Monthly traffic | 20 | >10M: +20<br>1M-10M: +15<br>100K-1M: +10 |
| Traffic growth | 15 | >20% YoY: +15<br>10-20%: +10<br>0-10%: +5 |
| Hiring signals | 15 | 5+ search/eng roles: +15<br>2-4 roles: +10<br>1 role: +5 |
| High bounce rate | 10 | >70%: +10 (indicates search problems)<br>60-70%: +8 |
| Executive quotes | 20 | Mentions search/CX: +20 |
| Apollo signals | 20 | >80% confidence: +20<br>50-80%: +15<br><50%: +10 |

**Data Sources**:
- `company_traffic` (monthly_visits, bounce_rate, yoy_growth)
- `company_hiring` (job_title, department)
- `executive_quotes` (keywords)
- `intent_signals` (signal_type, confidence_score)

**Example**:
```typescript
{
  score: 75.0,
  breakdown: [
    "Good traffic (5.0M visits/month): +15",
    "Strong growth (25.0% YoY): +15",
    "Some hiring (3 search/eng roles): +10",
    "High bounce rate (65.0%): +8",
    "Executives discussing search/CX: +20",
    "Strong intent signals (2 signals, 88% confidence): +20"
  ]
}
```

---

### 3. Value Score (25% weight)

**Measures**: Deal size and financial health

| Factor | Max Points | Criteria |
|--------|-----------|----------|
| Annual revenue | 20 | >$1B: +20<br>$500M-$1B: +18<br>$100M-$500M: +15 |
| Revenue growth | 15 | >25% YoY: +15<br>15-25%: +12<br>5-15%: +8 |
| Profit margins | 15 | >30%: +15<br>20-30%: +12<br>10-20%: +8 |
| Free cash flow | 15 | >$100M: +15<br>$10M-$100M: +12<br>Positive: +8 |
| Traffic * engagement | 20 | High visitor-minutes/month: +20-5 (scaled) |
| Public + strong financials | 15 | Public + >$100M revenue: +15 |

**Data Sources**:
- `companies` (annual_revenue, is_public)
- `company_financials` (revenue, revenue_growth, net_income, free_cash_flow, margin)
- `company_traffic` (monthly_visits, avg_visit_duration)

**Example**:
```typescript
{
  score: 82.0,
  breakdown: [
    "Large revenue (500M): +18",
    "Good revenue growth (18.0% YoY): +12",
    "Healthy margins (10.0%): +8",
    "Positive FCF (40M): +12",
    "High engagement (15M visitor-min/mo): +15",
    "Public company with strong financials: +15"
  ]
}
```

---

### 4. Displacement Score (25% weight)

**Measures**: Opportunity to displace incumbent search provider

| Factor | Max Points | Criteria |
|--------|-----------|----------|
| Partner technology | 25 | Adobe AEM, Amplience, Spryker, etc.: +25 |
| Displaceable search | 20 | Elasticsearch, Solr, Coveo: +20 |
| No Algolia | 25 | Not using Algolia: +25<br>**Already has Algolia: DISQUALIFIED (0)** |
| E-commerce company | 15 | E-commerce/retail: +15 |
| Poor search experience | 10 | High bounce + low engagement: +10 |
| Competitor uses Algolia | 5 | Proof of value: +5 |

**Data Sources**:
- `company_technologies` (technology_name, technology_category)
- `company_competitors` (competitor_search_provider)
- `company_traffic` (bounce_rate, avg_visit_duration)

**CRITICAL**: If company already uses Algolia, displacement score = 0 (DISQUALIFIED).

**Example**:
```typescript
{
  score: 90.0,
  breakdown: [
    "Uses partner technology (Adobe/Amplience/etc.): +25",
    "Using displaceable search (Elasticsearch): +20",
    "No Algolia in tech stack (opportunity): +25",
    "E-commerce company (ecommerce): +15",
    "Some poor experience signals: +5",
    "Competitor using Algolia (proof of value): +5"
  ]
}
```

---

## Overall Score Calculation

```typescript
overallScore = (fit * 0.25) + (intent * 0.25) + (value * 0.25) + (displacement * 0.25)
```

**Status Mapping**:
- `overallScore >= 70` → `status = 'hot'`
- `overallScore >= 40` → `status = 'warm'`
- `overallScore < 40` → `status = 'cold'`

---

## Usage

### Method 1: Calculate scores for an audit

```typescript
import { calculateCompositeScores, fetchEnrichmentData } from './services/scoring';

// Fetch enrichment data from database
const enrichmentData = await fetchEnrichmentData(companyId, auditId);

// Calculate scores
const scores = await calculateCompositeScores(companyId, auditId, enrichmentData);

console.log(scores);
// {
//   fitScore: 85.0,
//   intentScore: 75.0,
//   valueScore: 82.0,
//   displacementScore: 90.0,
//   overallScore: 83.0,
//   status: 'hot',
//   breakdown: {
//     fit: ["Target vertical (ecommerce): +25", ...],
//     intent: ["Good traffic (5.0M visits/month): +15", ...],
//     value: ["Large revenue (500M): +18", ...],
//     displacement: ["Uses partner technology: +25", ...]
//   }
// }
```

### Method 2: Calculate individual dimensions

```typescript
import { calculateFitScore, calculateIntentScore, calculateValueScore, calculateDisplacementScore } from './services/scoring';

const fitResult = calculateFitScore(enrichmentData);
console.log(fitResult.score); // 85.0
console.log(fitResult.breakdown); // ["Target vertical (ecommerce): +25", ...]
```

### Method 3: Fetch enrichment data

```typescript
import { fetchEnrichmentData } from './services/scoring';

const data = await fetchEnrichmentData(companyId, auditId);
// Returns EnrichmentData object with all data from:
// - companies
// - company_traffic
// - company_financials
// - company_technologies
// - company_competitors
// - company_executives
// - executive_quotes
// - company_hiring
// - intent_signals
```

---

## Data Requirements

### Minimal (will score, but low)
- Company attributes (domain, name)

### Recommended for accurate scoring
- Company attributes (industry, employee_count, headquarters_country, is_public, annual_revenue)
- Traffic data (monthly_visits, bounce_rate, avg_visit_duration)
- Technologies (tech stack from BuiltWith)

### Ideal (for HOT status)
- All of the above, plus:
- Financials (revenue, revenue_growth, margins, free_cash_flow)
- Hiring signals (search/engineering roles)
- Executive quotes (mentioning search/CX)
- Intent signals (from Apollo)
- Competitor intelligence (search providers)

---

## Testing

Run tests:
```bash
npm test -- scoring.test.ts
```

**Test Coverage**:
- ✅ Fit Score (7 tests)
- ✅ Intent Score (7 tests)
- ✅ Value Score (7 tests)
- ✅ Displacement Score (7 tests)
- ✅ Overall Score (3 tests)
- ✅ Status Mapping (3 tests)
- ✅ Integration Tests (4 tests)

**Total**: 38 tests

---

## Scoring Logic Transparency

Every score includes a `breakdown` array that explains the scoring decision:

```typescript
{
  score: 85.0,
  breakdown: [
    "Target vertical (ecommerce): +25",
    "Mid-market sweet spot (5,000 employees): +20",
    "Prime geography (US): +15",
    "Public company (EXMP): +15",
    "Mid-market revenue (500M): +15"
  ]
}
```

This transparency is critical for:
1. **Sales teams**: Understanding why a company is HOT/WARM/COLD
2. **Debugging**: Verifying scoring logic is correct
3. **Auditing**: Tracking scoring decisions over time

---

## Score Persistence

Scores are automatically persisted to the `audits` table:

```sql
UPDATE audits
SET
  fit_score = 85.0,
  intent_score = 75.0,
  value_score = 82.0,
  displacement_score = 90.0,
  overall_score = 83.0
WHERE id = 'audit-id';
```

This enables:
- Historical tracking (score changes over time)
- Filtering/sorting by score
- Dashboard visualizations

---

## Edge Cases

### 1. Missing data
All helper functions handle missing data gracefully:
```typescript
// If no traffic data, score = 0 for traffic factors
const visits = data.traffic?.monthly_visits;
if (!visits) {
  breakdown.push('Traffic data unavailable: +0');
}
```

### 2. Already using Algolia
Displacement score = 0 (DISQUALIFIED):
```typescript
if (hasAlgolia(data.technologies)) {
  return { score: 0, breakdown: ['Already using Algolia: DISQUALIFIED'] };
}
```

### 3. Score clamping
All scores are clamped to 0-100 range:
```typescript
function clampScore(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return Math.round(clamped * 10) / 10; // 1 decimal place
}
```

---

## Future Enhancements

### Phase 2 (Week 3-4)
- [ ] Machine learning model for scoring (trained on won/lost deals)
- [ ] Dynamic weights based on vertical (e.g., e-commerce weights displacement higher)
- [ ] Score confidence intervals (based on data completeness)
- [ ] Competitor benchmarking (compare to similar companies)

### Phase 3 (Week 5-6)
- [ ] Predictive scoring (likelihood to buy within 6 months)
- [ ] Account-based scoring (multiple contacts at same company)
- [ ] Time-series scoring (trend analysis)

---

## Related Files

- **Implementation**: `backend/services/scoring.ts` (750 lines)
- **Tests**: `backend/tests/scoring.test.ts` (550 lines, 38 tests)
- **Types**: `backend/types/index.ts` (EnrichmentData, CompositeScores)
- **Database**: `data/migrations/001-create-core-tables.sql` (audit score columns)

---

## Questions?

See:
- [Backend README](../README.md) - Overall backend architecture
- [Database README](../../data/README.md) - Database schema
- [Enrichment Orchestrator](./enrichment-orchestrator.ts) - Data collection pipeline

---

**Last Updated**: March 7, 2026
**Author**: Dashboard Builder Team
**Status**: ✅ Production Ready
