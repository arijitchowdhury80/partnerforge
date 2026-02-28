# Arian Play System

**Version:** 1.0
**Date:** 2026-02-27
**Purpose:** Comprehensive documentation of the three-play tagging system and intersection model

---

## Overview

Arian uses a **multi-play tagging system** to identify and prioritize accounts. Every account can belong to one, two, or all three plays simultaneously. **Accounts at the intersection of multiple plays are the highest priority** because they are validated from multiple angles.

---

## The Three Plays

### S1: Partner Tech

| Attribute | Value |
|-----------|-------|
| **Internal Code** | S1 |
| **User Label** | Partner Tech |
| **Icon** | 🤝 |
| **Color** | Blue |

**Definition:**
Company uses a technology from one of Algolia's partners (Adobe AEM, Amplience, Spryker, etc.)

**How It's Tagged:**
- BuiltWith detection of partner technology
- Crossbeam data: `partner_type='tech_vendor' AND partner_status='customer'`

**Example Badge:** `[🤝 Adobe]` or `[🤝 Amplience]`

**Why It Matters:**
These companies already have a relationship with our partner. The partner can make a warm introduction or co-sell with us.

---

### S2: Target List

| Attribute | Value |
|-----------|-------|
| **Internal Code** | S2 |
| **User Label** | Target List |
| **Icon** | 📋 |
| **Color** | Green |

**Definition:**
Company appears on a marketing-provided target account list (ABM list, named accounts, strategic accounts, etc.)

**How It's Tagged:**
- Upload from Salesforce, Demandbase, 6sense
- Manual CSV upload
- `source_list` field populated

**Example Badge:** `[📋 ABM List]` or `[📋 Q1 Targets]`

**Why It Matters:**
Marketing has already identified these as important accounts. They represent strategic priorities for the business.

---

### S3: SI Connected

| Attribute | Value |
|-----------|-------|
| **Internal Code** | S3 |
| **User Label** | SI Connected |
| **Icon** | 🔗 |
| **Color** | Purple |

**Definition:**
Company has an existing relationship with a System Integrator partner (EPAM, Isobar, Valtech, etc.)

**How It's Tagged:**
- Crossbeam data: `partner_type='si_partner' AND partner_status IN ('customer', 'prospect')`
- Manual SI partner mapping

**Example Badge:** `[🔗 EPAM]` or `[🔗 Isobar]`

**Why It Matters:**
The SI partner already knows this company and can facilitate introductions. SI plays are often about competitive displacement (replacing Lucidworks, Elasticsearch, etc.).

---

## The Intersection Model

### Key Insight

**Accounts can belong to multiple plays.** When they do, they become more valuable because they're validated from multiple angles.

Think of it like a Venn diagram with three overlapping circles:

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    │           🤝 PARTNER TECH (S1)          │
                    │         Uses Adobe, Amplience, etc.     │
                    │                                         │
                    │       ┌─────────────────────┐           │
                    │       │                     │           │
                    │       │    S1 + S2          │           │
                    │       │  PARTNER MATCH      │           │
                    │       │                     │           │
          ┌─────────┼───────┼─────────┐          │           │
          │         │       │         │          │           │
          │         │       │ S1+S2+S3│          │           │
          │         │       │ JACKPOT │          │           │
          │         │       │   ⭐     │          │           │
          │         │       └─────────┼──────────┼───────────┼───────┐
          │         │                 │          │           │       │
          │   🔗 SI │                 │          │           │       │
          │CONNECTED│     S2 + S3    │    📋 TARGET LIST    │       │
          │  (S3)   │   SI WARM INTRO │         (S2)         │       │
          │         │                 │  On ABM/Marketing    │       │
          │  EPAM,  │                 │       List           │       │
          │ Isobar, │                 │                      │       │
          │ Valtech │                 │                      │       │
          │         │                 │                      │       │
          │  S1+S3  │                 │                      │       │
          │ CO-SELL │                 │                      │       │
          │  READY  │                 │                      │       │
          └─────────┴─────────────────┴──────────────────────┘       │
                                                                      │
```

---

## Priority Matrix

### Intersection Rankings

| Rank | Plays | Label | Priority | What It Means |
|------|-------|-------|----------|---------------|
| **1** | S1 + S2 + S3 | **⭐ Jackpot** | 🔥🔥🔥 Highest | Target List company + uses our partner tech + SI knows them |
| **2** | S1 + S2 | **🤝 Partner Match** | 🔥🔥 High | Target List company that uses our partner tech |
| **3** | S2 + S3 | **🔗 SI Warm Intro** | 🔥🔥 High | Target List company that SI already knows |
| **4** | S1 + S3 | **🤝🔗 Co-Sell Ready** | 🔥 Medium | Partner tech user with SI relationship |
| **5** | S1 only | Partner Tech Only | Standard | Uses partner tech, not on target list |
| **6** | S2 only | Target List Only | Standard | On target list, needs validation |
| **7** | S3 only | SI Connected Only | Low | SI knows them, but not prioritized |

### Why Intersections Matter

| Scenario | Why It's More Valuable |
|----------|----------------------|
| **S1 + S2** (Partner Match) | Marketing said this account matters, AND they use our partner's tech. Instant validation - we know they're in our ICP and have a warm path in. |
| **S2 + S3** (SI Warm Intro) | Marketing said this account matters, AND an SI partner already has a relationship. We can get a warm introduction. |
| **S1 + S2 + S3** (Jackpot) | Validated from THREE angles. Marketing prioritized them, they use our partner tech, AND an SI knows them. These are the easiest deals to close. |

---

## Scoring by Play Type

### The Four Scoring Factors

| Factor | What It Measures |
|--------|------------------|
| **Fit** | How well the company matches our ICP (vertical, size, geography) |
| **Intent** | Buying signals (traffic trends, exec quotes, hiring signals) |
| **Value** | Potential deal size (revenue, traffic, store count) |
| **Displacement** | How easy it is to replace their current search (weak search, competitor tech) |

### Play-Specific Weights

Different plays emphasize different factors:

| Factor | S1: Partner Tech | S2: Target List | S3: SI Connected |
|--------|------------------|-----------------|------------------|
| **Fit** | 20% | **30%** | 15% |
| **Intent** | 25% | 25% | 20% |
| **Value** | 25% | **30%** | 25% |
| **Displacement** | **30%** | 15% | **40%** |

### Why These Weights?

| Play | Rationale |
|------|-----------|
| **S1: Partner Tech** | Displacement matters most (30%) because we need to prove their current search is weak. The partner relationship is already warm. |
| **S2: Target List** | Fit + Value matter most (30% each = 60% combined) because marketing has already said these accounts are important. We just need to confirm they're real opportunities. |
| **S3: SI Connected** | Displacement is critical (40%) because SI plays are fundamentally about ripping out competitors (Lucidworks, Elasticsearch, Coveo). |

### Intersection Multiplier

Accounts in multiple plays get a scoring boost:

```
Final Score = Composite Score × Intersection Multiplier

Multipliers:
- 3 plays (Jackpot): 1.5x
- 2 plays: 1.25x
- 1 play: 1.0x
```

**Example:**
An account with a base score of 80:
- Single play: 80 × 1.0 = **80**
- Two plays: 80 × 1.25 = **100**
- Three plays: 80 × 1.5 = **120** (capped at 100 for display)

---

## User Interface Labels

### Badge Display

Users never see S1, S2, S3 codes. They see descriptive badges:

```
✅ Correct: [🤝 Adobe] [📋 ABM List] [🔗 EPAM]
❌ Wrong:   [S1] [S2] [S3]
```

### Intersection Tile Labels

| Intersection | Tile Label | Subtitle |
|--------------|------------|----------|
| S1+S2+S3 | **⭐ JACKPOT** | Target List + Partner Tech + SI Connected |
| S1+S2 | **🤝 PARTNER MATCH** | Target List + Partner Tech |
| S2+S3 | **🔗 SI WARM INTRO** | Target List + SI Connected |
| S1+S3 | **🤝🔗 CO-SELL READY** | Partner Tech + SI Connected |

### Single-Play Tile Labels

| Play | Tile Label | Subtitle |
|------|------------|----------|
| S1 only | **🤝 Partner Tech** | Uses Adobe, Amplience, etc. |
| S2 only | **📋 Target List** | On ABM list, needs validation |
| S3 only | **🔗 SI Connected** | EPAM, Isobar knows them |

---

## Database Schema

### Play Tagging Columns

```sql
-- Three boolean columns (NOT a single enum!)
is_s1_tech_partner BOOLEAN DEFAULT false,    -- 🤝 Partner Tech
is_s2_target_list BOOLEAN DEFAULT false,     -- 📋 Target List
is_s3_si_connected BOOLEAN DEFAULT false,    -- 🔗 SI Connected

-- Auto-calculated intersection count (0, 1, 2, or 3)
play_intersection_count INTEGER GENERATED ALWAYS AS (
  (CASE WHEN is_s1_tech_partner THEN 1 ELSE 0 END) +
  (CASE WHEN is_s2_target_list THEN 1 ELSE 0 END) +
  (CASE WHEN is_s3_si_connected THEN 1 ELSE 0 END)
) STORED;
```

### Why Boolean Columns?

Using three boolean columns instead of a single enum allows:
1. **Multi-tagging**: An account can be in multiple plays
2. **Easy querying**: `WHERE is_s1_tech_partner AND is_s2_target_list`
3. **Generated count**: Database calculates intersection count automatically
4. **Flexible indexing**: Can index on any combination

---

## Example Account

### Costco (costco.com)

| Field | Value |
|-------|-------|
| **Domain** | costco.com |
| **Company** | Costco Wholesale |
| **Partner Tech (S1)** | ✅ Uses Adobe Experience Manager |
| **Target List (S2)** | ✅ On FY26 ABM Q1, CMO Priority List |
| **SI Connected (S3)** | ✅ EPAM is their implementation partner |
| **Intersection** | **3 (Jackpot)** |
| **Composite Score** | 92 |
| **Final Score** | 92 × 1.5 = 100 (capped) |

**Display:**
```
costco.com   ⭐ JACKPOT   [🤝 Adobe] [📋 ABM List] [🔗 EPAM]   Score: 100
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Play** | A category of accounts based on how we discovered or validated them |
| **Intersection** | When an account belongs to 2+ plays |
| **Jackpot** | An account in all three plays (highest priority) |
| **Partner Match** | Target List account that uses our partner tech |
| **SI Warm Intro** | Target List account that SI partner knows |
| **Co-Sell Ready** | Partner tech user that SI partner knows |
| **Orphan Account** | Account using competitor tech but with no SI relationship |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD.md](../PRD.md) | Full product requirements |
| [DECISIONS.md](../DECISIONS.md) | Decision log with rationale |
| [CLAUDE.md](../CLAUDE.md) | Development guidelines |

---

*Last updated: 2026-02-27*
