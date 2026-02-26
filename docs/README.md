# PartnerForge Documentation

**Version:** 5.0
**Last Updated:** 2026-02-26
**Status:** Production

---

## Overview

PartnerForge is a Partner Intelligence Platform for Algolia Sales. It identifies **displacement opportunities** — companies using partner technologies (Adobe AEM, Adobe Commerce, Amplience, Spryker) who are NOT using Algolia.

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

## Scoring & Enrichment

| Document | Purpose |
|----------|---------|
| [COMPOSITE_SCORING.md](./COMPOSITE_SCORING.md) | **4-factor scoring** - Fit/Intent/Value/Displacement with visual diagram |
| [ENRICHMENT_PIPELINE.md](./ENRICHMENT_PIPELINE.md) | **5 data sources** - Yahoo Finance, SEC EDGAR, SimilarWeb, BuiltWith, WebSearch |
| [HIRING_SIGNALS.md](./HIRING_SIGNALS.md) | **Hiring signal enrichment** - JobSpy integration, persona scoring |

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
| Total Displacement Targets | ~2,760 |
| Hot Leads (Composite 70+) | ~30 |
| Warm Leads (Composite 40-69) | ~150 |
| Partners Tracked | 4 |

### Partner Breakdown

| Partner | Targets |
|---------|---------|
| Adobe Experience Manager | ~2,700 |
| Adobe Commerce | ~18 |
| Amplience | ~32 |
| Spryker | ~28 |

## Scoring System

PartnerForge uses a **Composite Scoring System** with 4 factors (25% each):

| Factor | What It Measures |
|--------|-----------------|
| **Fit** | ICP match (vertical, size, geography) |
| **Intent** | Buying signals (traffic, weak search platform, exec quotes) |
| **Value** | Deal potential (revenue, traffic volume, store count) |
| **Displacement** | Ease of conversion (current provider, competitor Algolia adoption) |

### Score Thresholds

| Score | Status | Meaning |
|-------|--------|---------|
| 70-100 | **Hot** | High priority, ready for outreach |
| 40-69 | **Warm** | Nurture pipeline |
| 0-39 | **Cold** | Low priority |

### Confidence Levels

| Level | Data Completeness |
|-------|------------------|
| High | ≥70% of data fields populated |
| Medium | 40-69% |
| Low | <40% |

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
- Python services for hiring signals

### Data Sources (5 total)

| Source | Purpose | Auth |
|--------|---------|------|
| **Yahoo Finance** | Market data, financials, analyst sentiment | None (library) |
| **SEC EDGAR** | Official filings, risk factors, digital signals | None (free) |
| **SimilarWeb** | Traffic, engagement, keywords, competitors | API Key |
| **BuiltWith** | Tech stack, search providers | API Key |
| **WebSearch** | Hiring signals, exec quotes, strategic context | Backend |

See [ENRICHMENT_PIPELINE.md](./ENRICHMENT_PIPELINE.md) for full API documentation.

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
