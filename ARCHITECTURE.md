# PartnerForge Architecture

**Version:** 5.0 (Enrichment v3 + Composite Scoring)
**Date:** 2026-02-26
**Status:** Production

---

## Architecture Overview

PartnerForge uses a simplified 2-tier architecture where the React frontend communicates directly with Supabase's auto-generated REST API.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
│                 partnerforge.vercel.app                          │
├─────────────────────────────────────────────────────────────────┤
│  • React 18 + TypeScript + Vite                                  │
│  • Mantine UI Components                                         │
│  • TanStack Table (virtualized data grid)                        │
│  • Direct Supabase REST API calls                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ PostgREST API
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase                                      │
│              xbitqeejsgqnwvxlnjra.supabase.co                    │
├─────────────────────────────────────────────────────────────────┤
│  • PostgreSQL Database                                           │
│  • PostgREST (auto-generated REST API)                          │
│  • Row Level Security (RLS)                                      │
│  • Real-time subscriptions (future)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18 | UI framework |
| Language | TypeScript | Type safety |
| Build | Vite | Fast development |
| UI Library | Mantine v7 | Component library |
| Data Grid | TanStack Table | Virtualized 2,737+ rows |
| Styling | Tailwind CSS | Utility-first CSS |
| Hosting | Vercel | Static site hosting |

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL | Primary data store |
| API | PostgREST (Supabase) | Auto-generated REST API |
| Auth | Supabase Auth | Future: user authentication |
| Platform | Supabase | Managed PostgreSQL + API |

---

## Database Schema

### Core Table: displacement_targets

```sql
CREATE TABLE displacement_targets (
  id SERIAL PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  company_name TEXT,
  partner_tech TEXT,           -- 'Adobe Experience Manager', etc.
  vertical TEXT,
  country TEXT,
  city TEXT,
  state TEXT,

  -- Traffic metrics (SimilarWeb)
  sw_monthly_visits INTEGER,
  sw_bounce_rate REAL,
  sw_pages_per_visit REAL,
  sw_avg_duration INTEGER,
  sw_search_traffic_pct REAL,
  sw_rank_global INTEGER,

  -- ICP Scoring
  icp_tier INTEGER,            -- 1=Commerce, 2=Content, 3=Support
  icp_tier_name TEXT,
  icp_score INTEGER,           -- 0-100
  lead_score INTEGER,          -- Alias for icp_score
  score_breakdown JSONB,

  -- Financial data
  ticker TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  revenue REAL,
  gross_margin REAL,
  financials_json JSONB,

  -- Enrichment
  enrichment_level TEXT DEFAULT 'basic',
  last_enriched TIMESTAMP,
  current_search TEXT,
  tech_stack_json JSONB,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_targets_domain ON displacement_targets(domain);
CREATE INDEX idx_targets_score ON displacement_targets(icp_score DESC);
CREATE INDEX idx_targets_tier ON displacement_targets(icp_tier);
```

---

## API Access

The frontend uses Supabase's auto-generated REST API (PostgREST):

### Headers Required

```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
```

### Common Queries

| Operation | Endpoint |
|-----------|----------|
| List targets | `GET /rest/v1/displacement_targets?limit=100` |
| Filter by score | `GET /rest/v1/displacement_targets?icp_score=gte.80` |
| Search by domain | `GET /rest/v1/displacement_targets?domain=eq.example.com` |
| Sort by score | `GET /rest/v1/displacement_targets?order=icp_score.desc` |
| Pagination | `GET /rest/v1/displacement_targets?offset=100&limit=50` |

### API Client

The frontend API client is located at `frontend/src/services/api.ts`:

```typescript
const SUPABASE_URL = 'https://xbitqeejsgqnwvxlnjra.supabase.co';
const SUPABASE_ANON_KEY = '...';

export async function fetchTargets(params: FilterParams) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/displacement_targets`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  return response.json();
}
```

---

## Frontend Structure

```
frontend/
├── src/
│   ├── App.tsx                    # Root component
│   ├── main.tsx                   # Entry point
│   ├── lib/
│   │   └── constants.ts           # COLORS, STATUSES, getStatusFromScore()
│   ├── components/
│   │   ├── common/
│   │   │   └── TableFilters.tsx   # Excel-style column filters
│   │   ├── company/
│   │   │   ├── CompanyDrawer.tsx  # Slide-in detail view
│   │   │   └── ScoreBreakdown.tsx # Composite score visualization
│   │   ├── dashboard/
│   │   │   └── DistributionGrid.tsx # Heatmap by vertical
│   │   └── targets/
│   │       ├── TargetList.tsx     # Main data grid with hover preview
│   │       └── QuickLookCard.tsx  # Inline preview card
│   ├── services/
│   │   ├── api.ts                 # Supabase API client
│   │   ├── scoring.ts             # Composite scoring algorithm
│   │   ├── supabase.ts            # Direct Supabase client
│   │   └── enrichment/
│   │       └── v3/                # Modular enrichment (6 sources)
│   │           ├── index.ts       # enrich(), enrichAndSave()
│   │           ├── types.ts       # TypeScript definitions
│   │           └── sources/       # One file per data source
│   ├── types/
│   │   └── index.ts               # TypeScript definitions
│   └── styles/
│       └── global.css             # Global styles
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Data Flow

### 1. Initial Load

```
User opens app
    │
    ▼
Frontend fetches from Supabase
    │
    ▼
PostgREST returns JSON array
    │
    ▼
TanStack Table renders virtualized grid
```

### 2. Filtering

```
User applies filter (e.g., score >= 80)
    │
    ▼
Frontend builds PostgREST query string
    │
    ▼
Supabase returns filtered results
    │
    ▼
Table updates with filtered data
```

### 3. Detail View

```
User clicks company row
    │
    ▼
Drawer opens with company data
    │
    ▼
(Future: fetch additional enrichment data)
```

---

## Enrichment Pipeline v3

**Clean, modular TypeScript architecture: 1 source = 1 module**

```
frontend/src/services/enrichment/v3/
├── index.ts           # The umbrella - enrich(), enrichBatch(), enrichAndSave()
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

### Data Sources

| Source | Module | Auth | Key Data |
|--------|--------|------|----------|
| SimilarWeb | `similarweb.ts` | API Key | Traffic, bounce rate, similar sites |
| BuiltWith | `builtwith.ts` | API Key | Tech stack, search provider, CMS |
| Yahoo Finance | `yahoofinance.ts` | None | 3-yr financials, analyst ratings |
| SEC EDGAR | `secedgar.ts` | None | 10-K/10-Q filings, risk factors |
| WebSearch | `websearch.ts` | Backend | Executive quotes, strategic signals |
| JSearch | `jsearch.ts` | API Key | Job postings, hiring signals |

### Usage

```typescript
import { enrich, enrichBatch, enrichAndSave } from '@/services/enrichment/v3';

// Enrich ALL sources
const result = await enrich('costco.com');

// Enrich specific sources
await enrich('costco.com', { sources: ['similarweb', 'builtwith'] });

// Enrich and save to database (includes composite scoring)
await enrichAndSave('costco.com');
```

---

## Composite Scoring

**Enrichment automatically calculates and saves composite scores.**

### Scoring Flow

```
enrichAndSave(domain)
    │
    ▼
Fetch data from all sources in parallel
    │
    ▼
Build Company object from enrichment results
    │
    ▼
calculateCompositeScore(company)
    │
    ├── Fit Factor (25%)        ── Vertical, company size, geography
    ├── Intent Factor (25%)     ── Traffic, hiring signals, SEC risks
    ├── Value Factor (25%)      ── Revenue, growth, analyst ratings
    └── Displacement Factor (25%) ── Current search, partner tech, bounce
    │
    ▼
Save to icp_score column + derive status
```

### Score Thresholds

| Score | Status | Description |
|-------|--------|-------------|
| **70-100** | Hot | Ready for immediate outreach |
| **40-69** | Warm | Nurture pipeline |
| **0-39** | Cold | Low priority |

### Implementation

| File | Purpose |
|------|---------|
| `services/scoring.ts` | `calculateCompositeScore()`, `getDetailedBreakdown()` |
| `lib/constants.ts` | `getStatusFromScore()`, status thresholds |
| `services/enrichment/v3/index.ts` | Scoring integration in `saveToSupabase()` |

---

## Security

### Row Level Security (RLS)

Supabase RLS policies control data access:

```sql
-- Allow public read access (via anon key)
CREATE POLICY "Allow public read access"
ON displacement_targets
FOR SELECT
TO anon
USING (true);

-- Future: Restrict write access to authenticated users
CREATE POLICY "Allow authenticated writes"
ON displacement_targets
FOR INSERT
TO authenticated
WITH CHECK (true);
```

### API Keys

| Key | Purpose | Exposure |
|-----|---------|----------|
| `anon` key | Public read access | Frontend (safe) |
| `service_role` key | Full database access | Backend only (secret) |

---

## Deployment

### Frontend (Vercel)

```bash
# Auto-deploys on push to main branch
# Configuration in vercel.json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist"
}
```

### Database (Supabase)

- **Project:** `xbitqeejsgqnwvxlnjra`
- **Region:** Auto-selected
- **Plan:** Free tier (500MB database)

---

## Future Architecture (Planned)

For advanced features (real-time enrichment, background jobs), the architecture may evolve:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌───────────────────────┐     ┌───────────────────────────────────┐
│   Supabase (Data)     │     │   Edge Functions (Enrichment)     │
│   • PostgreSQL        │◄────│   • Supabase Edge Functions       │
│   • PostgREST         │     │   • Background jobs               │
│   • Real-time         │     │   • API rate limiting             │
└───────────────────────┘     └───────────────────────────────────┘
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [PROJECT_TRACKER.md](./PROJECT_TRACKER.md) | Project status and milestones |
| [docs/ENRICHMENT_PIPELINE.md](./docs/ENRICHMENT_PIPELINE.md) | Enrichment v3 full documentation |
| [PRD.md](./PRD.md) | Product requirements |
| [README.md](./README.md) | Project overview |

---

*Last updated: 2026-02-26 (v5.0 - Enrichment v3 + Composite Scoring)*
