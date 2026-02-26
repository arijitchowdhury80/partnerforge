# System Architecture

This document describes the high-level architecture of PartnerForge.

---

## Overview

PartnerForge is an ABM (Account-Based Marketing) platform that identifies displacement opportunities for Algolia sales teams. It combines data from multiple external sources to score and prioritize target accounts.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
│         Sales Reps │ BDRs │ Marketing │ Leadership              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      FRONTEND                                    │
│                  React + TypeScript                              │
│            https://partnerforge.vercel.app                       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Dashboard │  │ Targets  │  │Analytics │  │ Target Detail    │ │
│  │ Heatmap  │  │  List    │  │  Charts  │  │ Intelligence     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│                      BACKEND API                                 │
│                FastAPI + SQLAlchemy                              │
│     https://partnerforge-production.up.railway.app               │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Targets  │  │Enrichment│  │  Health  │  │  ICP Scoring     │ │
│  │  CRUD    │  │  Jobs    │  │  Probes  │  │  Engine          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────┬─────────────────────┬─────────────────────────┘
                  │                     │
┌─────────────────▼─────────────────────▼─────────────────────────┐
│                      DATABASE                                    │
│              PostgreSQL / SQLite                                 │
│                                                                  │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │displacement_targets│  │  companies     │  │ case_studies   │  │
│  │    (2,687)        │  │    (400)       │  │    (161)       │  │
│  └──────────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                   EXTERNAL DATA SOURCES                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │BuiltWith │  │SimilarWeb│  │  Yahoo   │  │    WebSearch     │ │
│  │Tech Stack│  │ Traffic  │  │ Finance  │  │  Intelligence    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Frontend (React)

**Location:** `frontend/`
**Deployment:** Vercel (auto-deploy from GitHub)
**URL:** https://partnerforge.vercel.app

**Key Features:**
- Interactive dashboard with ICP vs Vertical heatmap
- Filterable targets table
- Target detail pages with intelligence modules
- Real-time enrichment status

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Mantine UI (components)
- Tremor (charts)
- TanStack Query (data fetching)
- Framer Motion (animations)

### 2. Backend API (FastAPI)

**Location:** `backend/` (full) or `api/` (simple)
**Deployment:** Railway
**URL:** https://partnerforge-production.up.railway.app

**Key Features:**
- RESTful API with OpenAPI docs
- Async SQLAlchemy for database
- Enrichment job management
- Health checks for orchestration

**Tech Stack:**
- Python 3.11+
- FastAPI
- SQLAlchemy (async)
- Pydantic (validation)
- uvicorn (ASGI server)

### 3. Database (PostgreSQL/SQLite)

**Location:** `data/partnerforge.db` (dev) or PostgreSQL (prod)
**Tables:** 17 tables

**Core Tables:**
- `displacement_targets` — Primary target data (2,687 records)
- `companies` — Existing Algolia customers (400 records)
- `case_studies` — Success stories for matching (161 records)

### 4. External Data Sources

| Source | Purpose | API Endpoints Used |
|--------|---------|-------------------|
| **BuiltWith** | Technology detection | domain-lookup, relationships, keywords |
| **SimilarWeb** | Traffic analytics | traffic, engagement, keywords, competitors |
| **Yahoo Finance** | Financial data | stock-info, financials, recommendations |
| **WebSearch** | General intelligence | Hiring signals, exec quotes, triggers |

---

## Data Flow

### 1. Target Discovery

```
BuiltWith Lists API
        │
        ▼
┌───────────────────┐
│ Fetch companies   │
│ using Adobe AEM   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│ Filter against    │◄────│ companies table   │
│ Algolia customers │     │ (exclusion list)  │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐
│ displacement_     │
│ targets table     │
└───────────────────┘
```

### 2. Enrichment Flow

```
POST /enrich/{domain}
        │
        ▼
┌───────────────────┐
│ Create Job        │
│ (status: queued)  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────────────────────────────────────┐
│                  WAVE 1                            │
│  ┌─────────────┐  ┌─────────────┐                 │
│  │ m01_company │  │ m02_tech    │                 │
│  │ _context    │  │ _stack      │                 │
│  │ (BuiltWith) │  │ (BuiltWith) │                 │
│  └─────────────┘  └─────────────┘                 │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│                  WAVE 2                            │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ m03_traffic │  │ m04_sources │  │ m05_comps │ │
│  │(SimilarWeb) │  │(SimilarWeb) │  │(Similar.) │ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│                  WAVE 3                            │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │m07_financials│  │ m08_stock  │  │m09_analyst│ │
│  │(Yahoo Fin.) │  │(Yahoo Fin.) │  │(Yahoo F.) │ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│                  WAVE 4                            │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ m10_hiring  │  │ m11_quotes  │  │m14_scoring│ │
│  │ (WebSearch) │  │ (WebSearch) │  │ (Internal)│ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│ Update displacement_targets with enriched data    │
│ Calculate ICP score, update tier                  │
└───────────────────────────────────────────────────┘
```

### 3. ICP Scoring

```
┌─────────────────────────────────────────────────┐
│                 ICP SCORING ENGINE               │
│                                                  │
│  ┌──────────────┐  Weight: 40%                  │
│  │   Vertical   │  Commerce=40, Content=25      │
│  └──────────────┘                               │
│                                                  │
│  ┌──────────────┐  Weight: 30%                  │
│  │   Traffic    │  50M+=30, 10M+=25, 1M+=15    │
│  └──────────────┘                               │
│                                                  │
│  ┌──────────────┐  Weight: 20%                  │
│  │  Tech Spend  │  $100K+=20, $50K+=15         │
│  └──────────────┘                               │
│                                                  │
│  ┌──────────────┐  Weight: 10%                  │
│  │ Partner Tech │  Adobe=10, Shopify=7         │
│  └──────────────┘                               │
│                                                  │
│  ═══════════════════════════════════            │
│  Total Score: 0-100                             │
│  Tier: hot (80+) | warm (60-79) | cool | cold  │
└─────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          GITHUB                                  │
│              github.com/arijitchowdhury80/partnerforge          │
│                                                                  │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │   main branch    │              │   main branch    │         │
│  │   (frontend/)    │              │   (backend/)     │         │
│  └────────┬─────────┘              └────────┬─────────┘         │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            │ Auto-deploy                      │ Auto-deploy
            ▼                                  ▼
┌───────────────────────┐          ┌───────────────────────┐
│       VERCEL          │          │       RAILWAY         │
│                       │          │                       │
│  ┌─────────────────┐  │          │  ┌─────────────────┐  │
│  │ Static hosting  │  │          │  │ Container       │  │
│  │ CDN edge        │  │          │  │ PostgreSQL      │  │
│  │ Auto SSL        │  │          │  │ Health checks   │  │
│  └─────────────────┘  │          │  └─────────────────┘  │
│                       │          │                       │
│  partnerforge.        │          │  partnerforge-        │
│  vercel.app           │          │  production.up.       │
│                       │          │  railway.app          │
└───────────────────────┘          └───────────────────────┘
```

---

## Security

### Authentication
- Public endpoints: No auth required (read-only)
- Protected endpoints: Bearer token required

### CORS
Allowed origins:
- `https://partnerforge.vercel.app`
- `http://localhost:3000` (dev)

### API Keys
Stored as environment variables:
- `BUILTWITH_API_KEY`
- `SIMILARWEB_API_KEY`
- `DATABASE_URL`

### Data Privacy
- No PII stored beyond public business information
- Financial data from public filings only
- Contact emails from public sources

---

## Scalability

### Current Capacity
- 2,687 targets
- ~50 concurrent users
- ~10 enrichment jobs/minute

### Scaling Options
1. **Database**: Move to managed PostgreSQL with read replicas
2. **Caching**: Add Redis for API response caching
3. **Job Queue**: Add Celery/RQ for background enrichment
4. **CDN**: Already using Vercel edge for frontend

---

## Monitoring

### Health Endpoints
- `/health` — Basic health
- `/ready` — Readiness probe
- `/health/detailed` — Full diagnostics
- `/metrics` — Runtime metrics

### Logging
- Structured JSON logs
- Request ID tracking
- Error stack traces

### Alerts
- Uptime monitoring via external service
- Database connection alerts
- API rate limit warnings

---

## Future Architecture

### Planned Enhancements
1. **Redis Cache** — Response caching, job queue
2. **Webhook Events** — Notify on enrichment completion
3. **Batch Processing** — Large-scale data imports
4. **Multi-tenancy** — Team-based access control

### Partner Technology Expansion
- Shopify Plus (in progress)
- Salesforce Commerce Cloud
- Contentful
- Sitecore
