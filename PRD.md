# PartnerForge - Product Requirements Document

**Version:** 3.0 (Enterprise Architecture)
**Date:** 2026-02-25
**Status:** Enterprise-Grade ABM Platform Design Complete
**Vision:** Thousands-of-dollars-per-subscription Account-Based Marketing Software

---

## Executive Summary

**PartnerForge** is an **Enterprise-Grade Account-Based Marketing (ABM) Platform** for Algolia Sales that provides deep, multi-layered intelligence on target accounts. Unlike basic CRM enrichment tools, PartnerForge combines:

- **Partner Technology Detection** → Who uses our partners but not us?
- **Financial Intelligence** → Can they afford us? Are they growing?
- **Investor Intelligence** → What are their stated strategic priorities?
- **Competitive Intelligence** → What are their competitors doing?
- **Hiring Signals** → Are they building teams that need us?
- **Executive Intelligence** → Who's the buying committee?
- **Search Audit Intelligence** → How broken is their current search?

**Core Formula:**
```
Displacement Targets = Companies Using Partner Tech − Existing Algolia Customers
```

**Revenue Model:** $10K-50K/year enterprise subscriptions, per-seat licensing, premium modules

---

## Problem Statement

Sales teams spend significant time manually researching:
1. Which prospects use a partner technology (Adobe, Shopify, Salesforce, etc.)?
2. Which of those prospects DON'T yet use Algolia (displacement opportunities)?
3. Who are the competitors of a target account, and what search tech do they use?
4. Which Algolia case studies are most relevant to a given prospect?
5. What are executives saying in earnings calls that maps to Algolia solutions?
6. What hiring signals indicate readiness to buy?

| Pain Point | Current State | PartnerForge Solution |
|------------|---------------|----------------------|
| Manual research | 2-4 hours per account | 2 minutes per account |
| Inconsistent data | Different reps use different sources | Single source of truth |
| Not scalable | Can't research 500 accounts | Batch process thousands |
| Not persistent | Research lost after call | Permanent intelligence record |
| No prioritization | All leads look the same | ICP + Signal scoring |
| No timing signals | No idea when to reach out | Trigger event detection |

---

## MANDATORY DESIGN PRINCIPLE (P0)

### Source Citation Mandate

**Reference:** `docs/SOURCE-CITATION-MANDATE.md`

**THIS IS NON-NEGOTIABLE. NO EXCEPTIONS.**

| Law | Rule | Enforcement |
|-----|------|-------------|
| **Law 1** | Every data point has a source | Pydantic validators, DB NOT NULL |
| **Law 2** | No source >12 months old | `expires_at` column, adapter validation |
| **Law 3** | Inline citations in deliverables | Pre-generation validation gate |

**Source Freshness Rules:**
```
Stock price:    1 day max
Traffic data:   30 days max
Tech stack:     90 days max
Financials:     12 months max
Transcripts:    12 months max
```

**Database Enforcement:**
```sql
-- MANDATORY on every data table
source_type VARCHAR(50) NOT NULL,
source_url TEXT NOT NULL,
source_date DATE,
fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
expires_at TIMESTAMPTZ NOT NULL,
CONSTRAINT source_required CHECK (source_url IS NOT NULL AND source_url != '')
```

---

## Users

| Role | Primary Use Case | Value Delivered |
|------|------------------|-----------------|
| Account Executives | Pre-call research, objection handling | Know more than the prospect about their business |
| SDRs/BDRs | Prospecting, outreach timing | Reach out at the right moment with right message |
| Partner Managers | Co-sell list building | Identify partner overlap opportunities |
| Sales Leadership | Territory planning, forecasting | Data-driven pipeline prioritization |
| Marketing | ABM campaign targeting | Hyper-personalized content at scale |

**Estimated Users:** 50-100 (Algolia Sales & Commercial team)

---

## Intelligence Module Architecture

### 15 Intelligence Modules (4 Waves)

**Reference:** `docs/INTELLIGENCE-MODULE-TAXONOMY.md`

| Wave | Module ID | Module Name | DB Table | Source |
|------|-----------|-------------|----------|--------|
| **1** | M01 | Company Context | `intel_company_context` | WebSearch, SEC |
| **1** | M02 | Technology Stack | `intel_technology_stack` | BuiltWith |
| **1** | M03 | Traffic Analysis | `intel_traffic_analysis` | SimilarWeb |
| **1** | M04 | Financial Profile | `intel_financial_profile` | Yahoo Finance |
| **2** | M05 | Competitor Intel | `intel_competitor_intelligence` | SimilarWeb |
| **2** | M06 | Hiring Signals | `intel_hiring_signals` | LinkedIn/WebSearch |
| **2** | M07 | Strategic Context | `intel_strategic_context` | WebSearch/News |
| **3** | M08 | Investor Intel | `intel_investor_intelligence` | SEC EDGAR |
| **3** | M09 | Executive Intel | `intel_executive_intelligence` | LinkedIn/Transcripts |
| **3** | M10 | Buying Committee | `intel_buying_committee` | Enrichment |
| **3** | M11 | Displacement Analysis | `intel_displacement_analysis` | Analysis |
| **4** | M12 | Case Study Matching | `intel_case_study_matches` | Internal |
| **4** | M13 | ICP-Priority Mapping | `intel_icp_priority_mapping` | Synthesis |
| **4** | M14 | Signal Scoring | `intel_signal_scoring` | Calculation |
| **4** | M15 | Strategic Signal Brief | `intel_strategic_signal_briefs` | Generation |

### Module Dependency Graph

```
Wave 1 (Foundation - Parallel):
M01 ──┐
M02 ──┼──► Validation ──► Wave 2
M03 ──┤
M04 ──┘

Wave 2 (Deep Intel - Parallel):
M05 ──┐
M06 ──┼──► Validation ──► Wave 3
M07 ──┘

Wave 3 (Analysis - Mixed):
M08 ──┐
M09 ──┼──► M10 ──► M11 ──► Wave 4
(from M06)

Wave 4 (Synthesis - Parallel):
M12 ──┐
M13 ──┼──► M15 (Final Brief)
M14 ──┘
```

---

## Parallel Execution Architecture

**Reference:** `docs/PARALLEL-EXECUTION-ARCHITECTURE.md`

### Three Levels of Parallelism

| Level | Description | Implementation |
|-------|-------------|----------------|
| **Within-Account** | Wave-based module execution | `asyncio.gather()` per wave |
| **Across-Account** | Batch processing (5-10 concurrent) | Semaphore-bounded workers |
| **Within-Adapter** | Concurrent API calls | Rate-limited parallel requests |

### Performance Gain

| Approach | Time per Account | Time for 100 Accounts |
|----------|------------------|----------------------|
| Sequential | 180-300 seconds | 5-8 hours |
| Parallel (Wave) | 60 seconds | 1-2 hours |
| **Speedup** | **3-5x** | **3-5x** |

### Orchestrator Design

```
Human Role                    System Role
──────────                    ───────────
Configure ICP weights    ←→   Execute module sequencing
Trigger batch jobs       ←→   Manage parallelism
Review results           ←→   Handle failures/retries
Make sales decisions     ←→   Notify on hot leads
```

**Key Principle:** Humans should NEVER manually sequence module execution. That's the orchestrator's job.

---

## Database Schema (PostgreSQL)

**Reference:** `docs/DATABASE-SCHEMA-V2.md`

### Table Namespaces

| Namespace | Purpose | Tables |
|-----------|---------|--------|
| `core_` | Primary entities | companies, domains, jobs, cache, brands |
| `intel_` | Intelligence data | 15 tables (one per module) |
| `jobs_` | Job management | queue, history, scheduled_tasks |
| `users_` | User management | accounts, api_keys, rate_limits |
| `audit_` | Audit logging | api_calls, data_changes, user_actions |

### Critical Tables (30+ Total)

```sql
-- Core company record
CREATE TABLE core_companies (
    id UUID PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(500) NOT NULL,
    ticker VARCHAR(20),
    icp_tier INTEGER CHECK (icp_tier IN (1, 2, 3)),
    icp_score INTEGER CHECK (icp_score >= 0 AND icp_score <= 100),
    is_algolia_customer BOOLEAN DEFAULT FALSE,
    current_search_provider VARCHAR(100),
    enrichment_level VARCHAR(20) DEFAULT 'none',
    last_enriched_at TIMESTAMPTZ,
    -- SOURCE TRACKING (MANDATORY)
    source_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Executive quotes with attribution
CREATE TABLE intel_executive_quotes (
    id UUID PRIMARY KEY,
    account_id UUID REFERENCES core_companies(id),
    quote_text TEXT NOT NULL,
    speaker_name VARCHAR(255) NOT NULL,
    speaker_title VARCHAR(255),
    event_date DATE NOT NULL,
    event_type VARCHAR(50),
    maps_to_algolia TEXT,
    relevance_score INTEGER,
    -- SOURCE TRACKING (MANDATORY)
    source_url TEXT NOT NULL,
    source_date DATE NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
```

---

## Data Pipeline Design

**Reference:** `docs/DATA-PIPELINE-FLOWS.md`

### Adapter Layer

| Adapter | Endpoints | Rate Limit | Purpose |
|---------|-----------|------------|---------|
| `BuiltWithAdapter` | 6 | 30 RPM | Tech stack detection |
| `SimilarWebAdapter` | 11 | 60 RPM | Traffic intelligence |
| `YahooFinanceAdapter` | 5 | 100 RPM | Financial data |
| `SECEdgarAdapter` | 3 | 6 RPM | 10-K/10-Q filings |
| `WebSearchAdapter` | N/A | 300 RPM | Fallback/narratives |

### BaseAdapter Pattern

```python
class BaseAdapter(ABC):
    """All adapters include retry, circuit breaker, rate limiting."""

    retry_config = RetryConfig(
        max_retries=3,
        base_delay_ms=1000,
        exponential_base=2,
        jitter_factor=0.1
    )

    circuit_breaker = CircuitBreaker(
        failure_threshold=5,
        recovery_time_ms=60000
    )

    @abstractmethod
    async def fetch(self, params: dict) -> dict: ...

    def attach_source(self, data: dict, source_url: str) -> dict:
        """MANDATORY: Every response gets source attribution."""
        return {**data, "_source": {...}}
```

---

## API Layer

### REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/company/{domain}` | GET | Get company with enrichment status |
| `POST /api/enrich/{domain}` | POST | Trigger enrichment (sync or async) |
| `POST /api/batch-enrich` | POST | Batch enrich (background job) |
| `GET /api/jobs/{job_id}` | GET | Job status polling |
| `GET /api/targets` | GET | List paginated targets |
| `GET /api/stats` | GET | Summary statistics |
| `POST /api/schedule/top-leads` | POST | Schedule recurring enrichment |

### Interface Contract

```python
from pipeline import EnrichmentOrchestrator

orchestrator = EnrichmentOrchestrator(config)

result = await orchestrator.enrich(
    domain="costco.com",
    modules=["M01", "M02", "M03", "M04", "M05"],
    force_refresh=False
)

assert result.status in ["completed", "partial", "failed"]
assert result.errors == {} or result.errors == {"M05": "timeout"}
assert result.duration_ms < 30000
```

---

## Deliverables

### Per-Account Outputs (4 files)

| File | Purpose | Audience |
|------|---------|----------|
| `{company}-strategic-signal-brief.md` | LLM-consumable signal density | Downstream AI |
| `{company}-ae-precall-brief.md` | Sales-ready prep doc | Account Executives |
| `{company}-search-audit-report.md` | Technical audit findings | Solutions Engineers |
| `{company}-search-audit-book.pdf` | Premium print-ready | Executive presentations |

### Strategic Signal Brief Structure

```markdown
## 60-Second Story
[Narrative summary with inline citations]

## Timing Signals
- Signal 1 | SOURCE: [url]
- Signal 2 | SOURCE: [url]

## In Their Own Words
- "Quote text" — Speaker Name, Title | SOURCE: [url]

## People
- Name | Title | Buyer Role | Priority

## Money
- Revenue: $X.XXB | SOURCE: [url]
- Addressable: $XXM | SOURCE: calculation

## Gaps (from audit)
- Gap 1: Score X/10 | Severity: HIGH

## The Angle
[1-paragraph pitch]
```

---

## ICP Scoring

### Scoring Formula

```python
icp_score = (
    vertical_score * 0.40 +    # Commerce=40, Content=25, Support=15
    traffic_score * 0.30 +     # 50M+=30, 10M+=25, 1M+=15
    tech_spend_score * 0.20 +  # $100K+=20, $50K+=15
    partner_tech_score * 0.10  # Adobe=10, Shopify=7
)
```

### ICP Tiers

| Tier | Name | Points | Description |
|------|------|--------|-------------|
| T1 | Commerce | 40 | E-commerce, retail, marketplace |
| T2 | Content | 25 | Media, publishing, SaaS |
| T3 | Support | 15 | Internal search, help desk |

### Priority Classification

| Score Range | Priority | Action |
|-------------|----------|--------|
| 80-100 | HOT | Immediate outreach |
| 60-79 | WARM | Queue for enrichment |
| 40-59 | COOL | Background refresh |
| 0-39 | COLD | Deprioritize |

---

## Current Data (as of 2026-02-25)

| Table | Records |
|-------|---------|
| `displacement_targets` | 2,687 |
| `companies` | 400 |
| `competitive_intel` | 25 |
| `case_studies` | 161 |

### Hot Leads (Score ≥80)

| Company | Score | Partner Tech |
|---------|-------|--------------|
| Mercedes-Benz | 95 | Adobe AEM |
| Mark's | 85 | Adobe AEM |
| Infiniti | 85 | Adobe AEM |
| Allianz | 85 | Adobe AEM |
| Chevrolet Mexico | 85 | Adobe AEM |

---

## Architecture Documents

All architecture documents are persisted to `docs/`:

| Document | Lines | Purpose |
|----------|-------|---------|
| `ARCHITECTURE_INDEX.md` | ~700 | **Navigation hub for all 13 docs** |
| `ENTERPRISE-ARCHITECTURE.md` | ~1,340 | Master architecture, module boundaries |
| `INTELLIGENCE_MODULES_SPEC.md` | ~1,100 | 15 modules with full JSON schemas |
| `DATABASE_SCHEMA_V2.md` | ~850 | 30+ PostgreSQL tables with source tracking |
| `PARALLEL_EXECUTION_ARCHITECTURE.md` | ~900 | Wave execution, Celery workers, circuit breakers |
| `ORCHESTRATOR_DESIGN.md` | ~750 | Hybrid orchestrator (Human + System) |
| `DATA-PIPELINE-FLOWS.md` | ~800 | Module I/O specs, adapter designs |
| `SOURCE_CITATION_MANDATE.md` | ~550 | P0 source citation requirements |
| `DESIGN_PRINCIPLES.md` | ~200 | Core design tenets |
| `UI-UX-LIBRARY-RESEARCH.md` | ~400 | Mantine + Tremor + Magic UI evaluation |
| `PREMIUM-UI-SPECIFICATION.md` | ~1,200 | **Championship-level UI spec (NEW)** |
| `INTELLIGENCE-MODULE-TAXONOMY.md` | ~450 | Module categorization |
| `INTELLIGENCE_DATA_MODEL.md` | ~600 | Data model patterns |
| `ARCHITECTURE_STRESS_TEST.md` | ~1,500 | **Blind spots, corner cases, extensibility gaps (NEW)** |

**Total:** 14 architecture documents, 10,500+ lines of specification

---

## Technical Stack

### Backend Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL (Supabase) | Primary persistence with 30+ tables |
| **Cache** | Redis (Upstash) | Distributed cache, rate limiting |
| **API** | FastAPI (Python 3.11) | Async REST API with 15 module endpoints |
| **ORM** | SQLAlchemy 2.0 (async) | Async database operations |
| **Task Queue** | Celery + Redis | Wave-based parallel execution |
| **Hosting** | Railway | Backend deployment |

### Frontend Stack (Championship-Level)

**Reference:** `docs/PREMIUM-UI-SPECIFICATION.md`

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | React 18 + TypeScript + Vite | Core application |
| **Component System** | Aceternity UI (200+ components) | Premium animated components |
| **Data Viz** | Nivo + ECharts | Beautiful charts and metrics |
| **Data Grid** | TanStack Table + Custom | Virtualized 2,687+ rows |
| **Animations** | Motion (Framer) + GSAP | 60fps micro-interactions |
| **3D Elements** | Spline | Hero section wow factor |
| **Icons** | Hugeicons (46,000+) | Consistent iconography |
| **Styling** | Tailwind CSS + Glassmorphism | Premium dark theme |
| **Data Fetching** | TanStack Query | Intelligent caching |
| **Hosting** | Vercel | Frontend deployment |

### Design System

| Element | Specification |
|---------|---------------|
| **Primary Design Trend** | Glassmorphism (blur + transparency) |
| **Color Mode** | Dark mode default |
| **Primary Colors** | Algolia Blue (#003DFF), Algolia Purple (#5468FF) |
| **Status Colors** | Hot (red gradient), Warm (orange), Cool (blue), Cold (gray) |
| **Typography** | Inter (primary), JetBrains Mono (data) |
| **Animation Approach** | Spring-based, 60fps, reduced-motion aware |

---

## Development Phases

### Phase 1: MVP (COMPLETED)
- [x] Database schema
- [x] BuiltWith sync
- [x] SimilarWeb enrichment
- [x] Basic dashboard

### Phase 2: Intelligence v2.0 (COMPLETED)
- [x] Full intelligence detail view
- [x] Excel-style filtering
- [x] Enrichment pipeline
- [x] Case study matching

### Phase 2.1: FastAPI Backend (COMPLETED)
- [x] On-demand enrichment API
- [x] Cache TTL (7 days)
- [x] `/partnerforge` skill

### Phase 3: Enterprise Architecture (IN PROGRESS)
- [x] 15-module taxonomy design
- [x] PostgreSQL schema v2 design
- [x] Parallel execution architecture
- [x] Source citation mandate
- [x] **Premium UI research (50+ libraries evaluated)**
- [x] **Backend scaffold (FastAPI + 15 module endpoints)**
- [x] **Frontend scaffold (React + Aceternity + Nivo)**
- [x] **Championship-level UI specification**
- [ ] Pipeline implementation
- [ ] Adapter implementation
- [ ] Orchestrator implementation

### Implementation Scaffold (COMPLETED)

**Backend (`backend/`):**
| File | Status | Purpose |
|------|--------|---------|
| `app/main.py` | ✅ Created | FastAPI app with all 15 module endpoints |
| `app/config.py` | ✅ Created | Wave configuration, rate limits, scoring |
| `app/database.py` | ✅ Created | PostgreSQL async connection |
| `app/modules/base.py` | ✅ Created | BaseIntelligenceModule with source validation |
| `app/services/validation.py` | ✅ Created | Source citation mandate enforcement |
| `requirements.txt` | ✅ Created | FastAPI, SQLAlchemy, Celery dependencies |

**Frontend (`frontend/`):**
| File | Status | Purpose |
|------|--------|---------|
| `package.json` | ✅ Created | Aceternity, Nivo, TanStack, Motion |
| `vite.config.ts` | ✅ Created | Vite configuration with aliases |
| `tailwind.config.js` | ✅ Created | Algolia colors, status gradients |
| `src/types/index.ts` | ✅ Created | TypeScript definitions for 15 modules |
| `src/services/api.ts` | ✅ Created | API client for all endpoints |
| `src/components/dashboard/Dashboard.tsx` | ✅ Created | Premium dashboard with KPIs |
| `src/components/dashboard/TargetTable.tsx` | ✅ Created | Virtualized target table |
| `src/components/company/CompanyView.tsx` | ✅ Created | Company detail with tabs |
| `src/components/common/SourceBadge.tsx` | ✅ Created | Source citation UI component |

### Phase 4: Premium Modules (PLANNED)
- [ ] Search Audit integration
- [ ] Crossbeam integration
- [ ] Demandbase integration
- [ ] ZoomInfo integration

---

## API Rate Limits

| Provider | RPM | Concurrent | Strategy |
|----------|-----|------------|----------|
| BuiltWith | 30 | 5 | Token bucket |
| SimilarWeb | 60 | 10 | Token bucket |
| Yahoo Finance | 100 | 10 | Token bucket |
| SEC EDGAR | 6 | 2 | Fixed window |
| WebSearch | 300 | 20 | Token bucket |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to enrich single account | < 60 seconds |
| Time to enrich batch (100) | < 2 hours |
| Hot lead identification accuracy | > 85% |
| Source citation coverage | 100% |
| Data freshness | < 12 months |
| User adoption | 80% of sales team |

---

## Open Questions

1. Should premium modules (Search Audit, Crossbeam) be separate subscriptions?
2. How do we handle GDPR compliance for EU executive data?
3. Should we offer API access tiers for partners?
4. Integration priority: Salesforce or HubSpot first?
5. What's the escalation path when source citation fails?

---

*Document Version: 3.0*
*Created: 2026-02-25*
*Last Updated: 2026-02-25*
*Authors: Claude + Arijit*
*Status: Enterprise Architecture Design Complete, Implementation In Progress*
