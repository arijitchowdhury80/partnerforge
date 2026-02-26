# PartnerForge - Project Tracker

**Version:** 4.0
**Status:** Production
**Last Updated:** 2026-02-26
**Repository:** https://github.com/arijitchowdhury80/partnerforge

---

## Executive Summary

PartnerForge is a Partner Intelligence Platform for Algolia Sales that identifies displacement opportunities by finding companies using partner technologies (Adobe AEM, Shopify, Amplience, Spryker) who are NOT using Algolia.

### Core Formula
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

---

## Live Deployment

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | https://partnerforge.vercel.app | ✅ Live |
| **Database** | Supabase (xbitqeejsgqnwvxlnjra) | ✅ Live |
| **Repository** | https://github.com/arijitchowdhury80/partnerforge | ✅ Active |

---

## Current Statistics

| Metric | Value |
|--------|-------|
| **Total Targets** | 2,737 |
| **Partners Tracked** | 4 (AEM, Commerce, Amplience, Spryker) |
| **Hot Leads (80+)** | 9 |
| **Warm Leads (60-79)** | 49 |

### Partner Breakdown

| Partner | Target Count |
|---------|--------------|
| Adobe Experience Manager | 2,687 |
| Adobe Commerce | 18 |
| Amplience | 20 |
| Spryker | 12 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite + Mantine |
| **Database** | Supabase PostgreSQL |
| **API** | Supabase REST API (PostgREST) |
| **Hosting** | Vercel (Frontend) |

---

## ICP Scoring Model

Companies are scored 0-100 based on:

| Component | Weight | Logic |
|-----------|--------|-------|
| Vertical/Tier | 40 | Commerce=40, Content=25, Support=15 |
| Traffic | 30 | 50M+=30, 10M+=25, 1M+=15 |
| Tech Spend | 20 | $100K+=20, $50K+=15 |
| Partner Tech | 10 | Adobe=10, Shopify=7 |

### Priority Classification

| Score | Priority | Action |
|-------|----------|--------|
| 80-100 | HOT | Immediate outreach |
| 60-79 | WARM | Queue for enrichment |
| 40-59 | COOL | Background refresh |
| 0-39 | COLD | Deprioritize |

---

## Data Sources

| Source | Purpose | Status |
|--------|---------|--------|
| **BuiltWith** | Technology detection | ✅ Active |
| **SimilarWeb** | Traffic metrics | ✅ Active |
| **Yahoo Finance** | Financial data | ✅ Active (public companies) |

---

## Project Structure

```
PartnerForge/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── services/api.ts   # Supabase API client
│   │   └── types/            # TypeScript definitions
│   └── package.json
├── scripts/                  # Python utility scripts
│   ├── enrich_company_v2.py  # Company enrichment
│   ├── icp_scoring.py        # ICP score calculation
│   └── migrate_to_supabase.py
├── docs/                     # Architecture documentation
├── data/                     # Local data backup
├── README.md                 # Project overview
├── ARCHITECTURE.md           # Technical architecture
├── PRD.md                    # Product requirements
└── DEPLOYMENT.md             # Deployment guide
```

---

## Recent Milestones

| Date | Milestone |
|------|-----------|
| 2026-02-26 | Migrated to Supabase, removed Railway backend |
| 2026-02-26 | Added Amplience & Spryker partner targets |
| 2026-02-25 | Enriched top 20 AEM targets by traffic |
| 2026-02-25 | Added data feedback system |
| 2026-02-24 | Excel-style column filters |
| 2026-02-24 | Hover preview + slide-over drawer |

---

## Next Steps

1. **Batch Enrichment** - Enrich top 100 targets by ICP score
2. **Shopify Pipeline** - Add Shopify partner targets (needs BuiltWith credits)
3. **Case Study Matching** - Match targets to relevant Algolia case studies
4. **Salesforce Export** - Direct integration for lead import

---

## Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Project overview |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture |
| [PRD.md](./PRD.md) | Product requirements |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment guide |
| [docs/README.md](./docs/README.md) | Full documentation index |

---

*Last updated: 2026-02-26*
