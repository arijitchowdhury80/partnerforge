# Algolia-Arian

**ONE unified application** with two features:
1. **Partner Intelligence** (existing, production) - Find displacement opportunities
2. **Search Audit SaaS** (new, to be built) - Automated search audits for GTM teams

## Core Logic

```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

## Live Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://algolia-arian.vercel.app |
| **Database** | Supabase (PostgreSQL + REST API) |
| **Repository** | https://github.com/arijitchowdhury80/arian |
| **Backend** | Node.js + Express + TypeScript (🏗️ Week 1-2) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                             │
│             algolia-arian.vercel.app                       │
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

| Source | Endpoints | Key Data |
|--------|-----------|----------|
| **SimilarWeb** | 14 | Traffic, engagement, competitors, keywords |
| **BuiltWith** | 7 | Tech stack, relationships, financials, social |
| **Yahoo Finance** | 5 | 3-yr financials, stock info, analyst ratings |
| **SEC Edgar** | 3 | 10-K/10-Q filings, risk factors |
| **Apify** | 3 actors | LinkedIn company, jobs, social engagement |
| **Apollo.io** | 2 | Buying committee, intent signals |

**Total**: 31 API endpoints across 6 data sources

📖 **[Complete API Specs →](docs/features/search-audit/API_CLIENT_SPECIFICATIONS.md)**

## Database

PostgreSQL hosted on Supabase. **Composite key architecture** with audit versioning.

**Core Principle**: `companies (1) ←→ (many) audits` → all data tables use composite PK `(company_id, audit_id, domain_key)`

| Category | Tables | Purpose |
|----------|--------|---------|
| **Master Entities** | 3 | companies, partner_technologies, users |
| **Audits** | 1 | Audit execution records (bridge table) |
| **Enrichment Data** | 11 | Traffic, financials, tech stack, executives, social, hiring |
| **Strategic Analysis** | 1 | Company-level Algolia value prop synthesis |
| **Partner Intelligence** | 2 | Displacement opportunities, engagement log |
| **Search Audit** | 2 | Browser tests, screenshots |
| **Activity Logs** | 5 | Audit log, API call tracking, error tracking, cache |

**Total**: 25 tables + 13 views

📖 **[Complete Database Guide →](data/DATABASE_EXPLAINED.md)**
📖 **[Schema Reference →](data/README.md)** (25 tables, 13 views)
📖 **[Strategic Insights →](data/STRATEGIC_INSIGHTS_MARCH7.md)** (Migration 008)

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

### **Quick Start** (5 minutes)
- **[START_HERE.md](START_HERE.md)** - Build instructions (Day 1: Foundation, Day 2: Search Audit)
- **[docs/build/DAY1_AGENTS.md](docs/build/DAY1_AGENTS.md)** - Day 1 agent prompts (Agents 1-5)
- **[docs/build/BUILD_FROM_SCRATCH.md](docs/build/BUILD_FROM_SCRATCH.md)** - Day 2 agent prompts (Agents 6-7)
- **[docs-viewer.html](docs-viewer.html)** - HTML documentation viewer (11 sections)

### **Database & Architecture**
- **[DATABASE_EXPLAINED.md](DATABASE_EXPLAINED.md)** - Complete database guide (migrations, seeds, composite keys)
- **[data/README.md](data/README.md)** - Database schema reference (24 tables, 12 views)
- **[backend/README.md](backend/README.md)** - Backend implementation guide
- **[docs/features/search-audit/ARCHITECTURE_APPROVED.md](docs/features/search-audit/ARCHITECTURE_APPROVED.md)** - Architecture decisions (Direct APIs + 7-day cache)

### **Feature Documentation**
- **[docs/features/search-audit/](docs/features/search-audit/)** - 7 comprehensive docs (125 KB) for Search Audit feature
- **[docs/features/partner-intelligence/](docs/features/partner-intelligence/)** - Partner Intelligence docs (scattered, needs consolidation)

## License

Internal Algolia use only.

---

**Status**: ✅ Planning Complete - Ready for Week 1 Implementation
**Last Updated**: March 7, 2026 (Strategic Insights + Browser Automation + AI Copilot)
