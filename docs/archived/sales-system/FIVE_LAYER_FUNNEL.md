# Arian: The 5-Layer Funnel Architecture

**Version:** 1.0
**Date:** 2026-02-27

---

## Executive Summary

Arian uses a **5-layer cascading funnel** to transform a universe of partner technology users into a prioritized ABM target list.

```
LAYER 0: Partner Tech Galaxy     ~10,000+  "Uses partner tech"
     ↓ Classify
LAYER 1: Tech Cohorts            ~10,000+  "Stack combinations"
     ↓ Filter
LAYER 2: Whale Composite            ~776   "Has intent + qualification"
     ↓ Filter
LAYER 3: Crossbeam Overlap          ~400   "Has warm intro"
     ↓ Score
LAYER 4: ICP Classification         ~400   "HOT / WARM / COLD"
     ↓ Tag
LAYER 5: Sales Play                 ~400   "Displacement vs Greenfield"
```

**Output:** A ranked list of ~50-100 HOT accounts ready for ABM 1:1 outreach, with sales play and partner co-sell context.

---

## Layer 0: Partner Tech Galaxy (The Foundation)

### What It Is
The complete universe of companies using technologies from our partner ecosystem.

### Data Sources

| Category | Technologies | Source | Est. Accounts |
|----------|--------------|--------|---------------|
| **CMS** | AEM, Contentful, Contentstack, Amplience, Sitecore | Crossbeam, BuiltWith | ~3,000 |
| **Commerce** | SFCC, Shopify+, Magento, BigCommerce, Commercetools | Crossbeam, BuiltWith, Demandbase | ~5,000 |
| **MarTech** | SFMC, Marketo, HubSpot, Klaviyo | Crossbeam | ~2,000 |
| **Hyperscaler** | AWS, Azure, GCP | BuiltWith | ~8,000 |

### Exclusion: Algolia Customers
All lists are filtered to remove current Algolia customers (from Salesforce export).

### Database Tables
```
partner_technologies      → Technology catalog (21 technologies)
partner_tech_accounts     → Raw account-technology pairs
algolia_customers         → Exclusion list
partner_tech_galaxy       → Aggregated view with tech stacks
```

---

## Layer 1: Tech Cohorts (Stack Classification)

### What It Is
Accounts are classified by their technology stack combination.

### Cohort Definitions

| Cohort | Definition | Score | Why Valuable |
|--------|------------|-------|--------------|
| **JACKPOT** | CMS + Commerce + (Hyperscaler OR MarTech) | 100 | Full digital stack, enterprise budget |
| **HIGH** | CMS + Commerce | 85 | Headless/composable architecture |
| **MEDIUM** | Commerce only (premium tier) | 60 | Proven e-commerce investment |
| **BASE** | Any partner tech | 40 | Has partner relationship |

### Example Stacks

| Company | CMS | Commerce | MarTech | Cohort |
|---------|-----|----------|---------|--------|
| Nordstrom | AEM | SFCC | SFMC | JACKPOT |
| Gymshark | Contentful | Shopify+ | Klaviyo | JACKPOT |
| Williams-Sonoma | — | SFCC | — | MEDIUM |
| Tech Startup | Contentful | — | HubSpot | BASE |

### Database
```sql
SELECT * FROM partner_tech_by_cohort;

tech_cohort | account_count | opportunity_count | avg_score
------------|---------------|-------------------|----------
JACKPOT     |           234 |               198 |      87.3
HIGH        |           891 |               756 |      72.1
MEDIUM      |         2,341 |             2,105 |      58.4
BASE        |         6,534 |             5,892 |      42.7
```

---

## Layer 2: Whale Composite (Intent + Qualification)

### What It Is
Filter to accounts that appear in the Demandbase/ZoomInfo qualified list.

### Signals Captured

| Signal Type | Fields | Why It Matters |
|-------------|--------|----------------|
| **Intent** | Journey Stage (Qualified/Engaged/Aware) | Active evaluation |
| **Engagement** | Engagement Points (3mo), Engaged People | Content consumption |
| **Recency** | Last Web Activity | Freshness of interest |
| **Budget** | Revenue, ARR, Employee Count | Deal size potential |
| **Firmographics** | Industry, Region, Public/Private | ICP match |

### Journey Stage Distribution

| Stage | Count | % | Meaning |
|-------|-------|---|---------|
| Qualified | 14 | 2% | Sales-ready, MQL equivalent |
| Engagement | 105 | 13% | Actively engaging with Algolia |
| Awareness | 658 | 85% | Know about Algolia, not active |

### Database
```
whale_composite → 776 accounts with 100+ fields
```

---

## Layer 3: Crossbeam Overlap (Warm Intros)

### What It Is
Filter to accounts where we have a partner relationship that can facilitate an introduction.

### Crossbeam Data Points

| Field | Meaning |
|-------|---------|
| Partner Account Status | Customer, Prospect, Target |
| Partner Owner | Who at partner to contact |
| Overlap Type | Mutual customer, Partner prospect, etc. |

### Value of This Layer
- Accounts in Crossbeam have a **2-3x higher response rate**
- Partner AE can make warm intro
- Co-sell motion is pre-validated

### Database
```
crossbeam_overlaps → 489 accounts with partner context
```

---

## Layer 4: ICP Classification (Prioritization)

### What It Is
Score accounts by industry fit based on customer evidence (proof points, quotes, case studies).

### ICP Confidence Levels

| Confidence | Proof Points | Industries | Score Boost |
|------------|--------------|------------|-------------|
| **HIGH** | 50+ | Retail, Fashion, Grocery | +20 |
| **MEDIUM** | 10-49 | Media, Healthcare, B2B | +10 |
| **LOW** | 1-9 | SaaS (customers but no proof) | +5 |
| **NEUTRAL** | 0 | Other | +0 |

### Why ICP is Layer 4 (Not Earlier)
- ICP should **prioritize**, not eliminate
- A SaaS company with Qualified intent + SFCC is still valuable
- We score and rank, we don't filter out

### Output: Tiered List

| Tier | Criteria | Action |
|------|----------|--------|
| **HOT** | Score ≥ 80 | ABM 1:1, immediate outreach |
| **WARM** | Score 50-79 | ABM 1:Few, nurture sequence |
| **COLD** | Score < 50 | Long-term pipeline |

### Database
```
industries_with_icp → Industry scoring
whale_scored → Accounts with composite scores
```

---

## Layer 5: Sales Play (Displacement vs Greenfield)

### What It Is
Tag accounts by their current search solution to determine sales approach.

### Sales Play Classification

| Play | Detection Criteria | Sales Angle |
|------|-------------------|-------------|
| **Displacement** | Has Elastic, Solr, SearchSpring, Coveo, Lucidworks | "Upgrade from legacy search" |
| **Greenfield** | No search detected OR native platform search only | "Add intelligent search" |
| **Unknown** | No tech stack data | Requires discovery |

### Why This Matters

| Play | Pros | Cons |
|------|------|------|
| Displacement | Proven search investment, larger deals | Switching costs, incumbent relationship |
| Greenfield | No competition, faster close | May not have budget, needs education |

### Detection Sources
- BuiltWith tech stack analysis
- whale_composite technology flags
- Manual tagging from discovery calls

---

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PARTNER TECH GALAXY                                 │
│                        ~10,000 accounts                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │   AEM   │ │  SFCC   │ │Shopify+ │ │Contentful│ │ Magento │  ...     │
│  │  3,000  │ │  2,500  │ │  1,800  │ │  1,200  │ │  1,500  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                                         │
│  − Algolia Customers (exclusion)                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ CLASSIFY
┌─────────────────────────────────────────────────────────────────────────┐
│                       TECH COHORTS                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ JACKPOT  │  │   HIGH   │  │  MEDIUM  │  │   BASE   │               │
│  │   234    │  │   891    │  │  2,341   │  │  6,534   │               │
│  │CMS+Comm+ │  │CMS+Comm  │  │Comm Only │  │ Any Tech │               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ FILTER: In Whale?
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHALE COMPOSITE                                      │
│                      776 accounts                                       │
│  Journey: Qualified (14) │ Engaged (105) │ Aware (658)                 │
│  Intent + Budget + Firmographics validated                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ FILTER: In Crossbeam?
┌─────────────────────────────────────────────────────────────────────────┐
│                    CROSSBEAM OVERLAP                                    │
│                      ~400 accounts                                      │
│  Partner relationship = Warm intro available                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ SCORE: ICP Industry Fit
┌─────────────────────────────────────────────────────────────────────────┐
│                   ICP CLASSIFICATION                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                              │
│  │   HOT    │  │   WARM   │  │   COLD   │                              │
│  │   ~50    │  │  ~150    │  │  ~200    │                              │
│  │ Score≥80 │  │Score50-79│  │ Score<50 │                              │
│  └──────────┘  └──────────┘  └──────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ TAG: Sales Play
┌─────────────────────────────────────────────────────────────────────────┐
│                     SALES PLAY                                          │
│           ┌──────────────┐    ┌──────────────┐                         │
│           │ DISPLACEMENT │    │  GREENFIELD  │                         │
│           │    ~180      │    │    ~220      │                         │
│           │Has competitor│    │  No search   │                         │
│           │   search     │    │  detected    │                         │
│           └──────────────┘    └──────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      FINAL TARGET LIST        │
                    │  50 HOT accounts prioritized  │
                    │  by score + sales play        │
                    │                               │
                    │  Ready for ABM 1:1 outreach   │
                    │  with partner co-sell context │
                    └───────────────────────────────┘
```

---

## Data Requirements

### What We Have
| Data | Status | Records |
|------|--------|---------|
| targets (AEM customers) | ✅ | ~2,800 |
| whale_composite | ✅ | 776 |
| crossbeam_overlaps | ✅ | 489 |
| industries_with_icp | ✅ | 30 (8 enriched) |
| icp_companies | ✅ | 181 |

### What We Need
| Data | Source | Priority |
|------|--------|----------|
| SFCC customer list | Crossbeam / Salesforce | HIGH |
| Shopify+ customer list | Crossbeam | HIGH |
| Contentful customer list | Crossbeam | MEDIUM |
| Algolia customer list | Salesforce export | HIGH (for exclusion) |
| BuiltWith tech stacks | BuiltWith API | MEDIUM (for search detection) |

---

## Next Steps

1. **Run migration:** `20260227_partner_tech_galaxy.sql`
2. **Import partner lists** into `partner_tech_accounts`
3. **Import Algolia customers** into `algolia_customers`
4. **Build Layer 1-5 views** that cascade the filters
5. **Build UI** to visualize the funnel
