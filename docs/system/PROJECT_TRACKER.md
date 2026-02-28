# Arian - Project Tracker

**Version:** 5.0
**Status:** Production
**Last Updated:** 2026-02-26
**Repository:** https://github.com/arijitchowdhury80/arian

---

## Executive Summary

Arian is a Partner Intelligence Platform for Algolia Sales that identifies displacement opportunities by finding companies using partner technologies (Adobe AEM, Shopify, Amplience, Spryker) who are NOT using Algolia.

### Core Formula
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

---

## Live Deployment

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | https://arian.vercel.app | ✅ Live |
| **Database** | Supabase (xbitqeejsgqnwvxlnjra) | ✅ Live |
| **Repository** | https://github.com/arijitchowdhury80/arian | ✅ Active |

---

## Current Statistics

| Metric | Value |
|--------|-------|
| **Total Targets** | ~2,800 |
| **Partners Tracked** | 4 (AEM, Commerce, Amplience, Spryker) |
| **Hot Leads (70+)** | Variable (composite score) |
| **Warm Leads (40-69)** | Variable |

### Partner Breakdown

| Partner | Target Count |
|---------|--------------|
| Adobe Experience Manager | ~2,700 |
| Adobe Commerce | ~18 |
| Amplience | ~32 |
| Spryker | ~28 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite + Mantine |
| **Database** | Supabase PostgreSQL |
| **API** | Supabase REST API (PostgREST) |
| **Hosting** | Vercel (Frontend) |

---

## Enrichment Architecture v3

**Clean, modular architecture: 1 source = 1 module**

```
services/enrichment/v3/
├── index.ts           # The umbrella - main entry point
├── types.ts           # All shared types
└── sources/
    ├── index.ts       # Source registry
    ├── similarweb.ts  # Traffic, engagement, competitors
    ├── builtwith.ts   # Tech stack, search provider
    ├── yahoofinance.ts # Financials, analyst ratings
    ├── secedgar.ts    # SEC filings, risk factors
    ├── websearch.ts   # Executive quotes, strategic signals
    └── jsearch.ts     # Hiring signals (jobs)
```

### Usage

```typescript
import { enrich, enrichBatch } from '@/services/enrichment/v3';

// Enrich ALL sources
await enrich('costco.com');

// Enrich specific sources
await enrich('costco.com', { sources: ['similarweb', 'builtwith'] });

// Single source
await enrich('costco.com', { sources: ['jsearch'] });
```

### Data Sources

| Source | Module | Auth | Key Data |
|--------|--------|------|----------|
| SimilarWeb | `similarweb.ts` | API Key | Traffic, bounce rate, competitors |
| BuiltWith | `builtwith.ts` | API Key | Tech stack, search provider, CMS |
| Yahoo Finance | `yahoofinance.ts` | None | 3-yr financials, analyst ratings |
| SEC EDGAR | `secedgar.ts` | None | 10-K/10-Q filings, risk factors |
| WebSearch | `websearch.ts` | Backend | Executive quotes, strategic signals |
| JSearch | `jsearch.ts` | API Key | Job postings, hiring signals |

### Adding a New Source

1. Create `sources/newsource.ts` implementing `SourceModule<T>`
2. Add export in `sources/index.ts`
3. Done!

---

## Composite Scoring Model

**Enrichment now automatically calculates and saves composite scores.**

When a company is enriched via `enrichAndSave()`, the system:
1. Fetches data from all sources (SimilarWeb, BuiltWith, Yahoo Finance, etc.)
2. Calculates a multi-factor composite score
3. Saves the score to `icp_score` column in the database
4. Derives status (`hot`, `warm`, `cold`) from the score

Companies are scored 0-100 based on 4 factors (25% each):

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| **Fit** | 25% | Vertical, company size, geography, public vs private |
| **Intent** | 25% | Traffic, weak search platform, hiring signals, exec quotes, SEC risk factors |
| **Value** | 25% | Revenue, traffic volume, revenue growth, analyst ratings, profit margins |
| **Displacement** | 25% | Current search provider, partner tech strength, bounce rate, competitor Algolia adoption |

### Priority Classification

| Score | Priority | Action |
|-------|----------|--------|
| 70-100 | HOT | Immediate outreach |
| 40-69 | WARM | Queue for enrichment |
| 0-39 | COLD | Deprioritize |

### Confidence Levels

| Level | Data Completeness |
|-------|-------------------|
| High | ≥70% of data points (23 total) |
| Medium | 40-69% |
| Low | <40% |

---

## Project Structure

```
Arian/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/          # UI components
│   │   ├── services/
│   │   │   ├── enrichment/v3/   # NEW: Modular enrichment
│   │   │   ├── scoring.ts       # Composite scoring
│   │   │   └── supabase.ts      # Database client
│   │   ├── lib/constants.ts     # Shared constants
│   │   └── types/               # TypeScript definitions
│   └── package.json
├── docs/
│   └── ENRICHMENT_PIPELINE.md   # Full enrichment documentation
├── supabase/                    # Database migrations
├── README.md                    # Project overview
├── ARCHITECTURE.md              # Technical architecture
├── PRD.md                       # Product requirements
└── PROJECT_TRACKER.md           # This file
```

---

## Recent Milestones

| Date | Milestone |
|------|-----------|
| 2026-02-26 | **Composite Scoring Integration** - Enrichment auto-calculates & saves scores |
| 2026-02-26 | **Score Threshold Update** - Hot now 70+ (was 80+) |
| 2026-02-26 | **Enrichment v3 Architecture** - Clean modular design |
| 2026-02-26 | Added JSearch (hiring signals) module |
| 2026-02-26 | Added Yahoo Finance module (10 endpoints) |
| 2026-02-26 | Added SEC EDGAR module |
| 2026-02-26 | Composite scoring (4-factor model) |
| 2026-02-26 | Migrated to Supabase, removed Railway backend |
| 2026-02-25 | Added Amplience & Spryker partner targets |

---

## Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://xbitqeejsgqnwvxlnjra.supabase.co
VITE_SUPABASE_KEY=xxx

# Enrichment APIs
VITE_SIMILARWEB_API_KEY=xxx
VITE_BUILTWITH_API_KEY=xxx
VITE_JSEARCH_API_KEY=xxx

# No key needed
# - Yahoo Finance (library)
# - SEC EDGAR (free public API)
```

---

## Next Steps

1. **Wire v3 into UI** - Replace old enrichment.ts with v3
2. **Add hiring signals UI** - Display in CompanyDrawer
3. **Batch Enrichment** - Enrich top 100 targets by ICP score
4. **Shopify Pipeline** - Add Shopify partner targets
5. **Salesforce Export** - Direct integration for lead import

---

## Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Project overview |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture |
| [docs/ENRICHMENT_PIPELINE.md](./docs/ENRICHMENT_PIPELINE.md) | Enrichment v3 documentation |
| [PRD.md](./PRD.md) | Product requirements |

---

*Last updated: 2026-02-26*
