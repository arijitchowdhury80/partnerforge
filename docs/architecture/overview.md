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
