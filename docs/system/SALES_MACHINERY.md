# Arian Sales Machinery

**Version:** 1.0
**Date:** 2026-02-27
**Status:** DEFINITIVE
**Owner:** GTM Team

---

## Executive Summary

This document defines the **cascading funnel logic** that powers Arian - Algolia's partner-led GTM engine. The machinery takes thousands of partner tech accounts and systematically filters them down to the absolute highest-priority targets with assigned sales plays and campaigns.

**The Core Insight:** We don't score everything equally. We **cascade** through layers, each layer narrowing the focus and increasing the precision.

---

## The Four-Layer Cascade

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LAYER 1: PARTNER TECH COHORT                                  │
│   "What tech stack do they have?"                               │
│                                                                 │
│   CMS Only → Commerce Only → CMS+Commerce → CMS+Commerce+Hyper  │
│      ↓            ↓              ↓                 ↓            │
│    LOW         MEDIUM          HIGH            JACKPOT          │
│                                                    ↓            │
│                                                    ↓            │
├────────────────────────────────────────────────────┼────────────┤
│                                                    ↓            │
│   LAYER 2: ICP FILTER (Applied to JACKPOT)                      │
│   "Do they match our Ideal Customer Profile?"                   │
│                                                                 │
│   JACKPOT accounts                                              │
│       → ICP Tier 1 (Fashion/Grocery + Enterprise)               │
│       → ICP Tier 2 (Retail + Mid-Market)                        │
│       → ICP Tier 3 (SaaS/B2B)                                   │
│                ↓                                                │
│                ↓                                                │
├────────────────┼────────────────────────────────────────────────┤
│                ↓                                                │
│   LAYER 3: SALES PLAY INTERSECTION (Applied to ICP Tier 1)      │
│   "What plays do we have on this account?"                      │
│                                                                 │
│   S1+S2+S3 → S1+S2 → S2+S3 → S1 Only → S2 Only → S3 Only       │
│   TRIPLE    HIGH    HIGH    STANDARD  STANDARD  STANDARD        │
│      ↓                                                          │
│      ↓                                                          │
├──────┼──────────────────────────────────────────────────────────┤
│      ↓                                                          │
│   LAYER 4: GTM CAMPAIGN (For the crème de la crème)             │
│   "How do we go to market?"                                     │
│                                                                 │
│   Persona → Job Profile → Messaging → Channel → Sequence        │
│   (CTO)     (VP Eng)      (Elastic    (LinkedIn   (8-touch      │
│                            pain)       + Email)    cadence)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

### The Problem with Flat Scoring

Traditional lead scoring assigns a single score to every account:
```
Account Score = Signal1 × Weight1 + Signal2 × Weight2 + ...
```

**This fails because:**
- A SaaS company with high traffic scores the same as a Fashion retailer with high traffic
- But Fashion has 65% of our proof points, SaaS has 0%
- Flat scoring treats them equally. They are NOT equal.

### The Cascading Solution

We filter FIRST, then score WITHIN the filtered set:

```
Step 1: Filter by Partner Tech Cohort → Only JACKPOT advances
Step 2: Filter by ICP → Only Tier 1 advances
Step 3: Filter by Sales Play → Only Triple Play advances
Step 4: Assign Campaign → Hyper-personalized outreach
```

**Result:** The 10-15 accounts that survive all filters are the absolute best opportunities. They get 1:1 ABM treatment.

---

## Layer 1: Partner Tech Cohort

### What It Is

Classification of accounts based on what partner technologies they use.

### The Hierarchy

| Cohort | Components | Score | Priority |
|--------|------------|-------|----------|
| **CMS + Commerce + Hyperscaler** | Adobe AEM + SFCC + AWS | 100 | JACKPOT |
| **CMS + Commerce + Marketing** | Contentful + Magento + SFMC | 95 | JACKPOT |
| **CMS + Commerce** | Amplience + Shopify | 85 | HIGH |
| **Commerce + Marketing** | SFCC + Adobe Target | 80 | HIGH |
| **Commerce + Hyperscaler** | Magento + AWS | 75 | MEDIUM |
| **CMS + Marketing** | Contentful + Braze | 70 | MEDIUM |
| **Commerce Only** | Shopify, SFCC, Magento | 60 | STANDARD |
| **CMS Only** | Adobe AEM, Contentful | 50 | STANDARD |
| **Marketing Only** | Klaviyo, Braze | 40 | LOW |
| **Hyperscaler Only** | AWS, Azure, GCP | 30 | LOW |

### Why JACKPOT is JACKPOT

Accounts with CMS + Commerce + Hyperscaler (or CMS + Commerce + Marketing) signal:

1. **Enterprise-grade investment** - They've paid for expensive tools
2. **Complex stack** - They value best-of-breed solutions
3. **Multiple decision-makers** - CTO (infrastructure), CMO (marketing), VP E-Commerce (commerce)
4. **High ACV potential** - Complex deals = larger contracts
5. **Integration opportunity** - Algolia fits into the stack

### Decision: Focus on JACKPOT First

> **We do not apply ICP filtering to LOW or STANDARD cohorts.**
>
> JACKPOT accounts get full ICP analysis.
> HIGH accounts get ICP analysis after JACKPOT is exhausted.
> MEDIUM/STANDARD/LOW are backlog.

---

## Layer 2: ICP Filter

### What It Is

Multi-dimensional scoring of accounts against our Ideal Customer Profile, derived from actual customer evidence (1,306 logos, 379 quotes, 82 stories, 81 proof points).

### The Six Dimensions

| Dimension | Weight | Source | Why It Matters |
|-----------|--------|--------|----------------|
| **Vertical** | 25% | Manual tagging, Industry classifiers | Fashion/Grocery = 100% of proof points |
| **Competitor** | 20% | BuiltWith search tech detection | Elastic/Solr = displacement opportunity |
| **Size** | 15% | SimilarWeb traffic, Yahoo Finance revenue | Enterprise = higher ACV |
| **Tech Stack** | 15% | BuiltWith | Shopify/SFCC = proven integration |
| **Persona Access** | 15% | ZoomInfo, LinkedIn | CTO access = tech win |
| **Geography** | 10% | Company HQ | US/EMEA = 85% of success |

### ICP Tier Definitions

| Tier | Score | Characteristics | Action |
|------|-------|-----------------|--------|
| **Tier 1** | 85-100 | Fashion/Grocery + Enterprise + US/EMEA + Elastic displacement | Advance to Layer 3 |
| **Tier 2** | 70-84 | General Retail + Mid-Market + Known competitor | Nurture, advance later |
| **Tier 3** | 50-69 | SaaS/B2B + Growth stage | Long-term pipeline |
| **Tier 4** | 25-49 | Weak vertical fit | Deprioritize |
| **Tier 5** | 0-24 | Anti-ICP (Gov, Non-profit) | Exclude |

### The Key Insight: Data-Driven ICP

This ICP is not theoretical. It comes from analyzing WHERE Algolia has actually won:

| Vertical | % of Proof Points | ICP Score |
|----------|-------------------|-----------|
| Fashion/Apparel | 65% | 100 |
| Grocery/Food | 35% | 95 |
| General Retail | 0% (but 53% of quotes) | 75 |
| SaaS | 0% (but 15% of quotes) | 70 |
| Media | 0% (5% of quotes) | 40 |

**Fashion and Grocery have ALL the proof points.** That's not opinion, that's evidence.

### Decision: ICP Tier 1 Advances

> **Only ICP Tier 1 accounts from JACKPOT cohort advance to Layer 3.**
>
> ICP Tier 2 accounts are nurtured.
> ICP Tier 3+ accounts are backlog.

---

## Layer 3: Sales Play Intersection

### What It Is

Classification of accounts based on which sales plays we can execute against them.

### The Three Plays

| Play | Code | Definition | Signal Source |
|------|------|------------|---------------|
| **Tech Partner** | S1 | Uses partner tech (Adobe, Amplience, Spryker) | BuiltWith, Crossbeam |
| **Target List** | S2 | On marketing/ABM target list | CSV upload, Marketing |
| **SI Connected** | S3 | Has relationship with SI partner (EPAM, Isobar, Valtech) | Crossbeam, Manual |

### The Intersection Model

**Key Insight:** Accounts can be tagged with MULTIPLE plays. Intersections are highest priority.

| Intersection | Code | Priority | Why |
|--------------|------|----------|-----|
| **S1 + S2 + S3** | TRIPLE | JACKPOT | Validated from every angle |
| **S1 + S2** | S1S2 | HIGH | Target List + uses partner tech = instant validation |
| **S2 + S3** | S2S3 | HIGH | Target List + SI knows them = warm intro |
| **S1 + S3** | S1S3 | MEDIUM | Partner tech + SI relationship = co-sell |
| **S1 Only** | S1 | STANDARD | Tech signal only |
| **S2 Only** | S2 | STANDARD | Marketing list only |
| **S3 Only** | S3 | STANDARD | SI relationship only |

### Play Multiplier

```
Final Priority = ICP Score × Play Multiplier

Triple Play (S1+S2+S3): 1.5x
Double Play (S1+S2, S2+S3): 1.25x
Single Play: 1.0x
```

### Decision: Triple Play Gets ABM 1:1

> **Triple Play accounts (S1+S2+S3) get ABM 1:1 treatment.**
>
> Double Play accounts get ABM 1:Few.
> Single Play accounts get ABM 1:Many (programmatic).

---

## Layer 4: GTM Campaign

### What It Is

The actual go-to-market execution for accounts that have survived all filters.

### Campaign Types by Priority

| Priority | Campaign Type | Accounts | Approach |
|----------|---------------|----------|----------|
| **Triple Play + ICP Tier 1** | ABM 1:1 | 10-15 | Hyper-personalized, executive dinner, SI warm intro |
| **Double Play + ICP Tier 1** | ABM 1:Few | 25-40 | Segment-based, vertical messaging, multi-touch |
| **Single Play + ICP Tier 1** | ABM 1:Many | 50-100 | Programmatic, automated sequences, content nurture |

### Campaign Elements

| Element | ABM 1:1 | ABM 1:Few | ABM 1:Many |
|---------|---------|-----------|------------|
| **Persona** | CTO + COO | VP Engineering | Engineering Manager |
| **Job Profile** | Named executives | Director-level | Manager-level |
| **Messaging** | "Your stack is AI-ready" | "[Competitor] displacement" | "AI search that works" |
| **Proof Points** | Fashion: 65% of customers | Competitor case studies | Speed to implement |
| **Channels** | Direct, LinkedIn, Executive event | LinkedIn, Email, Paid | Email nurture, Content |
| **Sequence** | 8-touch, 45 days | 6-touch, 30 days | 5-touch, 21 days |
| **SI Leverage** | Warm intro | If available | N/A |

---

## The Complete Funnel Math

### Starting Point: All Partner Tech Accounts

| Stage | Filter | Input | Output | % Remaining |
|-------|--------|-------|--------|-------------|
| **Raw** | None | ~2,800 | 2,800 | 100% |
| **Layer 1** | JACKPOT Cohort | 2,800 | ~200 | 7% |
| **Layer 2** | ICP Tier 1 | 200 | ~60 | 2% |
| **Layer 3** | Triple Play | 60 | ~15 | 0.5% |
| **Layer 4** | Campaign | 15 | 15 | 0.5% |

### The Crème de la Crème

**15 accounts.** That's 0.5% of the total. These 15 get:
- Named account owner (AE)
- Personalized research (Search Audit)
- Executive mapping
- SI partner warm intro
- Custom deck
- 8-touch sequence over 45 days

**This is the machinery.**

---

## Implementation Checklist

### Layer 1: Partner Tech Cohort
- [ ] Query BuiltWith for all partner tech accounts
- [ ] Classify each into cohort (JACKPOT/HIGH/MEDIUM/STANDARD/LOW)
- [ ] Store cohort classification in Supabase
- [ ] Dashboard: Show cohort distribution

### Layer 2: ICP Filter
- [ ] For JACKPOT accounts, extract ICP dimensions:
  - [ ] Vertical (manual tagging or classifier)
  - [ ] Size (SimilarWeb traffic + Yahoo Finance revenue)
  - [ ] Geography (company HQ)
  - [ ] Competitor (BuiltWith search tech)
  - [ ] Persona access (ZoomInfo or hiring signals)
- [ ] Calculate composite ICP score
- [ ] Assign ICP tier
- [ ] Dashboard: Show ICP tier distribution within JACKPOT

### Layer 3: Sales Play Intersection
- [ ] Tag accounts with plays:
  - [ ] S1: From BuiltWith partner tech detection
  - [ ] S2: From marketing list upload
  - [ ] S3: From Crossbeam CSV or manual tagging
- [ ] Calculate intersection (S1+S2+S3, S1+S2, etc.)
- [ ] Apply play multiplier
- [ ] Dashboard: Show play intersection matrix

### Layer 4: GTM Campaign
- [ ] Assign campaign type based on priority
- [ ] Generate persona/job profile targets
- [ ] Create messaging templates
- [ ] Set up sequences in outreach tool
- [ ] Track engagement and conversion

---

## Decision Log

| Decision | Date | Rationale |
|----------|------|-----------|
| ICP is data-derived, not theoretical | 2026-02-27 | Based on 1,848 customer evidence records |
| Fashion/Grocery are Tier 1 verticals | 2026-02-27 | 100% of proof points come from these verticals |
| CMS+Commerce+Hyperscaler = JACKPOT | 2026-02-27 | Highest tech investment signals enterprise readiness |
| Triple Play gets ABM 1:1 | 2026-02-27 | Multi-signal validation = highest conversion probability |
| Media is Tier 3, not Tier 2 | 2026-02-27 | Data shows Media is weak (5% of quotes, 0% proof points) |
| SaaS needs case studies | 2026-02-27 | 15% of quotes but 0% proof points = content gap |
| Cascading > Flat scoring | 2026-02-27 | Filter first, score within filtered set |

---

## Reference Documents

| Document | Purpose | Location |
|----------|---------|----------|
| ICP_ANALYSIS.md | Full ICP analysis with data validation | docs/system/ |
| ICP_DEFINITION.md | Multi-dimensional ICP with scores and codes | docs/system/ |
| COHORT_DEFINITION.md | Partner tech cohort definitions | docs/system/ |
| DECISIONS.md | All key decisions with rationale | project root |
| PRD.md | Full product requirements | project root |

---

## The Philosophy

> **We are not scoring leads. We are building a sales machine.**
>
> The machine takes raw partner tech data and systematically refines it through four layers until we have the absolute best accounts to pursue.
>
> Each layer has a clear purpose:
> - **Layer 1** asks: "Do they have the right tech?"
> - **Layer 2** asks: "Do they fit our ICP?"
> - **Layer 3** asks: "What plays can we run?"
> - **Layer 4** asks: "How do we engage?"
>
> The accounts that survive all four layers are the crème de la crème.
> They get our best effort. They are most likely to close.
>
> This is the Arian sales machinery.

---

*Version 1.0 - Sales Machinery Definition*
*This is the definitive reference for how Arian prioritizes and campaigns accounts.*
*Last Updated: 2026-02-27*
