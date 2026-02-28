# Arian - Product Requirements Document

**Version:** 5.2
**Date:** 2026-02-27
**Status:** Production + Multi-Play Intersection Architecture

---

## Executive Summary

**Arian** is evolving from a Partner Intelligence Platform into a **Unified GTM Account Intelligence Platform** for Algolia Sales. The key insight: **accounts can belong to multiple plays simultaneously**, and accounts at the intersection of multiple plays are highest priority.

**Core Formula:**
```
Priority = f(Play Intersections × Enrichment Signals × Composite Score)
```

**Key Insight:** A Target List account (S2) that also uses partner tech (S1) is instantly validated. Add an SI relationship (S3) and it's a jackpot.

---

## The Intersection Model

### Why Intersections Matter

Instead of assigning each company to ONE play, we **tag every company with ALL applicable plays**. Accounts appearing in multiple plays have compounding validation:

| Scenario | Validation |
|----------|------------|
| S2 only (Target List) | Marketing says they're important, but no proof |
| S1 + S2 (Partner Tech + Target List) | Marketing target PLUS they use our partner tech = instant validation |
| S2 + S3 (Target List + SI Connected) | Marketing target PLUS an SI already knows them = warm intro |
| S1 + S2 + S3 (All Three) | JACKPOT - validated from every angle |

### Visual: Venn Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        S1: Partner Tech                         │
│                    (uses Adobe/Amplience/etc)                   │
│                                                                 │
│              ┌─────────────────────────────────┐                │
│              │                                 │                │
│              │      S1 + S2                    │                │
│              │   "Target List uses our         │                │
│              │    partner tech"                │                │
│    ┌─────────┼─────────┐        VALIDATED     │                │
│    │         │ S1+S2+S3│                       │                │
│    │         │ JACKPOT │                       │                │
│    │         └─────────┼───────────────────────┼────────┐       │
│    │    S3             │                       │        │       │
│    │ (SI Connected)    │      S2: Target List │        │       │
│    │                   │      (Marketing List) │        │       │
│    │                   │                       │        │       │
│    │      S2 + S3      │                       │        │       │
│    │   "SI knows the   │                       │        │       │
│    │    target"        │                       │        │       │
│    └───────────────────┴───────────────────────┘        │       │
│                                                          │       │
└──────────────────────────────────────────────────────────┘       │
```

---

## Three Sales Plays

### S1: Partner Tech Play

**Definition:** Company uses a technology from one of our partners (Adobe AEM, Amplience, Spryker, etc.)

**How Tagged:**
- BuiltWith detection of partner technology
- Crossbeam: `partner_type='tech_vendor' AND partner_status='customer'`

**Signals That Make S1 Stronger:**
- Uses multiple partner techs
- High traffic volume
- Weak current search implementation

---

### S2: Target List Play (Whale Accounts)

**Definition:** Company appears on a marketing-provided target account list (ABM, named accounts, etc.)

**How Tagged:**
- Upload from Salesforce, Demandbase, 6sense
- Manual list upload
- `source_list` field populated

**Signals That Make S2 Stronger:**
- Appears on multiple lists
- High ICP score from marketing
- Executive sponsorship

---

### S3: SI Connected Play

**Definition:** Company has an existing relationship with a System Integrator partner (EPAM, Isobar, Valtech, etc.)

**How Tagged:**
- Crossbeam: `partner_type='si_partner' AND partner_status IN ('customer', 'prospect')`
- Manual SI partner mapping

**Signals That Make S3 Stronger:**
- SI is "customer" (not just "prospect")
- Company uses competitor search tech (Lucidworks, Elasticsearch)
- Active project with SI

---

## Priority Matrix

### Intersection Priority Ranking

| Rank | Intersection | User Label | Count | Priority | Action |
|------|--------------|------------|-------|----------|--------|
| 1 | S1 + S2 + S3 | **Jackpot** | ~12 | 🔥🔥🔥 | Immediate AE assignment |
| 2 | S1 + S2 | **Partner Match** | ~87 | 🔥🔥 | Enrich + outreach |
| 3 | S2 + S3 | **SI Warm Intro** | ~34 | 🔥🔥 | SI intro request |
| 4 | S1 + S3 | **Co-Sell Ready** | ~156 | 🔥 | Partner co-sell motion |
| 5 | S1 only | Partner Tech Only | ~2,187 | Standard | Standard displacement |
| 6 | S2 only | Target List Only | ~879 | Standard | Needs enrichment |
| 7 | S3 only | SI Connected Only | ~245 | Low | SI relationship only |

### Scoring by Intersection Count

```
Final Priority = Composite Score × Intersection Multiplier

Intersection Multiplier:
- 3 plays: 1.5x
- 2 plays: 1.25x
- 1 play: 1.0x
```

---

## Play-Specific Scoring Weights

Even within the composite score, weights vary by play context:

| Factor | S1: Partner Tech | S2: Target List | S3: SI Connected | Intersection (2+) |
|--------|------------------|-----------------|------------------|-------------------|
| **Fit** | 20% | 30% | 15% | 20% |
| **Intent** | 25% | 25% | 20% | 25% |
| **Value** | 25% | 30% | 25% | 25% |
| **Displacement** | 30% | 15% | 40% | 30% |

**Rationale:**
- **S1** emphasizes displacement (is their current search bad?)
- **S2** focuses on Fit + Value - pure ABM prioritization
- **S3** heavily weights displacement (40%) - SI plays are about ripping out competitors
- **Intersections** use balanced weights since validation comes from multiple angles

---

## Data Model

### Play Tagging Schema

```sql
-- Three boolean columns for play tagging
ALTER TABLE displacement_targets ADD COLUMN
  is_s1_tech_partner BOOLEAN DEFAULT false,    -- Uses partner tech
  is_s2_target_list BOOLEAN DEFAULT false,     -- On marketing list (whale)
  is_s3_si_connected BOOLEAN DEFAULT false;    -- Has SI relationship

-- Generated column for intersection count (0, 1, 2, or 3)
ALTER TABLE displacement_targets ADD COLUMN
  play_intersection_count INTEGER GENERATED ALWAYS AS (
    (CASE WHEN is_s1_tech_partner THEN 1 ELSE 0 END) +
    (CASE WHEN is_s2_target_list THEN 1 ELSE 0 END) +
    (CASE WHEN is_s3_si_connected THEN 1 ELSE 0 END)
  ) STORED;

-- Index for fast intersection queries
CREATE INDEX idx_play_intersections ON displacement_targets(play_intersection_count DESC);
```

### Supporting Tables

```sql
-- Crossbeam overlaps (for S1 and S3 tagging)
CREATE TABLE crossbeam_overlaps (
  domain TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  partner_type TEXT NOT NULL,         -- 'tech_vendor' or 'si_partner'
  algolia_status TEXT,                -- 'prospect', 'customer'
  partner_status TEXT,                -- 'customer', 'prospect'
  PRIMARY KEY (domain, partner_name, partner_type)
);

-- Source lists (for S2 tagging)
CREATE TABLE source_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT,                        -- 'salesforce', 'demandbase', '6sense'
  account_count INTEGER,
  created_at TIMESTAMPTZ
);

-- SI partner relationships (for S3 tagging)
CREATE TABLE account_si_partners (
  domain TEXT NOT NULL,
  si_partner TEXT NOT NULL,
  relationship_type TEXT,             -- 'customer', 'prospect'
  PRIMARY KEY (domain, si_partner)
);
```

---

## User Interface

### Terminology: Internal Codes vs User-Facing Labels

**CRITICAL: S1, S2, S3 are internal codes for documentation only. Users see human-readable labels.**

| Internal Code | User-Facing Label | Icon | Description |
|---------------|-------------------|------|-------------|
| S1 | **Partner Tech** | 🤝 | Uses Adobe, Amplience, Spryker |
| S2 | **Target List** | 📋 | On marketing ABM/named account list |
| S3 | **SI Connected** | 🔗 | Has EPAM, Isobar, Valtech relationship |

**Intersection Labels (what users see):**

| Internal | User Label | What It Means |
|----------|------------|---------------|
| S1+S2+S3 | **⭐ Jackpot** | Target list + Partner tech + SI connected |
| S1+S2 | **🤝 Partner Match** | Target list company that uses our partner tech |
| S2+S3 | **🔗 SI Warm Intro** | Target list company that SI already knows |
| S1+S3 | **🤝🔗 Co-Sell Ready** | Partner tech user with SI relationship |

### Dashboard: Intersection Matrix

```
┌────────────────────────────────────────────────────────────────────┐
│  Arian - Account Intelligence              [Upload] [⚙️]    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  🎯 High-Value Matches (accounts validated from multiple angles)  │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  ⭐ JACKPOT      │  │  🤝 PARTNER      │  │  🔗 SI WARM      │ │
│  │                  │  │    MATCH         │  │    INTRO         │ │
│  │  Target List +   │  │                  │  │                  │ │
│  │  Partner Tech +  │  │  Target List +   │  │  Target List +   │ │
│  │  SI Connected    │  │  Partner Tech    │  │  SI Connected    │ │
│  │                  │  │                  │  │                  │ │
│  │   12 accounts    │  │   87 accounts    │  │   34 accounts    │ │
│  │   🔥🔥🔥           │  │   🔥🔥            │  │   🔥🔥            │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                    │
│  ┌──────────────────┐                                             │
│  │  🤝🔗 CO-SELL    │                                             │
│  │      READY       │                                             │
│  │                  │                                             │
│  │  Partner Tech +  │                                             │
│  │  SI Connected    │                                             │
│  │                  │                                             │
│  │   156 accounts   │                                             │
│  │   🔥              │                                             │
│  └──────────────────┘                                             │
│                                                                    │
│  ────────────────────────────────────────────────────────────────  │
│                                                                    │
│  📊 Single-Signal Accounts (need enrichment or validation)        │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  🤝 Partner Tech │  │  📋 Target List  │  │  🔗 SI Connected │ │
│  │     Only         │  │     Only         │  │     Only         │ │
│  │                  │  │                  │  │                  │ │
│  │  Uses Adobe,     │  │  On ABM list but │  │  EPAM, Isobar    │ │
│  │  Amplience, etc. │  │  needs enrichment│  │  knows them      │ │
│  │                  │  │                  │  │                  │ │
│  │  2,187 accounts  │  │  879 accounts    │  │  245 accounts    │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                    │
│  📈 Recent Activity                                                │
│  • 47 accounts enriched today                                      │
│  • 3 new Partner Matches found (were Target List only)            │
│  • Crossbeam sync: 2 hours ago                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Account List View

Shows play tags as descriptive badges (not S1/S2/S3):

```
┌────────┬──────────────┬─────────────────────────────────────┬───────┬───────┐
│ Status │ Company      │ Signals                             │Traffic│ Score │
├────────┼──────────────┼─────────────────────────────────────┼───────┼───────┤
│ 🔥 Hot │ costco.com   │ [🤝 Adobe] [📋 ABM List] [🔗 EPAM] │ 450M  │ 92    │
│ 🔥 Hot │ nordstrom.com│ [🤝 Adobe] [📋 ABM List]           │ 89M   │ 87    │
│ 🌡 Warm│ target.com   │ [📋 ABM List]                      │ 2.1B  │ 65    │
│ 🌡 Warm│ acme.com     │ [🤝 Amplience] [🔗 Isobar]         │ 12M   │ 58    │
└────────┴──────────────┴─────────────────────────────────────┴───────┴───────┘
```

### Company Drawer

Shows specific details, not codes:

```
┌─────────────────────────────────────────────────────────────────┐
│  costco.com                                          [Enrich]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⭐ JACKPOT - Validated from 3 Angles                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🤝 Partner Tech                                          │   │
│  │    Uses: Adobe Experience Manager                        │   │
│  │    Crossbeam: Customer of Adobe since 2019               │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 📋 Target List                                           │   │
│  │    On Lists: FY26 ABM Q1, CMO Priority                  │   │
│  │    Added: Jan 15, 2026                                   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 🔗 SI Connected                                          │   │
│  │    EPAM is their implementation partner                  │   │
│  │    Current Search: Lucidworks (displacement target)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📊 Composite Score: 92 (Hot)                                  │
│  [Score breakdown accordion...]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Crossbeam Integration

### Data Flow

```
Crossbeam Export (CSV)
        │
        ▼
Upload to Arian
        │
        ▼
Parse & Match to Existing Accounts
        │
        ├─── Tech Vendor match → Set is_s1_tech_partner = true
        │
        └─── SI Partner match → Set is_s3_si_connected = true
```

### MVP: CSV Import

For MVP, users export from Crossbeam and upload:

1. Export "Account Overlaps" from Crossbeam
2. Upload CSV to Arian
3. System matches by domain and tags plays
4. Intersection counts update automatically

### Future: API Integration

- OAuth connection to Crossbeam
- Real-time sync on account changes
- Bidirectional: Push Algolia status back

---

## Implementation Phases

### Phase 1: Foundation (Current Sprint)

- [x] Multi-factor composite scoring
- [ ] Play tagging database schema (3 boolean columns)
- [ ] Intersection count generated column
- [ ] Dashboard intersection matrix UI
- [ ] Play badge display on accounts

### Phase 2: Target List & Crossbeam Integration

- [ ] Crossbeam CSV import parser
- [ ] Auto-tagging S1/S3 from Crossbeam data
- [ ] Source list tracking for S2
- [ ] SI partner cohort view for S3

### Phase 3: Advanced Features

- [ ] Batch enrichment queue
- [ ] Export to Salesforce with play tags
- [ ] Crossbeam API integration
- [ ] Real-time intersection alerts

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-27 | Tag accounts with ALL applicable plays, not one | Intersections are highest value - a target list account using partner tech is instant validation |
| 2026-02-27 | Use 3 boolean columns, not enum | Allows multi-play tagging and generated intersection count |
| 2026-02-27 | S2 = Target List, S3 = SI Connected | Target List is the primary input (upload), SI is discovered via Crossbeam |
| 2026-02-27 | Primary grouping by SI partner for S3 | Sales teams organized around partner relationships |
| 2026-02-27 | Intersection multiplier on composite score | 3-play accounts get 1.5x, 2-play get 1.25x |
| 2026-02-27 | MVP Crossbeam via CSV, API later | Faster to ship, validate model before API investment |
| 2026-02-27 | "Orphan accounts" (no SI) are a cohort | These are opportunities to pitch to SI partners |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Intersection identification | 95% of multi-play accounts tagged |
| Time to qualified list | < 5 minutes |
| Jackpot (3-play) → Meeting | > 50% conversion |
| Partner Match (S1+S2) → Opportunity | > 30% conversion |
| Pipeline from intersections | $500K (6 months) |

---

## Open Questions

1. **Crossbeam access**: CSV export or API?
2. **SI partner seed list**: EPAM, Isobar, Valtech - who else?
3. **Intersection alerts**: Notify when new 2+ play account found?
4. **Play history**: Track when tags were added/removed?

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture |
| [CLAUDE.md](./CLAUDE.md) | Development guidelines |
| [DECISIONS.md](./DECISIONS.md) | Full decision log |

---

*Last updated: 2026-02-27*
