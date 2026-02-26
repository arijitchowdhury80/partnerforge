# Composite Scoring System

**Last Updated:** 2026-02-26

PartnerForge uses a **4-factor composite scoring system** to prioritize displacement targets. Each factor contributes 25% to the final score.

---

## Visual Overview

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              COMPOSITE SCORING ENGINE                     │
                    │                                                           │
                    │   ┌─────────────┐  ┌─────────────┐                       │
                    │   │    FIT      │  │   INTENT    │                       │
                    │   │    25%      │  │    25%      │                       │
                    │   │             │  │             │                       │
                    │   │ • Vertical  │  │ • Traffic   │                       │
                    │   │ • Size      │  │ • Weak      │                       │
                    │   │ • Geography │  │   search    │                       │
                    │   │ • Public    │  │ • Tech      │                       │
                    │   │             │  │   stack     │                       │
                    │   └──────┬──────┘  └──────┬──────┘                       │
                    │          │                │                              │
                    │          └────────┬───────┘                              │
                    │                   │                                      │
                    │                   ▼                                      │
                    │   ┌───────────────────────────────────┐                  │
                    │   │                                   │                  │
                    │   │   COMPOSITE SCORE = (F + I + V + D) / 4             │
                    │   │                                   │                  │
                    │   │              0-100                │                  │
                    │   │                                   │                  │
                    │   └───────────────────────────────────┘                  │
                    │                   │                                      │
                    │          ┌────────┴───────┐                              │
                    │          │                │                              │
                    │   ┌──────┴──────┐  ┌──────┴──────┐                       │
                    │   │   VALUE     │  │DISPLACEMENT │                       │
                    │   │    25%      │  │    25%      │                       │
                    │   │             │  │             │                       │
                    │   │ • Revenue   │  │ • Current   │                       │
                    │   │ • Traffic   │  │   provider  │                       │
                    │   │   volume    │  │ • Partner   │                       │
                    │   │ • Stores    │  │   strength  │                       │
                    │   │ • Growth    │  │ • Competitor│                       │
                    │   │             │  │   Algolia   │                       │
                    │   └─────────────┘  └─────────────┘                       │
                    │                                                           │
                    └─────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                    STATUS TIERS                          │
                    │                                                          │
                    │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
                    │   │     HOT     │  │    WARM     │  │    COLD     │     │
                    │   │   70-100    │  │   40-69     │  │    0-39     │     │
                    │   │             │  │             │  │             │     │
                    │   │  Ready for  │  │   Nurture   │  │    Low      │     │
                    │   │  outreach   │  │   pipeline  │  │  priority   │     │
                    │   │             │  │             │  │             │     │
                    │   └─────────────┘  └─────────────┘  └─────────────┘     │
                    │       🔴               🟠               ⚪               │
                    └─────────────────────────────────────────────────────────┘
```

---

## Factor Details

### 1. FIT (25%)

**Question:** Does this company match our Ideal Customer Profile?

| Signal | Points | Max |
|--------|--------|-----|
| **High-value vertical** (e-commerce, media, SaaS) | 40 | 40 |
| **Enterprise size** (10K+ employees) | 30 | 30 |
| **US headquarters** | 20 | 20 |
| **Public company** | 10 | 10 |

### 2. INTENT (25%)

**Question:** Are they showing buying signals?

| Signal | Points | Max |
|--------|--------|-----|
| **High traffic** (10M+ visits/month) | 30 | 30 |
| **Weak search platform** (AEM, Amplience, etc.) | 25 | 25 |
| **Complex tech stack** (3+ partner techs) | 20 | 20 |
| **Executive quote captured** | 15 | 15 |
| **Displacement angle identified** | 5 | 5 |

### 3. VALUE (25%)

**Question:** How big is the deal potential?

| Signal | Points | Max |
|--------|--------|-----|
| **Enterprise revenue** ($1B+) | 40 | 40 |
| **High traffic volume** (proxy for search queries) | 30 | 30 |
| **Multi-store presence** (100+ stores) | 15 | 15 |
| **Growth-stage in high-value vertical** | 15 | 15 |

### 4. DISPLACEMENT (25%)

**Question:** How easy is it to convert them?

| Signal | Points | Adjustment |
|--------|--------|------------|
| **No search provider** (greenfield) | +30 | Easier |
| **Uses Elasticsearch/Solr** | +20 | Maintainability pain |
| **Uses Algolia** (existing customer) | -50 | Already converted |
| **Weak partner search** (AEM, Amplience) | +20 | Partner pain point |
| **Strong partner search** (Shopify, SFCC) | -10 | Harder to displace |
| **Competitors using Algolia** | +15 | FOMO |

---

## Confidence Levels

Based on data completeness:

| Level | Data % | Meaning |
|-------|--------|---------|
| **High** | ≥70% | Data fields populated, score reliable |
| **Medium** | 40-69% | Some gaps, score approximate |
| **Low** | <40% | Limited data, enrich before outreach |

**14 Data Points Tracked:**
1. Company name
2. Domain
3. Vertical
4. Industry
5. Headquarters country
6. Employee count
7. Revenue
8. Monthly traffic
9. Partner technologies
10. Current search provider
11. Public/Private status
12. Founded year
13. Competitor data
14. Executive quotes

---

## Implementation

```typescript
// frontend/src/services/scoring.ts

export function calculateCompositeScore(company: Company): CompositeScore {
  const fitScore = calculateFitScore(company);
  const intentScore = calculateIntentScore(company);
  const valueScore = calculateValueScore(company);
  const displacementScore = calculateDisplacementScore(company);

  const total = Math.round(
    fitScore.score * 0.25 +
    intentScore.score * 0.25 +
    valueScore.score * 0.25 +
    displacementScore.score * 0.25
  );

  const dataCompleteness = calculateDataCompleteness(company);
  const confidence = dataCompleteness >= 70 ? 'high'
                   : dataCompleteness >= 40 ? 'medium'
                   : 'low';

  return {
    total,
    factors: { fit, intent, value, displacement },
    confidence,
    dataCompleteness,
  };
}
```

---

## Usage in UI

### QuickLook Card (Hover Preview)
Shows compact score breakdown with 4 factor bars.

### CompanyDrawer (Detail View)
Shows ring progress + full factor breakdown with signal explanations.

### TargetList (Table)
Shows score badge with color based on status tier.

---

## Related Files

| File | Purpose |
|------|---------|
| `services/scoring.ts` | Composite scoring logic |
| `components/company/ScoreBreakdown.tsx` | UI display component |
| `lib/constants.ts` | COLORS, STATUSES, getStatusFromScore() |

---

*See also: [ENRICHMENT_PIPELINE.md](./ENRICHMENT_PIPELINE.md) for data sources*
