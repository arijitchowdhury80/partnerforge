# PartnerForge Documentation

**Version:** 4.0
**Last Updated:** 2026-02-26
**Status:** Production

---

## Overview

PartnerForge is a Partner Intelligence Platform for Algolia Sales. It identifies **displacement opportunities** — companies using partner technologies (Adobe AEM, Shopify, Amplience, Spryker) who are NOT using Algolia.

### Core Formula
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

### Live Deployment

| Service | URL |
|---------|-----|
| Frontend | https://partnerforge.vercel.app |
| Database | Supabase (xbitqeejsgqnwvxlnjra.supabase.co) |
| Repository | https://github.com/arijitchowdhury80/partnerforge |

---

## Quick Navigation

### Getting Started
| Document | Description |
|----------|-------------|
| [Quickstart Guide](guides/quickstart.md) | Get started in 5 minutes |

### API Reference
| Document | Description |
|----------|-------------|
| [API Overview](api/README.md) | Base URLs, authentication |
| [Targets Endpoints](api/endpoints/targets.md) | Target CRUD and filtering |
| [Enrichment Endpoints](api/endpoints/enrichment.md) | Data enrichment jobs |
| [Health Endpoints](api/endpoints/health.md) | Health checks |
| [Data Schemas](api/schemas.md) | Request/response models |
| [Error Handling](api/errors.md) | Status codes and errors |

### Architecture
| Document | Description |
|----------|-------------|
| [System Overview](architecture/overview.md) | High-level architecture |
| [Database Schema](architecture/database.md) | Tables and relationships |
| [Architecture Diagrams](architecture/diagrams.md) | Visual diagrams |

### Product Requirements
| Document | Description |
|----------|-------------|
| [PRD v3 (Vision)](prd/PRD-PartnerForge-v3.md) | Full v3.0 product vision |

---

## Architecture Documents (Advanced)

These documents provide deep technical specifications for enterprise features:

| Document | Purpose |
|----------|---------|
| [ENTERPRISE-ARCHITECTURE.md](./ENTERPRISE-ARCHITECTURE.md) | Enterprise system design |
| [INTELLIGENCE_MODULES_SPEC.md](./INTELLIGENCE_MODULES_SPEC.md) | 15 intelligence modules |
| [DATABASE_SCHEMA_V2.md](./DATABASE_SCHEMA_V2.md) | PostgreSQL schema (51+ tables) |
| [PARALLEL_EXECUTION_ARCHITECTURE.md](./PARALLEL_EXECUTION_ARCHITECTURE.md) | Wave-based execution |
| [SOURCE_CITATION_MANDATE.md](./SOURCE_CITATION_MANDATE.md) | Data citation requirements |
| [TESTING_ARCHITECTURE.md](./TESTING_ARCHITECTURE.md) | Testing methodology |
| [CHANGE_DETECTION_ARCHITECTURE.md](./CHANGE_DETECTION_ARCHITECTURE.md) | Temporal versioning |
| [CSV_UPLOAD_ARCHITECTURE.md](./CSV_UPLOAD_ARCHITECTURE.md) | CSV import flow |
| [PREMIUM-UI-SPECIFICATION.md](./PREMIUM-UI-SPECIFICATION.md) | UI/UX specification |
| [ARCHITECTURE_INDEX.md](./ARCHITECTURE_INDEX.md) | Full document index |

---

## Current Statistics

| Metric | Count |
|--------|-------|
| Total Displacement Targets | 2,737 |
| Hot Leads (ICP 80+) | 9 |
| Warm Leads (ICP 60-79) | 49 |
| Partners Tracked | 4 |

### Partner Breakdown

| Partner | Targets |
|---------|---------|
| Adobe Experience Manager | 2,687 |
| Adobe Commerce | 18 |
| Amplience | 20 |
| Spryker | 12 |

---

## Tech Stack

### Frontend
- React 18 + TypeScript + Vite
- Mantine UI Components
- TanStack Table (virtualized grid)
- Deployed on Vercel

### Backend
- Supabase PostgreSQL
- PostgREST (auto-generated REST API)
- No intermediate backend server

### Data Sources
- **BuiltWith** — Technology detection
- **SimilarWeb** — Traffic analytics
- **Yahoo Finance** — Financial data (public companies)

---

## Project Structure

```
PartnerForge/
├── frontend/                 # React application
├── scripts/                  # Python utility scripts
├── docs/                     # This documentation
│   ├── api/                  # API reference
│   ├── guides/               # User guides
│   ├── architecture/         # Architecture docs
│   └── prd/                  # Product requirements
├── README.md                 # Project overview
├── ARCHITECTURE.md           # Technical architecture
├── PRD.md                    # Product requirements (summary)
└── DEPLOYMENT.md             # Deployment guide
```

---

## Getting Help

- **Issues:** https://github.com/arijitchowdhury80/partnerforge/issues
- **Owner:** arijit.chowdhury@algolia.com

---

*Last updated: 2026-02-26*
