# PartnerForge Enterprise Architecture

**Version:** 1.0
**Date:** 2026-02-25
**Status:** Design Document for Enterprise-Grade ABM Platform
**Vision:** Thousands-of-dollars-per-subscription Account-Based Marketing Software

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [Intelligence Module Taxonomy](#3-intelligence-module-taxonomy)
4. [Microservices Architecture](#4-microservices-architecture)
5. [Data Pipeline Design](#5-data-pipeline-design)
6. [Database Schema](#6-database-schema)
7. [API Design](#7-api-design)
8. [Frontend/UX Architecture](#8-frontendux-architecture)
9. [Infrastructure Design](#9-infrastructure-design)
10. [Extensibility Patterns](#10-extensibility-patterns)
11. [Future Module Integration](#11-future-module-integration)
12. [Thread-Specific Implementation](#12-thread-specific-implementation)

---

# 1. Executive Summary

## Vision

PartnerForge is an **Enterprise-Grade Account-Based Marketing (ABM) Platform** that provides deep, multi-layered intelligence on target accounts. Unlike basic CRM enrichment tools, PartnerForge combines:

- **Partner Technology Detection** → Who uses our partners but not us?
- **Financial Intelligence** → Can they afford us? Are they growing?
- **Investor Intelligence** → What are their stated strategic priorities?
- **Competitive Intelligence** → What are their competitors doing?
- **Hiring Signals** → Are they building teams that need us?
- **Executive Intelligence** → Who's the buying committee?
- **Search Audit Intelligence** → How broken is their current search?

## Core Principle

```
ACCOUNT INTELLIGENCE = Σ(Module₁ + Module₂ + ... + Moduleₙ) × Cross-Module Insights
```

Each module operates independently BUT generates exponentially more value when combined. A company hiring search engineers (Hiring Module) + recently removed Elasticsearch (Tech Module) + CEO quoted "digital transformation priority" (Investor Module) = **HOT LEAD**.

## Modularity Mandate

Every component MUST be:
1. **Independently deployable** — Each module as its own microservice
2. **Horizontally scalable** — Add instances without code changes
3. **Pluggable** — New modules slot in without modifying existing ones
4. **Versioned** — Breaking changes require new API versions
5. **Observable** — Full telemetry on every module

---

# 2. Business Context

## The Problem We're Solving

| Pain Point | Current State | PartnerForge Solution |
|------------|---------------|----------------------|
| Manual research | 2-4 hours per account | 2 minutes per account |
| Inconsistent data | Different reps use different sources | Single source of truth |
| Not scalable | Can't research 500 accounts | Batch process thousands |
| Not persistent | Research lost after call | Permanent intelligence record |
| No prioritization | All leads look the same | ICP + Signal scoring |
| No timing signals | No idea when to reach out | Trigger event detection |

## Target Users

| Role | Primary Use Case | Value Delivered |
|------|------------------|-----------------|
| Account Executives | Pre-call research, objection handling | Know more than the prospect about their business |
| SDRs/BDRs | Prospecting, outreach timing | Reach out at the right moment with right message |
| Partner Managers | Co-sell list building | Identify partner overlap opportunities |
| Sales Leadership | Territory planning, forecasting | Data-driven pipeline prioritization |
| Marketing | ABM campaign targeting | Hyper-personalized content at scale |

## Revenue Model Positioning

This is **NOT** a free tool or internal-only utility. Design for:
- $10K-50K/year enterprise subscriptions
- Per-seat licensing
- Premium modules (Search Audit, Crossbeam, Demandbase integration)
- API access tiers

---

# 3. Intelligence Module Taxonomy

## Module Inventory (Current + Future)

Based on deep analysis of the algolia-search-audit skill and ABM best practices:

### Core Modules (MVP)

| Module ID | Module Name | Data Sources | Output |
|-----------|-------------|--------------|--------|
| `M01` | Company Context | WebSearch, BuiltWith keywords-api | Company profile, vertical, size |
| `M02` | Technology Stack | BuiltWith (6 endpoints), SimilarWeb Tech | Current tech, removed tech, added tech |
| `M03` | Traffic Intelligence | SimilarWeb (11 endpoints) | Visits, engagement, sources, demographics |
| `M04` | Competitor Intelligence | SimilarWeb similar-sites, BuiltWith per competitor | Competitor list, tech stacks, Algolia usage |
| `M05` | Financial Intelligence | Yahoo Finance, SEC EDGAR, ecdb.com | 3-year trends, margin zone, ROI estimate |
| `M06` | Hiring Signals | WebSearch, Chrome careers page | Open roles, growth signals, budget indicators |
| `M07` | Investor Intelligence | SEC EDGAR, earnings transcripts, IR pages | Executive quotes, forward guidance, risk factors |
| `M08` | Strategic Triggers | Cross-module synthesis | Positive triggers, caution signals, timing score |
| `M09` | Buying Committee | LinkedIn, company pages | Stakeholder map, decision makers |
| `M10` | Case Study Matching | Internal case study DB | Vertical-matched proof points |

### Premium Modules (Phase 2)

| Module ID | Module Name | Data Sources | Output |
|-----------|-------------|--------------|--------|
| `M11` | Search Audit | Chrome browser automation | Search quality score, gap analysis |
| `M12` | Contact Intelligence | ZoomInfo, Clearbit | Contact details, org chart |
| `M13` | Social Engagement | LinkedIn API, Twitter API | Recent activity, engagement patterns |
| `M14` | Partner Overlap | Crossbeam | Partner pipeline intersections |
| `M15` | Intent Signals | Demandbase, Bombora | Active buying signals |
| `M16` | Personalized Messaging | LLM synthesis | Custom outreach templates |

### Future Modules (Phase 3+)

| Module ID | Module Name | Data Sources | Output |
|-----------|-------------|--------------|--------|
| `M17` | News & Events | RSS, News API, Google Alerts | Real-time trigger events |
| `M18` | Review Intelligence | G2, TrustRadius, Gartner | Product satisfaction signals |
| `M19` | Job Board Mining | Indeed, LinkedIn, Glassdoor | Detailed role analysis |
| `M20` | Patent Analysis | USPTO, Google Patents | Innovation signals |
| `M21` | SEC 8-K Alerts | SEC EDGAR real-time | Material event detection |

---

## Module Dependency Graph

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                    ORCHESTRATION LAYER                       │
                                    │     Coordinates modules, manages dependencies, caching       │
                                    └─────────────────────────────────────────────────────────────┘
                                                              │
        ┌──────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┐
        │                                                      │                                                       │
        ▼                                                      ▼                                                       ▼
┌───────────────────┐                              ┌───────────────────┐                               ┌───────────────────┐
│   FOUNDATION      │                              │   INTELLIGENCE    │                               │   SYNTHESIS       │
│   (No Dependencies)│                             │   (Needs Foundation)│                             │   (Needs All)     │
├───────────────────┤                              ├───────────────────┤                               ├───────────────────┤
│ M01 Company       │──────────────────────────────▶│ M05 Financial     │                               │ M08 Triggers      │
│ M02 Tech Stack    │──────────────────────────────▶│ M06 Hiring        │──────────────────────────────▶│ M10 Case Studies  │
│ M03 Traffic       │──────────────────────────────▶│ M07 Investor      │                               │ M16 Messaging     │
│ M04 Competitors   │──────────────────────────────▶│ M09 Buying Comm.  │                               │                   │
└───────────────────┘                              └───────────────────┘                               └───────────────────┘
        │                                                      │
        │                                                      │
        ▼                                                      ▼
┌───────────────────┐                              ┌───────────────────┐
│   PREMIUM         │                              │   ENRICHMENT      │
│   (Add-on Modules)│                              │   (External APIs) │
├───────────────────┤                              ├───────────────────┤
│ M11 Search Audit  │                              │ M12 ZoomInfo      │
│ M14 Crossbeam     │                              │ M13 Social        │
│ M15 Demandbase    │                              │ M15 Intent        │
└───────────────────┘                              └───────────────────┘
```

---

## Module Data Flow Example

**Scenario**: Enrich "costco.com" with full intelligence

```
Step 1: FOUNDATION (parallel execution)
├── M01 Company Context
│   └── WebSearch: "Costco Wholesale Corporation" → Retail, $254B revenue, 316K employees
├── M02 Tech Stack
│   └── BuiltWith: Adobe AEM, no Algolia, removed RichRelevance
├── M03 Traffic
│   └── SimilarWeb: 187M monthly visits, 45% search traffic, 32% bounce
└── M04 Competitors
    └── SimilarWeb similar-sites → Sam's Club, BJ's, Target
    └── BuiltWith per competitor → Sam's: Elasticsearch, Target: Algolia ✓

Step 2: INTELLIGENCE (sequential, needs Foundation)
├── M05 Financial (needs M01 for ticker)
│   └── Yahoo Finance "COST" → Revenue: $254B, EBITDA: $12.5B, Margin: Green
├── M06 Hiring (needs M01 for company name)
│   └── WebSearch + Chrome careers → 247 open roles, 15% are tech
├── M07 Investor (needs M01 for ticker)
│   └── SEC EDGAR 10-K → "Digital transformation" priority
│   └── Q4 Earnings → CEO quote: "E-commerce grew 22%"
└── M09 Buying Committee (needs M01, M06)
    └── LinkedIn → Craig Jelinek (CEO), Richard Galanti (CFO), VP E-commerce

Step 3: SYNTHESIS (needs all above)
├── M08 Strategic Triggers
│   └── Cross-reference: RichRelevance removed (PAIN) + Hiring tech (BUDGET) + CEO quote (TIMING)
│   └── Result: HOT LEAD (all 3 signals present)
├── M10 Case Studies
│   └── Match vertical "Retail" → Lacoste, Decathlon case studies
└── M16 Personalized Messaging (future)
    └── LLM: "You told investors e-commerce grew 22% — we can accelerate that..."
```

---

# 4. Microservices Architecture

## Service Inventory

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        API GATEWAY                                                    │
│     Kong / AWS API Gateway / Traefik — Rate limiting, Auth, Routing, Load balancing                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────────┐
          ▼                                   ▼                                       ▼
┌──────────────────────┐        ┌──────────────────────┐           ┌──────────────────────┐
│  ORCHESTRATION       │        │  CORE SERVICES       │           │  INTEGRATION         │
│  SERVICES            │        │                      │           │  SERVICES            │
├──────────────────────┤        ├──────────────────────┤           ├──────────────────────┤
│ enrichment-orchestrator│       │ company-service      │           │ builtwith-adapter    │
│ pipeline-coordinator   │       │ scoring-service      │           │ similarweb-adapter   │
│ job-scheduler         │       │ search-service       │           │ yahoo-finance-adapter│
│ event-bus             │       │ export-service       │           │ sec-edgar-adapter    │
└──────────────────────┘        └──────────────────────┘           │ zoominfo-adapter     │
                                                                    │ crossbeam-adapter    │
                                                                    │ demandbase-adapter   │
                                                                    │ browser-automation   │
                                                                    └──────────────────────┘
          │                                   │                                       │
          └───────────────────────────────────┼───────────────────────────────────────┘
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        DATA LAYER                                                     │
│     PostgreSQL (primary) + Redis (cache) + S3 (blob storage) + Elasticsearch (search)                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Service Definitions

### Orchestration Services

| Service | Responsibility | Language | Dependencies |
|---------|---------------|----------|--------------|
| `enrichment-orchestrator` | Coordinates multi-module enrichment | Python | Redis, PostgreSQL, All adapters |
| `pipeline-coordinator` | Manages data flow between modules | Python | Redis, Event bus |
| `job-scheduler` | Schedules batch jobs, retries | Python | Redis, PostgreSQL |
| `event-bus` | Pub/sub for async events | Redis Streams / Kafka | Redis or Kafka |

### Core Services

| Service | Responsibility | Language | Dependencies |
|---------|---------------|----------|--------------|
| `company-service` | Company CRUD, search, filtering | Python | PostgreSQL, Elasticsearch |
| `scoring-service` | ICP scoring, signal scoring | Python | PostgreSQL |
| `search-service` | Full-text search, facets | Python | Elasticsearch |
| `export-service` | CSV, PDF, Excel export | Python | PostgreSQL, S3 |

### Integration Services (Adapters)

| Service | External API | Rate Limit | Circuit Breaker |
|---------|-------------|------------|-----------------|
| `builtwith-adapter` | BuiltWith API | 100/day (free), 10K/day (pro) | Yes |
| `similarweb-adapter` | SimilarWeb API | 500/day | Yes |
| `yahoo-finance-adapter` | yfinance (scraping) | 1/sec | Yes |
| `sec-edgar-adapter` | SEC EDGAR | 10/sec | Yes |
| `zoominfo-adapter` | ZoomInfo API | TBD | Yes |
| `crossbeam-adapter` | Crossbeam API | TBD | Yes |
| `demandbase-adapter` | Demandbase API | TBD | Yes |
| `browser-automation` | Chrome CDP | N/A | Yes |

---

## Service Communication Patterns

### Synchronous (REST/gRPC)

Used for: User-facing requests, real-time queries

```
Client → API Gateway → company-service → PostgreSQL
                    → scoring-service
                    → search-service → Elasticsearch
```

### Asynchronous (Event-Driven)

Used for: Enrichment pipelines, batch processing, cross-module updates

```
enrichment-orchestrator
    │
    ├── PUBLISH: "enrichment.company.requested" { domain: "costco.com" }
    │
    │   ┌──────────────────────────────────────────────────────────────┐
    │   │                      EVENT BUS                                │
    │   └──────────────────────────────────────────────────────────────┘
    │                │                    │                    │
    │                ▼                    ▼                    ▼
    │     builtwith-adapter    similarweb-adapter    yahoo-adapter
    │                │                    │                    │
    │                ▼                    ▼                    ▼
    │     PUBLISH:              PUBLISH:              PUBLISH:
    │     "enrichment.techstack.completed"  "enrichment.traffic.completed"  ...
    │
    └── SUBSCRIBE: "enrichment.*.completed" → Aggregate results → Update company
```

---

# 5. Data Pipeline Design

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              ENRICHMENT PIPELINE                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    INPUT                   FETCH                 TRANSFORM              VALIDATE              PERSIST
    ─────                   ─────                 ─────────              ────────              ───────

┌─────────┐           ┌─────────────┐         ┌─────────────┐        ┌─────────────┐      ┌─────────────┐
│ Domain  │           │  Adapter    │         │ Transformer │        │  Validator  │      │  Repository │
│ Request │──────────▶│  (w/ retry) │────────▶│  (raw→norm) │───────▶│  (Pydantic) │─────▶│  (async)    │
└─────────┘           └─────────────┘         └─────────────┘        └─────────────┘      └─────────────┘
                            │                                               │
                            │ Circuit                                       │ Schema
                            │ Breaker                                       │ Validation
                            │                                               │
                      ┌─────────────┐                                 ┌─────────────┐
                      │  Fallback   │                                 │  Error      │
                      │  Strategy   │                                 │  Handler    │
                      └─────────────┘                                 └─────────────┘
```

## Pipeline Stages

### Stage 1: Input Validation

```python
class EnrichmentRequest(BaseModel):
    domain: str = Field(..., pattern=r'^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$')
    modules: List[ModuleEnum] = Field(default=['all'])
    priority: PriorityEnum = Field(default='normal')
    force_refresh: bool = False
    callback_url: Optional[HttpUrl] = None
```

### Stage 2: Module Routing

```python
class PipelineCoordinator:
    """Routes enrichment requests to appropriate modules based on dependencies."""

    MODULE_DEPENDENCIES = {
        'M01_company': [],
        'M02_techstack': [],
        'M03_traffic': [],
        'M04_competitors': [],
        'M05_financial': ['M01_company'],  # needs ticker from company
        'M06_hiring': ['M01_company'],
        'M07_investor': ['M01_company'],
        'M08_triggers': ['M01_company', 'M02_techstack', 'M05_financial', 'M06_hiring'],
        'M09_buying_committee': ['M01_company', 'M06_hiring'],
        'M10_case_studies': ['M01_company', 'M04_competitors'],
    }

    async def execute_pipeline(self, request: EnrichmentRequest) -> EnrichmentResult:
        # Wave 1: Foundation modules (parallel)
        wave1_results = await asyncio.gather(
            self.execute_module('M01_company', request.domain),
            self.execute_module('M02_techstack', request.domain),
            self.execute_module('M03_traffic', request.domain),
            self.execute_module('M04_competitors', request.domain),
        )

        # Wave 2: Intelligence modules (parallel, with dependencies)
        wave2_results = await asyncio.gather(
            self.execute_module('M05_financial', request.domain, context=wave1_results),
            self.execute_module('M06_hiring', request.domain, context=wave1_results),
            self.execute_module('M07_investor', request.domain, context=wave1_results),
        )

        # Wave 3: Synthesis modules (sequential)
        wave3_results = await self.execute_module(
            'M08_triggers',
            request.domain,
            context={**wave1_results, **wave2_results}
        )

        return self.aggregate_results(wave1_results, wave2_results, wave3_results)
```

### Stage 3: Adapter Execution

Each adapter follows the same pattern:

```python
class BaseAdapter(ABC):
    """Base adapter with retry, circuit breaker, rate limiting, transformation, validation."""

    def __init__(self, config: AdapterConfig):
        self.rate_limiter = TokenBucketRateLimiter(
            rate=config.rate_limit,
            per=config.rate_limit_period
        )
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=config.failure_threshold,
            recovery_timeout=config.recovery_timeout
        )
        self.cache = Redis(url=config.redis_url)

    @retry_with_backoff(max_retries=3, base_delay=1.0, jitter=True)
    async def fetch(self, identifier: str) -> AdapterResult:
        # 1. Check cache
        cached = await self.cache.get(self.cache_key(identifier))
        if cached and not self.is_stale(cached):
            return AdapterResult(success=True, data=cached, cached=True)

        # 2. Check circuit breaker
        if not self.circuit_breaker.can_execute():
            return AdapterResult(success=False, error="Circuit open")

        # 3. Rate limit
        await self.rate_limiter.acquire()

        # 4. Fetch from external API
        try:
            raw_data = await self._fetch_from_api(identifier)
            transformed = self.transform(raw_data)
            validated = self.validate(transformed)

            # 5. Cache result
            await self.cache.set(self.cache_key(identifier), validated, ex=self.cache_ttl)

            self.circuit_breaker.record_success()
            return AdapterResult(success=True, data=validated)

        except Exception as e:
            self.circuit_breaker.record_failure()
            return AdapterResult(success=False, error=str(e))

    @abstractmethod
    async def _fetch_from_api(self, identifier: str) -> dict:
        """Subclass implements actual API call."""
        pass

    @abstractmethod
    def transform(self, raw_data: dict) -> dict:
        """Transform raw API response to normalized format."""
        pass

    @abstractmethod
    def validate(self, data: dict) -> dict:
        """Validate against Pydantic schema."""
        pass
```

### Stage 4: Result Aggregation

```python
class ResultAggregator:
    """Aggregates results from multiple modules into unified company intelligence."""

    def aggregate(
        self,
        domain: str,
        module_results: Dict[str, AdapterResult]
    ) -> CompanyIntelligence:

        intelligence = CompanyIntelligence(domain=domain)
        errors = {}

        for module_id, result in module_results.items():
            if result.success:
                self._merge_module_data(intelligence, module_id, result.data)
            else:
                errors[module_id] = result.error

        # Calculate derived fields
        intelligence.priority_score = self._calculate_priority_score(intelligence)
        intelligence.signal_summary = self._extract_signals(intelligence)
        intelligence.enrichment_status = self._determine_status(module_results)
        intelligence.errors = errors if errors else None

        return intelligence
```

---

# 6. Database Schema

## PostgreSQL Schema (Normalized)

### Core Tables

```sql
-- =====================================================
-- CORE ENTITIES
-- =====================================================

-- Companies (master entity)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    canonical_name VARCHAR(500),

    -- Classification
    vertical VARCHAR(100),
    sub_vertical VARCHAR(100),
    company_size VARCHAR(50),  -- 'SMB', 'Mid-Market', 'Enterprise'
    ownership_type VARCHAR(50),  -- 'Public', 'Private', 'PE-Backed', 'VC-Backed'

    -- Basic info
    founded_year INTEGER,
    headquarters_city VARCHAR(100),
    headquarters_country VARCHAR(2),
    employee_count INTEGER,
    employee_count_source VARCHAR(100),
    employee_count_date DATE,

    -- Scoring
    icp_tier INTEGER CHECK (icp_tier BETWEEN 1 AND 3),
    icp_tier_name VARCHAR(50),
    icp_score INTEGER CHECK (icp_score BETWEEN 0 AND 100),
    signal_score INTEGER,
    priority_score INTEGER,
    priority_status VARCHAR(20),  -- 'hot', 'warm', 'cool', 'cold'

    -- Enrichment metadata
    enrichment_level VARCHAR(20) DEFAULT 'none',  -- 'none', 'basic', 'partial', 'full'
    last_enriched_at TIMESTAMPTZ,
    next_scheduled_enrichment TIMESTAMPTZ,

    -- Algolia relationship
    is_algolia_customer BOOLEAN DEFAULT FALSE,
    algolia_arr DECIMAL(12, 2),
    algolia_products TEXT[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_vertical ON companies(vertical);
CREATE INDEX idx_companies_priority_score ON companies(priority_score DESC);
CREATE INDEX idx_companies_icp_tier ON companies(icp_tier);
CREATE INDEX idx_companies_enrichment ON companies(enrichment_level, last_enriched_at);


-- =====================================================
-- MODULE DATA TABLES (One per module)
-- =====================================================

-- M02: Technology Stack
CREATE TABLE company_technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    technology_name VARCHAR(255) NOT NULL,
    technology_category VARCHAR(100),  -- 'Search', 'CMS', 'Ecommerce', 'Analytics', etc.

    is_current BOOLEAN DEFAULT TRUE,
    first_detected DATE,
    last_detected DATE,
    removed_date DATE,

    is_partner_tech BOOLEAN DEFAULT FALSE,
    is_competitor_tech BOOLEAN DEFAULT FALSE,
    is_search_vendor BOOLEAN DEFAULT FALSE,

    detection_source VARCHAR(50),  -- 'builtwith', 'similarweb', 'manual'
    source_url TEXT,
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, technology_name)
);

CREATE INDEX idx_tech_company ON company_technologies(company_id);
CREATE INDEX idx_tech_category ON company_technologies(technology_category);
CREATE INDEX idx_tech_search ON company_technologies(is_search_vendor);


-- M03: Traffic Intelligence
CREATE TABLE company_traffic (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Core metrics
    monthly_visits BIGINT,
    unique_visitors BIGINT,
    bounce_rate DECIMAL(5, 4),  -- 0.0000 to 1.0000
    pages_per_visit DECIMAL(5, 2),
    avg_visit_duration_seconds INTEGER,

    -- Rankings
    global_rank INTEGER,
    country_rank INTEGER,
    category_rank INTEGER,

    -- Traffic sources (percentages)
    direct_traffic_pct DECIMAL(5, 4),
    organic_search_pct DECIMAL(5, 4),
    paid_search_pct DECIMAL(5, 4),
    social_traffic_pct DECIMAL(5, 4),
    referral_traffic_pct DECIMAL(5, 4),
    mail_traffic_pct DECIMAL(5, 4),
    display_traffic_pct DECIMAL(5, 4),

    -- Algolia-relevant signals
    search_traffic_pct DECIMAL(5, 4),  -- organic + paid search

    -- Geography (top 3)
    geography_data JSONB,

    -- Demographics
    demographics_data JSONB,

    -- Metadata
    data_source VARCHAR(50) DEFAULT 'similarweb',
    source_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, period_start, period_end)
);

CREATE INDEX idx_traffic_company ON company_traffic(company_id);
CREATE INDEX idx_traffic_visits ON company_traffic(monthly_visits DESC);


-- M04: Competitors
CREATE TABLE company_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    competitor_id UUID REFERENCES companies(id),  -- Nullable if competitor not in our DB

    competitor_domain VARCHAR(255) NOT NULL,
    competitor_name VARCHAR(500),

    -- Similarity metrics
    similarity_score DECIMAL(5, 4),
    traffic_share DECIMAL(5, 4),
    audience_overlap_pct DECIMAL(5, 4),

    -- Technology comparison
    competitor_search_vendor VARCHAR(100),
    competitor_uses_algolia BOOLEAN DEFAULT FALSE,

    -- Source
    detection_source VARCHAR(50),  -- 'similarweb_similar', 'similarweb_keywords', 'builtwith'
    source_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, competitor_domain)
);

CREATE INDEX idx_competitors_company ON company_competitors(company_id);
CREATE INDEX idx_competitors_algolia ON company_competitors(competitor_uses_algolia);


-- M05: Financial Intelligence
CREATE TABLE company_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Stock info
    ticker VARCHAR(20),
    exchange VARCHAR(20),
    is_public BOOLEAN DEFAULT FALSE,

    -- Current metrics
    market_cap BIGINT,
    current_price DECIMAL(12, 2),
    pe_ratio DECIMAL(8, 2),

    -- Annual data (most recent fiscal year)
    fiscal_year INTEGER,
    revenue BIGINT,
    revenue_growth_yoy DECIMAL(5, 2),
    net_income BIGINT,
    ebitda BIGINT,
    operating_margin DECIMAL(5, 4),
    gross_margin DECIMAL(5, 4),

    -- Margin zone classification
    margin_zone VARCHAR(10),  -- 'green', 'yellow', 'red'

    -- Multi-year trends (JSON for flexibility)
    revenue_3yr_trend JSONB,  -- [{year: 2023, value: X}, {year: 2024, value: Y}, ...]
    ebitda_3yr_trend JSONB,

    -- E-commerce specific
    ecommerce_revenue BIGINT,
    ecommerce_revenue_pct DECIMAL(5, 4),
    ecommerce_growth_yoy DECIMAL(5, 2),

    -- ROI estimate
    estimated_search_addressable BIGINT,
    estimated_roi_conservative BIGINT,
    estimated_roi_moderate BIGINT,
    roi_calculation_json JSONB,

    -- Metadata
    data_source VARCHAR(50),  -- 'yahoo_finance', 'sec_edgar', 'ecdb', 'pitchbook'
    confidence_level VARCHAR(20),  -- 'high', 'medium', 'low'
    source_url TEXT,
    data_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financials_company ON company_financials(company_id);
CREATE INDEX idx_financials_margin ON company_financials(margin_zone);


-- M06: Hiring Signals
CREATE TABLE company_hiring_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Role info
    job_title VARCHAR(500),
    job_title_normalized VARCHAR(100),  -- 'VP_ECOMMERCE', 'DIRECTOR_ENGINEERING', etc.
    department VARCHAR(100),
    seniority_level VARCHAR(50),  -- 'C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'IC'

    -- Location
    location_text VARCHAR(255),
    location_city VARCHAR(100),
    location_country VARCHAR(2),
    is_remote BOOLEAN,

    -- Timing
    posted_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    closed_date DATE,

    -- Algolia relevance
    is_search_related BOOLEAN DEFAULT FALSE,  -- search, relevance, discovery, AI
    is_ecommerce_related BOOLEAN DEFAULT FALSE,
    is_technology_related BOOLEAN DEFAULT FALSE,
    relevance_keywords TEXT[],

    -- Signal classification
    signal_type VARCHAR(50),  -- 'budget', 'build_vs_buy', 'expansion', 'replacement'
    signal_strength VARCHAR(20),  -- 'strong', 'moderate', 'weak'

    -- Source
    job_url TEXT,
    detection_source VARCHAR(50),  -- 'linkedin', 'careers_page', 'indeed', 'websearch'

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hiring_company ON company_hiring_signals(company_id);
CREATE INDEX idx_hiring_search ON company_hiring_signals(is_search_related);
CREATE INDEX idx_hiring_date ON company_hiring_signals(posted_date DESC);


-- M07: Investor Intelligence
CREATE TABLE company_investor_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Quote
    quote_text TEXT NOT NULL,
    quote_speaker_name VARCHAR(255),
    quote_speaker_title VARCHAR(255),

    -- Source
    source_type VARCHAR(50),  -- 'earnings_call', '10k', '10q', 'investor_day', 'interview', 'podcast'
    source_name VARCHAR(255),  -- 'Q4 2025 Earnings Call', 'FY2025 10-K', etc.
    source_url TEXT,
    source_date DATE,

    -- Classification
    relevance_tags TEXT[],  -- ['digital_transformation', 'ecommerce', 'search', 'ai']
    maps_to_product VARCHAR(100),  -- 'Algolia Search', 'Algolia Recommend', 'NeuralSearch'
    quote_strength VARCHAR(20),  -- 'strong', 'moderate', 'tangential'

    -- Forward guidance (if applicable)
    is_forward_guidance BOOLEAN DEFAULT FALSE,
    guidance_metric VARCHAR(100),
    guidance_target TEXT,

    -- Risk factors (if applicable)
    is_risk_factor BOOLEAN DEFAULT FALSE,
    risk_category VARCHAR(100),

    -- Verification
    verification_status VARCHAR(20) DEFAULT 'unverified',  -- 'verified', 'unverified'
    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investor_company ON company_investor_intelligence(company_id);
CREATE INDEX idx_investor_strength ON company_investor_intelligence(quote_strength);
CREATE INDEX idx_investor_tags ON company_investor_intelligence USING GIN(relevance_tags);


-- M08: Strategic Triggers
CREATE TABLE company_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Trigger info
    trigger_type VARCHAR(50) NOT NULL,
    -- Types: 'tech_removed', 'tech_added', 'exec_change', 'funding', 'acquisition',
    --        'platform_migration', 'hiring_surge', 'competitor_adopted_algolia',
    --        'layoffs', 'earnings_miss', 'hiring_freeze'

    trigger_category VARCHAR(20),  -- 'budget', 'pain', 'timing', 'negative'
    trigger_title VARCHAR(500),
    trigger_description TEXT,

    -- Impact
    impact_level VARCHAR(20),  -- 'high', 'medium', 'low'
    signal_weight INTEGER,  -- positive or negative weight

    -- Evidence
    event_date DATE,
    source_url TEXT,
    source_type VARCHAR(50),

    -- Timing relevance
    is_recent BOOLEAN DEFAULT TRUE,  -- within 12 months
    recency_days INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_triggers_company ON company_triggers(company_id);
CREATE INDEX idx_triggers_type ON company_triggers(trigger_type);
CREATE INDEX idx_triggers_category ON company_triggers(trigger_category);


-- M09: Buying Committee
CREATE TABLE company_stakeholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Person info
    person_name VARCHAR(255) NOT NULL,
    person_title VARCHAR(255),
    person_title_normalized VARCHAR(100),

    -- Role classification
    buyer_role VARCHAR(50),  -- 'economic_buyer', 'technical_buyer', 'user_buyer', 'champion'
    department VARCHAR(100),
    seniority_level VARCHAR(50),

    -- Contact (when available via ZoomInfo, etc.)
    email VARCHAR(255),
    linkedin_url TEXT,
    phone VARCHAR(50),

    -- Intelligence
    tenure_months INTEGER,
    previous_company VARCHAR(255),
    previous_title VARCHAR(255),
    is_new_in_role BOOLEAN DEFAULT FALSE,  -- within 12 months

    -- Algolia relevance
    is_decision_maker BOOLEAN DEFAULT FALSE,
    is_budget_owner BOOLEAN DEFAULT FALSE,
    priority_signal VARCHAR(50),  -- 'hot', 'warm', 'standard'
    outreach_sequence INTEGER,  -- 1, 2, 3... (order to reach out)

    -- Source
    source_url TEXT,
    detection_source VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stakeholders_company ON company_stakeholders(company_id);
CREATE INDEX idx_stakeholders_role ON company_stakeholders(buyer_role);
CREATE INDEX idx_stakeholders_decision ON company_stakeholders(is_decision_maker);


-- M10: Case Study Matches
CREATE TABLE company_case_study_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    case_study_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,

    -- Match reasoning
    match_type VARCHAR(50),  -- 'vertical', 'technology', 'competitor_displacement', 'size'
    match_score INTEGER CHECK (match_score BETWEEN 0 AND 100),
    match_reasoning TEXT,

    -- Usage
    is_primary BOOLEAN DEFAULT FALSE,
    is_secondary BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, case_study_id)
);

CREATE INDEX idx_case_matches_company ON company_case_study_matches(company_id);


-- =====================================================
-- REFERENCE DATA
-- =====================================================

-- Case Studies (Algolia proof points)
CREATE TABLE case_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_name VARCHAR(255) NOT NULL,
    customer_domain VARCHAR(255),

    -- Classification
    vertical VARCHAR(100),
    sub_vertical VARCHAR(100),
    company_size VARCHAR(50),

    -- Content
    headline VARCHAR(500),
    summary TEXT,
    key_metric_value VARCHAR(100),
    key_metric_type VARCHAR(100),  -- 'conversion_rate', 'revenue', 'latency', etc.

    -- Algolia products
    algolia_products TEXT[],

    -- URLs
    story_url TEXT,
    verified_at TIMESTAMPTZ,
    is_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_studies_vertical ON case_studies(vertical);


-- =====================================================
-- ENRICHMENT TRACKING
-- =====================================================

-- Enrichment Jobs
CREATE TABLE enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Job info
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'partial', 'failed'
    priority VARCHAR(20) DEFAULT 'normal',

    -- Modules
    requested_modules TEXT[],
    completed_modules TEXT[],
    failed_modules JSONB,  -- {module: error_message}

    -- Timing
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Result
    result_summary JSONB,

    -- Retry
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_status ON enrichment_jobs(status);
CREATE INDEX idx_jobs_company ON enrichment_jobs(company_id);


-- API Rate Limit Tracking
CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    api_name VARCHAR(50) NOT NULL,  -- 'builtwith', 'similarweb', 'yahoo_finance'

    -- Limits
    calls_today INTEGER DEFAULT 0,
    calls_this_minute INTEGER DEFAULT 0,
    daily_limit INTEGER,
    per_minute_limit INTEGER,

    -- Reset times
    daily_reset_at TIMESTAMPTZ,
    minute_reset_at TIMESTAMPTZ,

    -- Circuit breaker
    circuit_state VARCHAR(20) DEFAULT 'closed',  -- 'closed', 'open', 'half_open'
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(api_name)
);


-- =====================================================
-- USER & ACCESS CONTROL
-- =====================================================

-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    key_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of API key
    key_prefix VARCHAR(8) NOT NULL,  -- First 8 chars for identification

    -- Owner
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    organization VARCHAR(255),

    -- Permissions
    rate_limit_tier VARCHAR(20) DEFAULT 'standard',  -- 'standard', 'power', 'admin'
    allowed_modules TEXT[],

    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    total_requests INTEGER DEFAULT 0,

    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,

    UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_email ON api_keys(user_email);
```

---

# 7. API Design

## API Principles

1. **RESTful** with resource-based URLs
2. **Versioned** (`/api/v1/`, `/api/v2/`)
3. **Consistent error responses** with error codes
4. **Paginated** list endpoints
5. **Idempotent** operations where possible
6. **Rate limited** with clear headers

## Endpoint Inventory

### Company Endpoints

```yaml
# Get company by domain
GET /api/v1/companies/{domain}
Response: CompanyDetail

# List companies (paginated, filterable)
GET /api/v1/companies
Query params:
  - page: int (default 1)
  - per_page: int (default 50, max 200)
  - tier: int (1, 2, 3)
  - score_min: int (0-100)
  - score_max: int (0-100)
  - priority: string (hot, warm, cool, cold)
  - vertical: string
  - has_algolia: bool
  - search: string (full-text search)
  - sort_by: string (score, traffic, revenue, updated)
  - sort_dir: string (asc, desc)
Response: PaginatedList[CompanySummary]

# Search companies (Elasticsearch)
POST /api/v1/companies/search
Body: SearchQuery
Response: SearchResults

# Bulk lookup
POST /api/v1/companies/bulk
Body: { domains: string[] }
Response: { companies: CompanySummary[], not_found: string[] }
```

### Enrichment Endpoints

```yaml
# Trigger enrichment (async)
POST /api/v1/enrich/{domain}
Query params:
  - modules: string[] (default all)
  - force: bool (ignore cache)
  - priority: string (normal, high)
  - callback_url: string (webhook for completion)
Response: { job_id: string, status_url: string }

# Get enrichment job status
GET /api/v1/enrich/jobs/{job_id}
Response: EnrichmentJobStatus

# List enrichment jobs
GET /api/v1/enrich/jobs
Query params:
  - status: string
  - company_id: uuid
  - since: datetime
Response: PaginatedList[EnrichmentJobSummary]

# Cancel enrichment job
DELETE /api/v1/enrich/jobs/{job_id}
Response: { cancelled: bool }
```

### Module-Specific Endpoints

```yaml
# Technology stack
GET /api/v1/companies/{domain}/technologies
Response: TechnologyStack

# Competitors
GET /api/v1/companies/{domain}/competitors
Response: CompetitorAnalysis

# Financials
GET /api/v1/companies/{domain}/financials
Response: FinancialProfile

# Hiring signals
GET /api/v1/companies/{domain}/hiring
Response: HiringSignals

# Investor intelligence
GET /api/v1/companies/{domain}/investor-intelligence
Response: InvestorIntelligence

# Triggers
GET /api/v1/companies/{domain}/triggers
Response: TriggerSummary

# Buying committee
GET /api/v1/companies/{domain}/stakeholders
Response: StakeholderMap

# Case study matches
GET /api/v1/companies/{domain}/case-studies
Response: CaseStudyMatches
```

### Batch Operations

```yaml
# Batch enrichment
POST /api/v1/batch/enrich
Body: { domains: string[], modules: string[], priority: string }
Response: { batch_id: string, job_ids: string[] }

# Batch export
POST /api/v1/batch/export
Body: { domains: string[], format: string, fields: string[] }
Response: { export_id: string, download_url: string (when ready) }
```

### Analytics & Stats

```yaml
# Dashboard stats
GET /api/v1/stats/dashboard
Response: DashboardStats

# Enrichment stats
GET /api/v1/stats/enrichment
Response: EnrichmentStats

# API usage
GET /api/v1/stats/usage
Response: UsageStats
```

## Response Models

```python
class CompanyDetail(BaseModel):
    """Full company intelligence response."""
    domain: str
    canonical_name: str

    # Classification
    vertical: Optional[str]
    icp_tier: Optional[int]
    icp_tier_name: Optional[str]
    company_size: Optional[str]
    ownership_type: Optional[str]

    # Scoring
    icp_score: Optional[int]
    signal_score: Optional[int]
    priority_score: Optional[int]
    priority_status: Optional[str]
    signal_breakdown: Optional[SignalBreakdown]

    # Module data
    technologies: Optional[TechnologyStack]
    traffic: Optional[TrafficMetrics]
    competitors: Optional[List[CompetitorSummary]]
    financials: Optional[FinancialSummary]
    hiring: Optional[HiringSignalsSummary]
    investor_intelligence: Optional[InvestorIntelligenceSummary]
    triggers: Optional[List[TriggerEvent]]
    stakeholders: Optional[List[Stakeholder]]
    case_studies: Optional[List[CaseStudyMatch]]

    # Metadata
    enrichment_level: str
    last_enriched_at: Optional[datetime]
    needs_refresh: bool

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class EnrichmentJobStatus(BaseModel):
    """Enrichment job status response."""
    job_id: str
    domain: str
    status: str  # pending, running, completed, partial, failed

    requested_modules: List[str]
    completed_modules: List[str]
    failed_modules: Dict[str, str]

    progress_pct: int
    current_step: Optional[str]

    queued_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]

    result: Optional[CompanyDetail]
    errors: Optional[List[str]]
```

---

# 8. Frontend/UX Architecture

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | **React 18** | Component model, hooks, concurrent features |
| Build | **Vite** | Fast HMR, ES modules, simple config |
| State | **Zustand** | Lightweight, no boilerplate |
| Data | **TanStack Query** | Caching, loading states, pagination |
| Routing | **React Router v6** | Type-safe routing |
| Styling | **Tailwind CSS** | Utility-first, consistent design |
| Tables | **TanStack Table** | Virtual scrolling, sorting, filtering |
| Charts | **Recharts** + **D3** | Financial charts, custom visualizations |
| Icons | **Lucide React** | Modern icon set |
| Forms | **React Hook Form** + **Zod** | Validation |

## Page Architecture

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── pages/
│   │   ├── Dashboard/
│   │   │   ├── index.tsx
│   │   │   ├── components/
│   │   │   │   ├── StatsCards.tsx
│   │   │   │   ├── PriorityFunnel.tsx
│   │   │   │   └── RecentActivity.tsx
│   │   │   └── hooks/
│   │   │       └── useDashboardStats.ts
│   │   │
│   │   ├── Companies/
│   │   │   ├── List/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── CompanyTable.tsx
│   │   │   │   ├── FilterBar.tsx
│   │   │   │   └── ExportButton.tsx
│   │   │   │
│   │   │   └── Detail/
│   │   │       ├── index.tsx
│   │   │       ├── Header.tsx
│   │   │       ├── SignalIndicators.tsx
│   │   │       ├── tabs/
│   │   │       │   ├── OverviewTab.tsx
│   │   │       │   ├── FinancialsTab.tsx
│   │   │       │   ├── TechStackTab.tsx
│   │   │       │   ├── CompetitorsTab.tsx
│   │   │       │   ├── HiringTab.tsx
│   │   │       │   ├── InvestorTab.tsx
│   │   │       │   ├── StakeholdersTab.tsx
│   │   │       │   └── TriggersTab.tsx
│   │   │       └── hooks/
│   │   │           ├── useCompanyDetail.ts
│   │   │           └── useEnrichment.ts
│   │   │
│   │   ├── Enrichment/
│   │   │   ├── Queue.tsx
│   │   │   ├── JobDetail.tsx
│   │   │   └── BatchEnrich.tsx
│   │   │
│   │   ├── SearchAudit/           # Premium module
│   │   │   ├── NewAudit.tsx
│   │   │   ├── AuditProgress.tsx
│   │   │   ├── AuditReport.tsx
│   │   │   └── AuditHistory.tsx
│   │   │
│   │   └── Settings/
│   │       ├── ApiKeys.tsx
│   │       ├── Integrations.tsx
│   │       └── Team.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── company/
│   │   │   ├── CompanyCard.tsx
│   │   │   ├── ScoreBadge.tsx
│   │   │   ├── PriorityBadge.tsx
│   │   │   ├── SignalChip.tsx
│   │   │   ├── EnrichmentStatus.tsx
│   │   │   └── QuickActions.tsx
│   │   │
│   │   ├── charts/
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── TrafficChart.tsx
│   │   │   ├── ScoreGauge.tsx
│   │   │   ├── PriorityFunnel.tsx
│   │   │   └── CompetitorComparison.tsx
│   │   │
│   │   ├── intelligence/
│   │   │   ├── TechStackDiagram.tsx
│   │   │   ├── ExecutiveQuote.tsx
│   │   │   ├── TriggerCard.tsx
│   │   │   ├── HiringChart.tsx
│   │   │   └── StakeholderCard.tsx
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Modal.tsx
│   │       ├── Tabs.tsx
│   │       ├── Table.tsx
│   │       ├── GlassCard.tsx
│   │       ├── Loading.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── Toast.tsx
│   │
│   ├── api/
│   │   ├── client.ts
│   │   ├── companies.ts
│   │   ├── enrichment.ts
│   │   └── types.ts
│   │
│   ├── stores/
│   │   ├── useFilters.ts
│   │   ├── useSettings.ts
│   │   └── useAuth.ts
│   │
│   └── utils/
│       ├── format.ts
│       ├── constants.ts
│       └── cn.ts
```

## Key UI Components

### Company Detail Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◀ Back to List                                    [Refresh] [Export] [▼]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  COSTCO WHOLESALE CORPORATION                   [Score: 85] [🔥 HOT]  │   │
│  │  costco.com • Retail • Enterprise • Public (COST)                     │   │
│  │                                                                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                       │   │
│  │  │ 💰 BUDGET  │  │ 😰 PAIN    │  │ ⏰ TIMING  │   Last enriched: 2h   │   │
│  │  │  ✓ Active  │  │  ✓ Active  │  │  ✓ Active  │   [Refresh Data]      │   │
│  │  └────────────┘  └────────────┘  └────────────┘                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │  KEY METRICS                 │  │  TRIGGER EVENTS                     │   │
│  │                              │  │                                     │   │
│  │  Revenue    $254B  ↗ +7%    │  │  ⚡ RichRelevance REMOVED (Dec 24)  │   │
│  │  Traffic    187M   ↗ +12%   │  │  💼 Hiring: VP E-Commerce (Jan 25)  │   │
│  │  Margin     🟢 Green 4.8%   │  │  📈 E-commerce grew 22% (Q4 call)   │   │
│  │  Search %   45%             │  │                                     │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  💬 EXECUTIVE INSIGHT                                                 │   │
│  │                                                                        │   │
│  │  "E-commerce sales grew 22% year-over-year, now representing 12%      │   │
│  │  of our total revenue. We're investing heavily in digital."           │   │
│  │  — Ron Vachris, CEO, Q4 2025 Earnings Call                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  [Overview] [Financials] [Tech] [Competitors] [Hiring] [Quotes] [...]│   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  [Tab content here - varies by selected tab]                          │   │
│  │                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 9. Infrastructure Design

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CLOUDFLARE                                            │
│     DNS + CDN + DDoS Protection + SSL Termination + Edge Caching                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┴─────────────────────────────────┐
        │                                                                   │
        ▼                                                                   ▼
┌───────────────────────────┐                               ┌───────────────────────────┐
│       VERCEL              │                               │       RAILWAY             │
│    (Frontend + Edge)      │       API Calls               │    (Backend Services)     │
├───────────────────────────┤      ─────────────────>       ├───────────────────────────┤
│ • React SPA               │                               │ • API Gateway             │
│ • Static assets           │                               │ • enrichment-orchestrator │
│ • Edge Functions          │                               │ • company-service         │
│ • Preview deployments     │                               │ • scoring-service         │
└───────────────────────────┘                               │ • All adapters            │
                                                            │ • Worker processes        │
                                                            └───────────────────────────┘
                                                                        │
                            ┌───────────────────────────────────────────┼───────────────────────────────────────────┐
                            │                                           │                                           │
                            ▼                                           ▼                                           ▼
                    ┌───────────────────┐                       ┌───────────────────┐                       ┌───────────────────┐
                    │     SUPABASE      │                       │      UPSTASH      │                       │       AWS S3      │
                    │   (PostgreSQL)    │                       │      (Redis)      │                       │   (Blob Storage)  │
                    ├───────────────────┤                       ├───────────────────┤                       ├───────────────────┤
                    │ • Companies DB    │                       │ • Cache layer     │                       │ • Screenshots     │
                    │ • Intelligence    │                       │ • Rate limiting   │                       │ • PDF exports     │
                    │ • Users/Auth      │                       │ • Job queues      │                       │ • CSV exports     │
                    │ • Audit logs      │                       │ • Session store   │                       │ • Audit artifacts │
                    └───────────────────┘                       └───────────────────┘                       └───────────────────┘
```

## Technology Choices

| Component | Technology | Tier | Cost Estimate |
|-----------|------------|------|---------------|
| Frontend Hosting | Vercel Pro | Pro | $20/month |
| Backend Hosting | Railway | Team | $20-100/month |
| PostgreSQL | Supabase | Pro | $25/month |
| Redis | Upstash | Pay-as-you-go | $10-50/month |
| Blob Storage | AWS S3 | Standard | $5-20/month |
| Monitoring | Sentry + Datadog | Team | $50/month |
| CI/CD | GitHub Actions | Free | $0 |

## Scaling Strategy

### Horizontal Scaling

```yaml
# Railway service scaling
services:
  api-gateway:
    replicas: 2-10
    memory: 512MB
    cpu: 0.5
    autoscale:
      min: 2
      max: 10
      metric: cpu
      target: 70%

  enrichment-orchestrator:
    replicas: 1-5
    memory: 1GB
    cpu: 1.0
    autoscale:
      min: 1
      max: 5
      metric: queue_depth
      target: 100

  builtwith-adapter:
    replicas: 1-3
    memory: 256MB
    cpu: 0.25
    # Rate limited by external API, not by us

  browser-automation:
    replicas: 1-3
    memory: 2GB
    cpu: 2.0
    # Chrome instances are heavy
```

---

# 10. Extensibility Patterns

## Plugin Architecture

Every module follows the same interface, making new modules plug-and-play:

```python
class ModuleInterface(ABC):
    """Base interface for all intelligence modules."""

    @property
    @abstractmethod
    def module_id(self) -> str:
        """Unique module identifier (e.g., 'M01_company')."""
        pass

    @property
    @abstractmethod
    def dependencies(self) -> List[str]:
        """List of module IDs this module depends on."""
        pass

    @property
    @abstractmethod
    def provides(self) -> List[str]:
        """List of data fields this module provides."""
        pass

    @abstractmethod
    async def execute(
        self,
        domain: str,
        context: Dict[str, Any]
    ) -> ModuleResult:
        """Execute the module and return results."""
        pass

    @abstractmethod
    def validate_output(self, result: ModuleResult) -> bool:
        """Validate the module output."""
        pass


# Adding a new module is as simple as:
class ZoomInfoModule(ModuleInterface):
    module_id = "M12_zoominfo"
    dependencies = ["M01_company"]
    provides = ["contacts", "org_chart", "direct_dials"]

    async def execute(self, domain: str, context: Dict) -> ModuleResult:
        # Implementation here
        pass
```

## Feature Flags

```python
class FeatureFlags:
    """Control module availability and rollout."""

    flags = {
        "M11_search_audit": {
            "enabled": True,
            "rollout_percentage": 100,
            "requires_tier": "enterprise",
        },
        "M12_zoominfo": {
            "enabled": True,
            "rollout_percentage": 50,  # 50% of users
            "requires_tier": "enterprise",
        },
        "M14_crossbeam": {
            "enabled": False,  # Coming soon
            "rollout_percentage": 0,
            "requires_tier": "enterprise",
        },
    }
```

## Event System

All modules emit events for observability and extensibility:

```python
class EventTypes(Enum):
    ENRICHMENT_STARTED = "enrichment.started"
    ENRICHMENT_COMPLETED = "enrichment.completed"
    ENRICHMENT_FAILED = "enrichment.failed"

    MODULE_STARTED = "module.started"
    MODULE_COMPLETED = "module.completed"
    MODULE_FAILED = "module.failed"

    SIGNAL_DETECTED = "signal.detected"
    TRIGGER_DETECTED = "trigger.detected"

    COMPETITOR_ALGOLIA_FOUND = "competitor.algolia_found"  # Golden signal!


# Consumers can subscribe to events
event_bus.subscribe(EventTypes.COMPETITOR_ALGOLIA_FOUND, alert_sales_team)
event_bus.subscribe(EventTypes.SIGNAL_DETECTED, update_priority_score)
```

---

# 11. Future Module Integration

## Module Roadmap

### Phase 2 Modules (Q2 2026)

| Module | Integration | Data Output |
|--------|-------------|-------------|
| **ZoomInfo** | REST API | Contact details, org chart, direct dials |
| **Social Engagement** | LinkedIn API, Twitter API | Executive posts, engagement patterns |
| **Search Audit** | Chrome Puppeteer | Search quality score, 10-area analysis |

### Phase 3 Modules (Q3 2026)

| Module | Integration | Data Output |
|--------|-------------|-------------|
| **Crossbeam** | Crossbeam API | Partner pipeline overlap |
| **Demandbase** | Demandbase API | Intent signals, account scores |
| **G2/TrustRadius** | APIs | Product reviews, satisfaction |

### Phase 4 Modules (Q4 2026)

| Module | Integration | Data Output |
|--------|-------------|-------------|
| **Personalized Messaging** | LLM synthesis | Custom outreach templates |
| **Patent Analysis** | USPTO API | Innovation signals |
| **Real-time News** | NewsAPI, RSS | Trigger event alerts |

## Integration Patterns

### ZoomInfo Integration

```python
class ZoomInfoAdapter(BaseAdapter):
    """Adapter for ZoomInfo contact intelligence."""

    PROVIDER = "zoominfo"

    async def fetch(self, domain: str) -> AdapterResult:
        # 1. Company search
        company = await self.search_company(domain)

        # 2. Get org chart
        org_chart = await self.get_org_chart(company.id)

        # 3. Get contacts for target titles
        contacts = await self.get_contacts(
            company_id=company.id,
            titles=["VP E-Commerce", "Director Engineering", "CTO"]
        )

        return AdapterResult(
            success=True,
            data={
                "company": company,
                "org_chart": org_chart,
                "contacts": contacts,
            }
        )
```

### Crossbeam Integration

```python
class CrossbeamAdapter(BaseAdapter):
    """Adapter for Crossbeam partner intelligence."""

    PROVIDER = "crossbeam"

    async def fetch(self, domain: str) -> AdapterResult:
        # 1. Check which partners have this company
        partner_overlaps = await self.get_partner_overlaps(domain)

        # 2. Get partner stage (prospect, customer, churned)
        for overlap in partner_overlaps:
            overlap.stage = await self.get_partner_stage(
                partner_id=overlap.partner_id,
                domain=domain
            )

        return AdapterResult(
            success=True,
            data={
                "partner_overlaps": partner_overlaps,
                "best_co_sell_partner": self.rank_partners(partner_overlaps),
            }
        )
```

---

# 12. Thread-Specific Implementation

## Thread 2: Data Pipeline (Your Focus)

Based on this architecture, your implementation scope is:

### Files to Create

```
pipeline/
├── __init__.py
├── orchestrator.py           # EnrichmentOrchestrator
├── aggregator.py             # ResultAggregator
│
├── adapters/
│   ├── __init__.py
│   ├── base.py               # BaseAdapter (retry, circuit breaker, rate limit)
│   ├── builtwith.py          # BuiltWithAdapter (6 endpoints)
│   ├── similarweb.py         # SimilarWebAdapter (11 endpoints)
│   ├── yahoo_finance.py      # YahooFinanceAdapter
│   ├── sec_edgar.py          # SECEdgarAdapter (10-K, 10-Q)
│   └── websearch.py          # WebSearchAdapter (fallback)
│
├── transformers/
│   ├── __init__.py
│   ├── builtwith.py          # Raw → normalized tech stack
│   ├── similarweb.py         # Raw → normalized traffic
│   ├── yahoo_finance.py      # Raw → normalized financials
│   └── sec_edgar.py          # Raw → normalized filings
│
├── validators/
│   ├── __init__.py
│   └── schemas.py            # Pydantic validation schemas
│
├── utils/
│   ├── __init__.py
│   ├── retry.py              # @retry_with_backoff
│   ├── circuit_breaker.py    # CircuitBreaker class
│   └── rate_limiter.py       # TokenBucketRateLimiter
│
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_builtwith.py
    ├── test_similarweb.py
    ├── test_yahoo_finance.py
    ├── test_orchestrator.py
    └── fixtures/
        ├── builtwith_responses.json
        ├── similarweb_responses.json
        └── yahoo_finance_responses.json
```

### Deliverables Checklist

- [ ] `BaseAdapter` with retry, circuit breaker, rate limiter
- [ ] `BuiltWithAdapter` with all 6 endpoints
- [ ] `SimilarWebAdapter` with all 11 endpoints
- [ ] `YahooFinanceAdapter` with financial statement parsing
- [ ] `SECEdgarAdapter` for 10-K/10-Q (stretch goal)
- [ ] `EnrichmentOrchestrator` with wave-based parallel execution
- [ ] `ResultAggregator` with partial success handling
- [ ] Pydantic schemas for all data types
- [ ] Transformation functions (raw → normalized)
- [ ] Unit tests with mocked API responses
- [ ] Integration tests with real API calls (gated by env var)

### Interface Contract

Your pipeline will be called by the backend (Thread 1) like this:

```python
from pipeline import EnrichmentOrchestrator

orchestrator = EnrichmentOrchestrator(config)

# Single company
result = await orchestrator.enrich(
    domain="costco.com",
    modules=["M01", "M02", "M03", "M04", "M05"],
    force_refresh=False
)

# Result structure
assert result.domain == "costco.com"
assert result.status in ["completed", "partial", "failed"]
assert result.company is not None  # CompanyContext
assert result.technologies is not None  # TechnologyStack
assert result.traffic is not None  # TrafficMetrics
assert result.competitors is not None  # List[Competitor]
assert result.financials is not None  # FinancialProfile
assert result.errors == {} or result.errors == {"M05": "Yahoo Finance timeout"}
assert result.duration_ms < 30000
```

---

*Document Version: 1.0*
*Created: 2026-02-25*
*Author: Thread 2 - Data Pipeline*
*Purpose: Enterprise Architecture Design for PartnerForge ABM Platform*
