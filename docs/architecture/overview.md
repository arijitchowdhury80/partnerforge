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
                             │ HTTPS (Direct)
┌────────────────────────────▼────────────────────────────────────┐
│                      SUPABASE                                    │
│            PostgreSQL + REST API + Auth                          │
│         https://xbitqeejsgqnwvxlnjra.supabase.co                 │
│                                                                  │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │displacement_targets│  │  companies     │  │ case_studies   │  │
│  │    (2,737)        │  │    (400)       │  │    (161)       │  │
│  └──────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  REST API: PostgREST auto-generated from schema          │   │
│  │  Filtering, sorting, pagination via query params         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                   EXTERNAL DATA SOURCES                          │
│                   (via MCP / manual enrichment)                  │
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

### 2. Database & API (Supabase)

**Location:** Cloud-hosted (no local backend needed)
**Deployment:** Supabase
**URL:** https://xbitqeejsgqnwvxlnjra.supabase.co

**Key Features:**
- PostgreSQL database with auto-generated REST API
- PostgREST provides filtering, sorting, pagination
- Row-level security (RLS) available
- Real-time subscriptions (optional)

**Architecture:**
- Frontend calls Supabase REST API directly
- No intermediate backend server required
- API key authentication via anon key

**Core Tables:**
- `displacement_targets` — Primary target data (2,737 records)
- `companies` — Existing Algolia customers (400 records)
- `case_studies` — Success stories for matching (161 records)

### 4. External Data Sources (5 total)

| Source | Purpose | API Endpoints |
|--------|---------|---------------|
| **Yahoo Finance** | Market data, financials, analyst sentiment | 10 endpoints via `yahoo-finance2` library |
| **SEC EDGAR** | Official filings, risk factors, digital signals | 3 endpoints (free public API) |
| **SimilarWeb** | Traffic, engagement, keywords, competitors | 14 endpoints |
| **BuiltWith** | Tech stack, search providers, relationships | 7 endpoints |
| **WebSearch** | Hiring signals, exec quotes, strategic context | 4 query categories |

See [ENRICHMENT_PIPELINE.md](../ENRICHMENT_PIPELINE.md) for full API documentation.

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
│                  WAVE 1 - Foundation              │
│  ┌─────────────┐  ┌─────────────┐                 │
│  │ Tech Stack  │  │ Relationships│                │
│  │ (BuiltWith) │  │ (BuiltWith)  │                │
│  └─────────────┘  └─────────────┘                 │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│                  WAVE 2 - Traffic                 │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Traffic   │  │  Sources    │  │Competitors│ │
│  │(SimilarWeb) │  │(SimilarWeb) │  │(Similar.) │ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│                  WAVE 3 - Financials              │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ Financials  │  │ Stock Info  │  │Risk Factors│ │
│  │(Yahoo Fin.) │  │(Yahoo Fin.) │  │(SEC EDGAR)│ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│                  WAVE 4 - Signals                 │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Hiring    │  │ Exec Quotes │  │  Scoring  │ │
│  │  (JobSpy)   │  │ (WebSearch) │  │(Composite)│ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│ Update displacement_targets with enriched data    │
│ Calculate composite score (Fit/Intent/Value/Disp) │
│ Update status: Hot (70+) | Warm (40-69) | Cold    │
└───────────────────────────────────────────────────┘
```

See [HIRING_SIGNALS.md](../HIRING_SIGNALS.md) for hiring signal scoring details.

### 3. Composite Scoring

PartnerForge uses a **4-factor composite scoring system** (25% weight each):

```
┌─────────────────────────────────────────────────┐
│              COMPOSITE SCORING ENGINE            │
│                                                  │
│  ┌──────────────┐  Weight: 25%                  │
│  │     FIT      │  Vertical, size, geography,  │
│  │              │  public vs private           │
│  └──────────────┘                               │
│                                                  │
│  ┌──────────────┐  Weight: 25%                  │
│  │    INTENT    │  Traffic, weak search        │
│  │              │  platform, tech complexity,  │
│  │              │  exec quotes                 │
│  └──────────────┘                               │
│                                                  │
│  ┌──────────────┐  Weight: 25%                  │
│  │    VALUE     │  Revenue, traffic volume,    │
│  │              │  store count, growth stage   │
│  └──────────────┘                               │
│                                                  │
│  ┌──────────────┐  Weight: 25%                  │
│  │ DISPLACEMENT │  Current search provider,    │
│  │              │  partner tech strength,      │
│  │              │  competitor Algolia adoption │
│  └──────────────┘                               │
│                                                  │
│  ═══════════════════════════════════            │
│  Total Score: 0-100                             │
│  Status: Hot (70+) | Warm (40-69) | Cold (<40) │
│  Confidence: High (≥70%) | Medium | Low (<40%) │
└─────────────────────────────────────────────────┘
```

Implementation: `frontend/src/services/scoring.ts`

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          GITHUB                                  │
│              github.com/arijitchowdhury80/partnerforge          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   main branch (frontend/)                                 │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │ Auto-deploy
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                         VERCEL                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ React + Vite Static Site                                 │   │
│  │ CDN Edge Delivery                                        │   │
│  │ Auto SSL                                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  partnerforge.vercel.app                                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Direct API calls
                                 │ (HTTPS + anon key)
                                 ▼
┌───────────────────────────────────────────────────────────────┐
│                        SUPABASE                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ PostgreSQL Database                                      │   │
│  │ PostgREST Auto-Generated API                             │   │
│  │ Row-Level Security                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  xbitqeejsgqnwvxlnjra.supabase.co                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security

### Authentication
- Supabase anon key for read-only access
- Service role key for admin operations (server-side only)
- Row-Level Security (RLS) available for fine-grained access control

### CORS
Supabase handles CORS automatically for configured domains:
- `https://partnerforge.vercel.app`
- `http://localhost:*` (dev)

### API Keys
Stored in frontend environment:
- `SUPABASE_URL` — Project URL
- `SUPABASE_ANON_KEY` — Public anonymous key

External API keys (for enrichment scripts):
- `BUILTWITH_API_KEY`
- `SIMILARWEB_API_KEY`

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

### Supabase Dashboard
- Database metrics and query performance
- API request logs
- Storage usage
- Real-time connection monitoring

### Logging
- Supabase provides built-in request logging
- Frontend errors logged to browser console
- External monitoring via Vercel Analytics (optional)

### Alerts
- Supabase dashboard alerts for database issues
- Vercel deployment notifications

---

## Future Architecture

### Planned Enhancements
1. **Supabase Edge Functions** — Server-side enrichment logic
2. **Real-time Subscriptions** — Live updates when data changes
3. **Batch Processing** — Large-scale data imports via Edge Functions
4. **Multi-tenancy** — Team-based access control via RLS policies

### Partner Technology Expansion
- Shopify Plus (in progress)
- Salesforce Commerce Cloud
- Contentful
- Sitecore
