# Sales Machinery & Prioritization

**Version:** 2.0  
**Date:** March 6, 2026  
**Status:** Operational  

---

## Overview

This document defines how to prioritize and route accounts through the sales funnel using a 4-layer cascading system.

**Key Principle:** Accounts at the intersection of multiple signals are highest priority.

---

## Table of Contents

1. [Four-Layer Cascading Funnel](#four-layer-cascading-funnel)
2. [Three-Play System](#three-play-system)
3. [ABM Campaign Assignment](#abm-campaign-assignment)
4. [Scoring & Prioritization](#scoring--prioritization)

---

## Four-Layer Cascading Funnel

### The Sales Machinery

```
Universe (2,800 companies)
    ↓ Layer 1: Partner Tech Filter
PARTNER TECH (500 companies)
    ↓ Layer 2: ICP Filter
ICP MATCH (200 companies)
    ↓ Layer 3: Play Intersection
MULTI-PLAY (60 companies)
    ↓ Layer 4: GTM Campaign
ABM READY (15 companies)
```

### Layer 1: Partner Tech Cohort

**Filter:** Companies using partner technologies

**Categories:**
- Commerce: Shopify Plus, Magento, SFCC, BigCommerce
- CMS: Adobe AEM, Contentful, Amplience, Contentstack
- Marketing: Salesforce Marketing Cloud, Marketo, HubSpot

**Cohort Scores:**
- JACKPOT (CMS + Commerce + Hyperscaler): 100
- HIGH (CMS + Commerce): 85
- STANDARD (Commerce or CMS only): 60-70

**Output:** 500 companies with partner tech

### Layer 2: ICP Filter

**Apply ICP scoring from ICP_DEFINITION.md**

**Criteria:**
- Vertical: Fashion/Grocery = 100, Retail = 75
- Size: Enterprise = 100, Mid-market = 90
- Geography: US/UK/EMEA = 100
- Traffic: >10M visits/month = 90+

**Output:** 200 companies that match ICP

### Layer 3: Play Intersection

**Count how many plays each account belongs to:**
- S1 (Tech Partner): Uses partner tech
- S2 (Target List): On marketing ABM list
- S3 (SI Connected): Has SI relationship

**Play Multipliers:**
- Triple Play (S1 + S2 + S3): 1.5x score
- Double Play: 1.25x score
- Single Play: 1.0x score

**Output:** 60 companies with 2+ plays

### Layer 4: GTM Campaign Assignment

**Assign ABM treatment based on final score:**

| Score Range | Play Count | Campaign | Accounts |
|-------------|------------|----------|----------|
| **90-100** | Triple Play | ABM 1:1 | 10-15 |
| **80-89** | Double Play | ABM 1:Few | 25-40 |
| **70-79** | Single Play | ABM 1:Many | 50-100 |

---

## Three-Play System

### S1: Tech Partner Play

**Definition:** Company uses technology from an Algolia partner

**Examples:**
- Adobe AEM (CMS)
- Shopify Plus (Commerce)
- Salesforce Marketing Cloud (MarTech)
- AWS (Cloud)

**Why it matters:** Validated technology investment, co-sell opportunity

### S2: Target List Play

**Definition:** Company is on marketing ABM list

**Sources:**
- Demandbase engagement
- 6sense intent signals
- Whale account list
- Territory planning

**Why it matters:** Marketing validation, warm account

### S3: SI Connected Play

**Definition:** Company has relationship with System Integrator partner

**Partners:**
- EPAM
- Isobar
- Valtech
- Accenture Interactive

**Why it matters:** Warm intro path, implementation partnership

### The Intersection Magic

**Triple Play Example (Costco):**
- S1: Uses Adobe AEM ✓
- S2: On Whale account list ✓
- S3: Works with EPAM ✓
- **Result:** Score multiplier 1.5x, ABM 1:1 treatment

**Why it's magic:**
- 3 independent validation sources
- Multiple entry points for conversation
- High conversion probability
- Co-sell opportunity

---

## ABM Campaign Assignment

### ABM 1:1 (10-15 Accounts)

**Criteria:**
- Score 90-100
- Triple Play intersection
- Enterprise (>$500M revenue)

**Treatment:**
- Dedicated SDR + AE
- Custom pitch deck
- Executive engagement
- Partner co-sell motion
- Quarterly business reviews

**Example Accounts:**
- Costco (Adobe AEM + Whale + EPAM)
- Target (Shopify + Intent + Valtech)

### ABM 1:Few (25-40 Accounts)

**Criteria:**
- Score 80-89
- Double Play intersection
- Mid-market to Enterprise

**Treatment:**
- Shared SDR coverage
- Industry-specific content
- Virtual events
- Partner introduction

### ABM 1:Many (50-100 Accounts)

**Criteria:**
- Score 70-79
- Single Play
- Growth to Mid-market

**Treatment:**
- Marketing automation
- Content nurture
- Webinar invites
- Low-touch outreach

---

## Scoring & Prioritization

### Priority Score Formula

```
Priority Score = (Composite Score × Play Multiplier) + Displacement Bonus

Where:
- Composite Score = (Fit + Intent + Value + Displacement) / 4
- Play Multiplier = 1.0 (single), 1.25 (double), 1.5 (triple)
- Displacement Bonus = +10 if using competitor search
```

### Example Calculation

**Company: Fashion Retailer**
- Fit Score: 90 (Fashion vertical + Enterprise)
- Intent Score: 75 (Hiring 5 engineers)
- Value Score: 85 ($800M revenue)
- Displacement Score: 100 (Using Elasticsearch)
- **Composite:** (90+75+85+100)/4 = 87.5

**Plays:**
- S1: Uses Adobe AEM ✓
- S2: On intent list ✓
- S3: No SI connection ✗
- **Play Multiplier:** 1.25x (Double Play)

**Priority Score:** 87.5 × 1.25 + 10 = **119.4**

**Assignment:** ABM 1:Few campaign

---

## Five-Layer Funnel Metrics

### Conversion Rates (Historical)

| Layer | Input | Output | Conversion |
|-------|-------|--------|------------|
| L1 → L2 | 2,800 | 500 | 18% |
| L2 → L3 | 500 | 200 | 40% |
| L3 → L4 | 200 | 60 | 30% |
| L4 → L5 | 60 | 15 | 25% |
| **Overall** | **2,800** | **15** | **0.5%** |

### Pipeline Metrics

**From 1,000 audits/year:**
- 1,000 companies enriched
- 200 match ICP (20%)
- 60 multi-play accounts (6%)
- 15 ABM 1:1 targets (1.5%)

**Expected pipeline:**
- 15 ABM accounts × 30% close rate = 4-5 deals/year
- 4.5 deals × $150K average = **$675K ARR**

---

## Usage in Arian Dashboard

### Status Column

- 🔥 **HOT** (Score 80+): Green, ready for immediate outreach
- 🟡 **WARM** (Score 60-79): Yellow, nurture campaign
- 🔵 **COOL** (Score 40-59): Blue, low-touch monitoring
- ⚪ **COLD** (Score 0-39): Gray, deprioritize

### Priority Badge

- ⭐⭐⭐ **Triple Play**: JACKPOT cohort
- ⭐⭐ **Double Play**: HIGH cohort
- ⭐ **Single Play**: STANDARD cohort

### Recommended Action

Dashboard shows next best action based on score + plays:
- "Schedule ABM 1:1" (Triple Play, Score 90+)
- "Add to nurture campaign" (Double Play, Score 70-89)
- "Monitor for intent signals" (Single Play, Score 60-79)

---

**Last Updated**: March 6, 2026  
**Status**: Operational in Arian dashboard  
**Usage**: Reference for all account routing decisions
