# Arian

Partner Intelligence Platform for Algolia Sales. Finds companies using partner technologies (Adobe AEM, Shopify, Amplience, Spryker, etc.) who are NOT using Algolia — displacement opportunities for co-sell motions.

## Core Logic

```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

## Live Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://arian.vercel.app |
| **Database** | Supabase (PostgreSQL + REST API) |
| **Repository** | https://github.com/arijitchowdhury80/arian |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
│                 arian.vercel.app                          │
│              React 18 + TypeScript + Mantine                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Direct REST API Calls
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (Database + API)                     │
│              xbitqeejsgqnwvxlnjra.supabase.co                    │
│            PostgreSQL + PostgREST + Row Level Security           │
└─────────────────────────────────────────────────────────────────┘
```

## Data Sources (Enrichment v3)

| Source | Module | Key Data |
|--------|--------|----------|
| **SimilarWeb** | `similarweb.ts` | Traffic, bounce rate, similar sites |
| **BuiltWith** | `builtwith.ts` | Tech stack, search provider, CMS |
| **Yahoo Finance** | `yahoofinance.ts` | 3-yr financials, analyst ratings |
| **SEC EDGAR** | `secedgar.ts` | 10-K/10-Q filings, risk factors |
| **WebSearch** | `websearch.ts` | Executive quotes, strategic signals |
| **JSearch** | `jsearch.ts` | Job postings, hiring signals |

## Database

PostgreSQL hosted on Supabase. Data is accessed via auto-generated REST API.

| Table | Records | Purpose |
|-------|---------|---------|
| `displacement_targets` | ~2,800 | Partner tech users NOT on Algolia |

## Composite Scoring (0-100 points)

**Enrichment automatically calculates and saves multi-factor scores.**

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| **Fit** | 25% | Vertical, company size, geography, public vs private |
| **Intent** | 25% | Traffic, hiring signals, SEC risk factors, exec quotes |
| **Value** | 25% | Revenue, revenue growth, analyst ratings, profit margins |
| **Displacement** | 25% | Current search provider, partner tech, bounce rate |

### Score Thresholds

| Score | Status | Action |
|-------|--------|--------|
| **70-100** | Hot | Immediate outreach |
| **40-69** | Warm | Nurture pipeline |
| **0-39** | Cold | Deprioritize |

## Partner Coverage

| Partner | Targets |
|---------|---------|
| Adobe AEM | ~2,700 |
| Adobe Commerce | ~18 |
| Amplience | ~32 |
| Spryker | ~28 |

## Quick Start

```bash
# Frontend development
cd frontend && npm install && npm run dev

# View at http://localhost:5173
```

## Project Structure

```
Arian/
├── README.md                 # This file
├── PROJECT_TRACKER.md        # Project status and milestones
├── ARCHITECTURE.md           # Technical architecture
├── frontend/                 # React application
│   ├── src/
│   │   ├── lib/constants.ts  # COLORS, STATUSES, thresholds
│   │   ├── components/       # UI components
│   │   ├── services/
│   │   │   ├── api.ts        # Supabase API client
│   │   │   ├── scoring.ts    # Composite scoring algorithm
│   │   │   └── enrichment/v3/ # Modular enrichment (6 sources)
│   │   └── types/            # TypeScript definitions
│   └── package.json
├── docs/
│   └── ENRICHMENT_PIPELINE.md # Enrichment v3 documentation
└── supabase/                 # Database migrations
```

## Documentation

| Document | Purpose |
|----------|---------|
| [PROJECT_TRACKER.md](./PROJECT_TRACKER.md) | Current status, statistics, milestones |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture (v5.0) |
| [docs/ENRICHMENT_PIPELINE.md](./docs/ENRICHMENT_PIPELINE.md) | Enrichment v3 + scoring integration |
| [PRD.md](./PRD.md) | Product requirements |

## License

Internal Algolia use only.

---

*Last updated: 2026-02-26 (Enrichment v3 + Composite Scoring)*
