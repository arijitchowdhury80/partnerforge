# Arian - Project Memory

**Last Updated:** 2026-02-26
**Status:** Production

---

## Overview

Partner Intelligence Platform for Algolia Sales. Finds companies using partner technologies (Adobe AEM, Shopify, etc.) who are NOT using Algolia — displacement opportunities for co-sell motions.

## Core Logic

```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

---

## Live Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://arian.vercel.app |
| **Database** | Supabase (xbitqeejsgqnwvxlnjra.supabase.co) |
| **Repository** | https://github.com/arijitchowdhury80/arian |

---

## Architecture

```
Vercel (Frontend) → Supabase (PostgreSQL + REST API)
```

- **Frontend:** React 18 + TypeScript + Vite + Mantine
- **Database:** PostgreSQL hosted on Supabase
- **API:** Supabase auto-generated REST API (PostgREST)

---

## Current Data

| Table | Records |
|-------|---------|
| `displacement_targets` | 2,737 |

### Partner Breakdown

| Partner | Targets |
|---------|---------|
| Adobe Experience Manager | 2,687 |
| Adobe Commerce | 18 |
| Amplience | 20 |
| Spryker | 12 |

---

## ICP Scoring (0-100)

| Component | Weight |
|-----------|--------|
| Vertical/Tier | 40 |
| Traffic | 30 |
| Tech Spend | 20 |
| Partner Tech | 10 |

### Priority

| Score | Priority |
|-------|----------|
| 80+ | HOT |
| 60-79 | WARM |
| 40-59 | COOL |
| <40 | COLD |

---

## Data Sources

| Source | Purpose |
|--------|---------|
| BuiltWith | Technology detection |
| SimilarWeb | Traffic metrics |
| Yahoo Finance | Financial data (public companies) |

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/services/api.ts` | Supabase API client |
| `scripts/enrich_company_v2.py` | Company enrichment script |
| `scripts/icp_scoring.py` | ICP score calculation |

---

## API Keys

| Key | Environment Variable |
|-----|---------------------|
| BuiltWith | `BUILTWITH_API_KEY` |
| SimilarWeb | `SIMILARWEB_API_KEY` |

---

## Recent Changes (Feb 2026)

| Date | Change |
|------|--------|
| 2026-02-26 | Migrated to Supabase, simplified architecture |
| 2026-02-26 | Added Amplience & Spryker partners |
| 2026-02-26 | Documentation cleanup |
| 2026-02-25 | Enriched top 20 AEM targets |
| 2026-02-25 | Added data feedback system |

---

## Next Steps

1. Batch enrichment for top 100 targets
2. Add Shopify partner pipeline
3. Case study matching
4. Salesforce export integration

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

*This file provides quick context for development sessions. For detailed documentation, see the docs/ folder.*
