# PartnerForge

Partner Intelligence Platform for Algolia Sales. Finds companies using partner technologies (Adobe AEM, Shopify, Amplience, Spryker, etc.) who are NOT using Algolia — displacement opportunities for co-sell motions.

## Core Logic

```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

## Live Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://partnerforge.vercel.app |
| **Database** | Supabase (PostgreSQL + REST API) |
| **Repository** | https://github.com/arijitchowdhury80/partnerforge |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
│                 partnerforge.vercel.app                          │
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

## Data Sources

| Source | Purpose |
|--------|---------|
| **BuiltWith** | Technology detection (AEM, Shopify, etc.) |
| **SimilarWeb** | Traffic metrics + competitor discovery |
| **Customer Evidence** | Existing Algolia customers (to exclude) |

## Database

PostgreSQL hosted on Supabase. Data is accessed via auto-generated REST API.

| Table | Records | Purpose |
|-------|---------|---------|
| `displacement_targets` | 2,737 | Partner tech users NOT on Algolia |

## ICP Scoring (0-100 points)

| Component | Weight | Logic |
|-----------|--------|-------|
| Vertical/Tier | 40 | Commerce=40, Content=25, Support=15 |
| Traffic | 30 | 50M+=30, 10M+=25, 1M+=15 |
| Tech Spend | 20 | $100K+=20, $50K+=15 |
| Partner Tech | 10 | Adobe=10, Shopify=7 |

## Partner Coverage

| Partner | Targets |
|---------|---------|
| Adobe AEM | 2,687 |
| Adobe Commerce | 18 |
| Amplience | 20 |
| Spryker | 12 |

## Quick Start

```bash
# Frontend development
cd frontend && npm install && npm run dev

# View at http://localhost:5173
```

## Project Structure

```
PartnerForge/
├── README.md                 # This file
├── PRD.md                    # Product requirements
├── DEPLOYMENT.md             # Deployment guide
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── services/         # API client (Supabase)
│   │   └── types/            # TypeScript definitions
│   └── package.json
├── docs/                     # Architecture documentation
│   ├── README.md             # Documentation index
│   ├── prd/                  # PRD versions
│   └── api/                  # API documentation
├── scripts/                  # Utility scripts
└── data/                     # Local data (legacy SQLite backup)
```

## Documentation

See [docs/README.md](docs/README.md) for full architecture documentation including:
- Intelligence module specifications
- Database schema
- API endpoints
- UI/UX specifications

## License

Internal Algolia use only.

---

*Last updated: 2026-02-26*
