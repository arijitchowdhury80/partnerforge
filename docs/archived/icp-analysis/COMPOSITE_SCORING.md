# Arian Composite Scoring Architecture

**Version:** 2.0
**Date:** 2026-02-27

## Overview

The composite scoring system transforms raw account data into a prioritized target list using weighted signals across 4 dimensions. Unlike hard-cutoff filtering, this approach ensures no high-potential accounts are lost due to missing data in a single dimension.

## The Formula

```
COMPOSITE SCORE = Intent (30) + ICP Fit (25) + Tech Cohort (25) + Value (20)
```

| Factor | Max Points | Weight | Why This Weight |
|--------|------------|--------|-----------------|
| **Intent** | 30 | 30% | Active engagement = highest conversion probability |
| **ICP Fit** | 25 | 25% | Industry + vertical alignment = message resonance |
| **Tech Cohort** | 25 | 25% | Partner tech = displacement opportunity |
| **Value** | 20 | 20% | Deal size potential |

---

## Factor 1: Intent Score (30 points max)

**Source:** Demandbase ABX data in `whale_composite`

| Signal | Points | Rationale |
|--------|--------|-----------|
| **Journey Stage: Qualified** | 25 | Sales-ready, MQL/SQL equivalent |
| **Journey Stage: Engagement** | 15 | Actively engaging with Algolia content |
| **Journey Stage: Awareness** | 5 | Know about Algolia, not yet engaged |
| **Engagement Points (3mo)** | 0-5 | Quantified content consumption |
| **Recency (<30 days)** | 5 | Recent activity = active evaluation |
| **Recency (30-90 days)** | 3 | Warm but cooling |
| **Recency (90-180 days)** | 1 | Stale but recoverable |

**Distribution in Current Data (776 accounts):**
- Qualified: 14 (2%) — **GOLD**
- Engagement: 105 (13%) — **SILVER**
- Awareness: 658 (85%) — **BRONZE**

---

## Factor 2: ICP Fit Score (25 points max)

**Source:** `industries_with_icp` view (industries enriched with ICP data)

| Signal | Points | Rationale |
|--------|--------|-----------|
| **Industry ICP Confidence: HIGH** | 20 | 50+ proof points (Fashion, Grocery, Retail) |
| **Industry ICP Confidence: MEDIUM** | 10 | 1-49 proof points (Media, Healthcare) |
| **Industry ICP Confidence: LOW** | 5 | Customers exist but no proof points (SaaS) |
| **Sub-Industry Keyword Match** | 5 | Fashion/Grocery within Retail gets bonus |
| **Sub-Industry Partial Match** | 3 | E-commerce keywords |

**ICP Tier Mapping:**

| Demandbase Industry | ICP Confidence | Proof Points | Base Score |
|---------------------|---------------|--------------|------------|
| Retail | HIGH | 122 | 20 |
| Consumer Product Manufacturing | HIGH | 53 | 20 |
| Food and Beverage | HIGH | 28 | 20 |
| Media | MEDIUM | 7 | 10 |
| Corporate Services | MEDIUM | 10 | 10 |
| Hospitals and Healthcare | MEDIUM | 1 | 10 |
| Computer Software | LOW | 0 | 5 |
| Other | NEUTRAL | 0 | 0 |

---

## Factor 3: Tech Cohort Score (25 points max)

**Source:** Technology flags in `whale_composite`

| Tech Tier | Technologies | Points | Rationale |
|-----------|--------------|--------|-----------|
| **JACKPOT** | Salesforce Commerce Cloud, Commercetools | 25 | Enterprise-grade, expensive to leave |
| **HIGH** | Shopify Plus, Magento | 20 | Established e-commerce with search needs |
| **MEDIUM** | BigCommerce, Shopify, Shopify Hosted | 15 | Standard commerce platforms |
| **BASE** | Spryker, Magento Open Source, SF B2B Commerce | 10 | Any commerce presence |

**Current Distribution (776 accounts):**

| Technology | Count | % |
|------------|-------|---|
| Magento | 87 | 11% |
| Salesforce Commerce Cloud | 59 | 8% |
| Shopify Plus | 22 | 3% |

---

## Factor 4: Value Score (20 points max)

**Source:** ZoomInfo + Demandbase firmographics in `whale_composite`

| Signal | Points | Threshold |
|--------|--------|-----------|
| **Revenue: $10B+** | 10 | Fortune 100 scale |
| **Revenue: $1B+** | 8 | Enterprise |
| **Revenue: $500M+** | 6 | Large Enterprise |
| **Revenue: $100M+** | 4 | Mid-Market Enterprise |
| **Revenue: $50M+** | 2 | Commercial |
| **Traffic: 10M+/mo** | 5 | Massive search volume |
| **Traffic: 1M+/mo** | 4 | High volume |
| **Traffic: 500K+/mo** | 3 | Moderate volume |
| **Traffic: 100K+/mo** | 2 | Growing |
| **Traffic: 50K+/mo** | 1 | Base |
| **Public Company** | 5 | Ticker exists → budget available |

---

## Score Tiers

| Tier | Score Range | Action | Expected Count |
|------|-------------|--------|----------------|
| **HOT** | 80-100 | Immediate outreach | 10-30 |
| **WARM** | 50-79 | Nurture sequence | 100-200 |
| **COLD** | 0-49 | Long-term pipeline | 500+ |

---

## Convenience Views

| View | Purpose | Criteria |
|------|---------|----------|
| `whale_scored` | Base view with all scores | All accounts |
| `whale_hot_targets` | Priority list | score >= 80 |
| `whale_jackpot` | Triple-play accounts | Qualified/Engaged + Premium Tech + High Value |
| `whale_salesforce_targets` | SFCC co-sell | has_salesforce_commerce_cloud = TRUE |
| `whale_magento_targets` | Magento co-sell | has_magento = TRUE |
| `whale_shopify_targets` | Shopify co-sell | has_shopify_plus = TRUE |

---

## Example Score Breakdowns

### JACKPOT Account (Score: 90)

| Factor | Score | Signals |
|--------|-------|---------|
| Intent | 28 | Qualified (25) + Recent (3) |
| ICP Fit | 22 | Retail/HIGH (20) + Fashion keyword (2) |
| Tech Cohort | 25 | Salesforce Commerce Cloud |
| Value | 15 | $2B revenue (8) + 5M traffic (4) + Public (3) |
| **TOTAL** | **90** | **HOT** |

### Warm Account (Score: 55)

| Factor | Score | Signals |
|--------|-------|---------|
| Intent | 8 | Awareness (5) + Some engagement (3) |
| ICP Fit | 12 | Media/MEDIUM (10) + Publishing keyword (2) |
| Tech Cohort | 20 | Magento |
| Value | 15 | $500M revenue (6) + 2M traffic (4) + Public (5) |
| **TOTAL** | **55** | **WARM** |

### Cold Account (Score: 25)

| Factor | Score | Signals |
|--------|-------|---------|
| Intent | 5 | Awareness only |
| ICP Fit | 5 | Software/LOW |
| Tech Cohort | 10 | Magento Open Source |
| Value | 5 | $75M revenue (2) + 80K traffic (1) + Private (0) |
| **TOTAL** | **25** | **COLD** |

---

## Why Weighted Scoring > Hard Filtering

### Problem with Hard Filtering

```sql
-- Hard filter approach loses good accounts
WHERE journey_stage = 'Qualified'
  AND has_salesforce_commerce_cloud = TRUE
  AND revenue >= 1000000000
  AND industry IN ('Retail', 'Food and Beverage')
```

**Result:** 0-2 accounts (too narrow)

### Weighted Scoring Preserves Opportunity

An account with:
- Journey Stage: Engagement (not Qualified)
- Tech: Shopify Plus (not SFCC)
- Revenue: $300M (not $1B)
- Industry: Consumer Products (not Retail)

Still scores **65 points (WARM)** and stays in the pipeline.

---

## Analytics Views

### Score Distribution
```sql
SELECT * FROM whale_score_distribution;
```

| Tier | Count | Avg Score | Avg Intent | Avg ICP | Avg Tech | Avg Value |
|------|-------|-----------|------------|---------|----------|-----------|
| HOT | ~20 | 85 | 22 | 20 | 23 | 15 |
| WARM | ~150 | 62 | 12 | 12 | 18 | 12 |
| COLD | ~600 | 28 | 5 | 5 | 5 | 8 |

### Factor Analysis by Tier
```sql
SELECT * FROM whale_factor_analysis;
```

---

## Implementation Checklist

1. [x] Create `whale_composite` table (done)
2. [x] Import whale CSV data (done)
3. [x] Enrich `industries` with ICP columns (migration ready)
4. [ ] Run `20260227_enrich_industries_with_icp.sql`
5. [ ] Run `20260227_composite_scoring.sql`
6. [ ] Verify with `SELECT * FROM whale_score_distribution`

---

## Future Enhancements

1. **Adobe AEM Integration** - Add CMS layer to tech cohort
2. **Crossbeam Overlaps** - Bonus for accounts in partner CRM
3. **Competitor Detection** - Detect Elastic, Solr, SearchSpring
4. **Negative Signals** - Already Algolia customer → exclude
5. **Sales Feedback Loop** - Adjust weights based on win/loss data
