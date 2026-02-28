# Arian v2 - Product Requirements Document

**Version:** 2.0
**Date:** 2026-02-27
**Status:** In Progress (M1: Galaxy Foundation)

---

## Executive Summary

Arian v2 transforms from a simple target list into a **5-layer sales intelligence funnel** that starts with the Partner Tech Galaxy and cascades down to prioritized ABM targets.

---

## Core Concept Change

| v1 | v2 |
|----|-----|
| Static target list | Dynamic 5-layer funnel |
| Single score (ICP) | Composite scoring across layers |
| Partner = filter | Partner Tech = foundation |
| Flat list view | Galaxy → Cohort → Funnel visualization |

---

## The 5-Layer Funnel

```
Layer 0: Partner Tech Galaxy     → The data universe (from BuiltWith)
Layer 1: Tech Cohorts            → JACKPOT / HIGH / MEDIUM / BASE
Layer 2: Whale Composite         → Intent + qualification filter
Layer 3: Crossbeam Overlap       → Warm intro filter
Layer 4: ICP Classification      → Industry-based prioritization
Layer 5: Sales Play              → Displacement vs Greenfield
```

---

## User Stories

### US-1: Galaxy Explorer
**As a** sales ops manager
**I want to** see all companies using partner technologies
**So that** I can understand the total addressable market

**Acceptance Criteria:**
- View companies grouped by 4 galaxies (CMS, Commerce, MarTech, Search)
- Filter by any combination of technologies
- See tech cohort classification (JACKPOT/HIGH/MEDIUM/BASE)
- See sales play classification (DISPLACEMENT/GREENFIELD)
- Export filtered list to CSV

### US-2: Funnel Visualization
**As a** sales leader
**I want to** see how accounts cascade through the 5 layers
**So that** I can understand funnel conversion and prioritize resources

**Acceptance Criteria:**
- Visual funnel showing count at each layer
- Click any layer to see accounts at that stage
- See conversion % between layers
- Identify bottlenecks

### US-3: Cream Set Dashboard
**As an** account executive
**I want to** see the highest-priority targets (cream set)
**So that** I can focus my outreach on accounts most likely to convert

**Acceptance Criteria:**
- See accounts that pass ALL layers (Partner Tech + Whale + Crossbeam)
- Sorted by composite score
- See ICP fit, sales play, and partner context
- One-click to company detail drawer

### US-4: Company Deep Dive
**As an** account executive
**I want to** see full context on a target company
**So that** I can personalize my outreach

**Acceptance Criteria:**
- Tech stack (CMS, Commerce, MarTech, Search)
- Whale data (intent signals, firmographics)
- Crossbeam data (partner relationship, owner)
- ICP fit (industry confidence, proof points)
- Enrich button for additional data (SimilarWeb, financials)

---

## Data Model

### Primary Table: `companies`

| Column | Type | Description |
|--------|------|-------------|
| domain | VARCHAR(255) PK | Company domain |
| company_name | VARCHAR(255) | Display name |
| cms_tech | VARCHAR(50) | CMS technology |
| commerce_tech | VARCHAR(50) | Commerce technology |
| martech_tech | VARCHAR(50) | MarTech technology |
| search_tech | VARCHAR(50) | Search technology |
| tech_cohort | VARCHAR(20) | Computed: JACKPOT/HIGH/MEDIUM/BASE |
| sales_play | VARCHAR(20) | Computed: DISPLACEMENT/GREENFIELD |

### Layer Tables (Existing)

| Table | Purpose |
|-------|---------|
| whale_composite | Layer 2: Intent + firmographics |
| crossbeam_overlaps | Layer 3: Partner relationships |
| industries | Layer 4: ICP reference |

### Views

| View | Purpose |
|------|---------|
| galaxy_summary | Counts per technology |
| cohort_summary | Counts per cohort |
| funnel_master | Full 5-layer join |
| cream_set | Triple-validated accounts |
| hot_targets | Score >= 70 |

---

## API Contracts

### GET /companies
Query companies with filters.

**Query Params:**
- `cms_tech` - Filter by CMS
- `commerce_tech` - Filter by Commerce
- `martech_tech` - Filter by MarTech
- `search_tech` - Filter by Search
- `tech_cohort` - Filter by cohort
- `sales_play` - Filter by sales play
- `limit` - Pagination
- `offset` - Pagination

**Response:**
```json
{
  "data": [
    {
      "domain": "nordstrom.com",
      "company_name": "Nordstrom",
      "cms_tech": "AEM",
      "commerce_tech": "SFCC",
      "martech_tech": "SFMC",
      "search_tech": "Elastic",
      "tech_cohort": "JACKPOT",
      "sales_play": "DISPLACEMENT"
    }
  ],
  "total": 2847,
  "limit": 50,
  "offset": 0
}
```

### GET /galaxy-summary
Get counts per technology.

**Response:**
```json
{
  "cms": [
    { "tech": "AEM", "count": 2400, "displacement": 450, "greenfield": 1950 }
  ],
  "commerce": [...],
  "martech": [...],
  "search": [...]
}
```

### GET /cohort-summary
Get counts per tech cohort.

**Response:**
```json
[
  { "cohort": "JACKPOT", "count": 234, "displacement": 89, "greenfield": 145 },
  { "cohort": "HIGH", "count": 891, "displacement": 156, "greenfield": 735 },
  ...
]
```

### GET /funnel-summary
Get funnel conversion stats.

**Response:**
```json
{
  "layer0_galaxy": 10000,
  "layer2_whale": 776,
  "layer3_crossbeam": 412,
  "cream_set": 203,
  "hot_targets": 47
}
```

---

## UI Components

### New Components (v2)

| Component | Purpose |
|-----------|---------|
| `GalaxyExplorer` | Main page for Layer 0 |
| `GalaxyCard` | Summary card for each galaxy |
| `GalaxyFilters` | Multi-select filters for techs |
| `CohortBadge` | JACKPOT/HIGH/MEDIUM/BASE badge |
| `SalesPlayBadge` | DISPLACEMENT/GREENFIELD badge |
| `FunnelChart` | Visual funnel diagram |
| `FunnelLayer` | Clickable layer in funnel |

### Reused Components (v1)

| Component | Adaptation Needed |
|-----------|-------------------|
| `CompanyDrawer` | Update fields for new schema |
| `TableFilters` | Add new filter options |
| `ErrorNotification` | None |
| `ExportButton` | None |

### Archived Components (v1)

| Component | Reason |
|-----------|--------|
| `DistributionGrid` | Replaced by GalaxyExplorer |
| `HeatmapGrid` | Not needed in v2 |
| `QuickLookCard` | Replaced by simplified row |

---

## Milestones

### M1: Galaxy Foundation (Week 1)
- [x] Create Layer 0 schema (`companies` table)
- [x] Run migration in Supabase (20260227_layer0_companies.sql)
- [x] Build GalaxyExplorer UI (pages/GalaxyExplorer.tsx)
- [x] Build galaxyApi service (services/galaxyApi.ts)
- [x] Update App.tsx routing
- [ ] Fetch BuiltWith data (parallel threads)
- [ ] Import data into `companies`

### M2: Funnel Layers (Week 2)
- [ ] Build funnel_master view
- [ ] Build FunnelChart component
- [ ] Connect to Whale + Crossbeam data
- [ ] Build cream_set view

### M3: Scoring & Prioritization (Week 3)
- [ ] Update scoring service for 5-layer model
- [ ] Build hot_targets view
- [ ] Add ICP integration
- [ ] Build CompanyDrawer v2

### M4: Polish & Launch (Week 4)
- [ ] Export functionality
- [ ] Error handling
- [ ] Performance optimization
- [ ] Leadership demo

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Galaxy data loaded | 10,000+ companies |
| Cream set identified | 100-300 accounts |
| Hot targets | 30-50 accounts |
| Time to first outreach list | < 5 minutes |

---

## Out of Scope (v2)

- Real-time BuiltWith sync (manual refresh)
- Automated enrichment (on-demand only)
- Salesforce integration
- Email sequences
- Contact data

---

## Dependencies

| Dependency | Status |
|------------|--------|
| BuiltWith API | Have key |
| SimilarWeb API | Have key |
| Supabase | Running |
| Vercel | Running |
