# PartnerForge Enterprise Architecture

## Executive Summary

PartnerForge is an enterprise-grade Account-Based Marketing (ABM) intelligence platform that transforms raw company data into actionable sales intelligence. This document defines the modular, extensible architecture that enables **parallel development** across multiple intelligence verticals while maintaining clean boundaries and future-proofing for third-party integrations.

**Design Principles:**
1. **Module Independence** - Each intelligence layer operates autonomously
2. **Parallel Execution** - Wave-based orchestration for maximum throughput
3. **Plugin Architecture** - Third-party modules plug in without core changes
4. **Event-Driven Updates** - Real-time intelligence propagation across modules
5. **SOURCE CITATION MANDATE** - HARD REQUIREMENT (see Part 2A below)

---

## CRITICAL: Source Citation Mandate (Non-Negotiable)

### The #1 Design Principle

**EVERY DATA POINT MUST HAVE AN INLINE SOURCE CITATION.**

This is not optional. This is not a nice-to-have. This is a **HARD REQUIREMENT** that is enforced at every layer of the system.

### Rules

| Rule | Enforcement |
|------|-------------|
| **Every fact has a source** | Database schema REQUIRES source_url (NOT NULL) |
| **Source must be < 12 months old** | Validation layer rejects stale sources |
| **Sources must be hyperlinked** | Frontend renders as clickable links |
| **No source = No data** | Enrichment workers MUST return source_url or fail |

### Source Freshness Validation

```python
# validators/source_freshness.py

from datetime import datetime, timedelta
from typing import Optional

MAX_SOURCE_AGE_DAYS = 365  # 12 months

class SourceFreshnessError(Exception):
    """Raised when source is older than 12 months"""
    pass

def validate_source_freshness(source_date: Optional[datetime]) -> bool:
    """
    HARD VALIDATION: Source must be < 12 months old.
    Returns True if valid, raises SourceFreshnessError if stale.
    """
    if source_date is None:
        raise SourceFreshnessError("Source date is required")

    cutoff = datetime.now() - timedelta(days=MAX_SOURCE_AGE_DAYS)

    if source_date < cutoff:
        raise SourceFreshnessError(
            f"Source date {source_date.isoformat()} is older than 12 months. "
            f"Cutoff: {cutoff.isoformat()}"
        )

    return True


def validate_enrichment_result(result: dict) -> dict:
    """
    Gate that BLOCKS any enrichment result without valid source.
    Called after EVERY module enrichment.
    """
    # HARD REQUIREMENT: source_url must exist
    if not result.get("source_url"):
        raise ValueError(f"Module {result.get('module')} returned no source_url. BLOCKED.")

    # HARD REQUIREMENT: source_date must be < 12 months
    source_date = result.get("source_date")
    if source_date:
        validate_source_freshness(source_date)

    return result
```

### Database Enforcement

```sql
-- EVERY intelligence table has these REQUIRED columns

-- source_url: NOT NULL - cannot insert without source
-- source_date: CHECK constraint for freshness
-- source_type: What kind of source (api, webpage, document)

CREATE TABLE financials (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id),

    -- ... data columns ...

    -- MANDATORY SOURCE FIELDS
    source_url TEXT NOT NULL,  -- CANNOT BE NULL
    source_date DATE NOT NULL CHECK (source_date > CURRENT_DATE - INTERVAL '365 days'),
    source_type VARCHAR(50) NOT NULL,  -- 'yahoo_finance', 'sec_edgar', etc.
    fetched_at TIMESTAMP DEFAULT NOW()
);

-- Same pattern for ALL tables:
-- - executive_quotes: source_url NOT NULL
-- - hiring_signals: source_url NOT NULL
-- - tech_stack: source_url NOT NULL
-- - traffic_metrics: source_url NOT NULL
-- - investor_intelligence: source_url NOT NULL
```

### Worker Enforcement

```python
# Every worker MUST return source_url or the enrichment fails

@celery.task(bind=True)
def enrich_financials(self, domain: str) -> Dict:
    """Worker for M04: Financial Intelligence"""

    result = yahoo_adapter.get_financials(domain)

    # MANDATORY: source_url check
    enrichment_result = {
        "module": "M04",
        "domain": domain,
        "data": result,

        # THESE ARE REQUIRED - Worker fails without them
        "source_url": f"https://finance.yahoo.com/quote/{result['ticker']}",
        "source_date": datetime.now(),
        "source_type": "yahoo_finance",
    }

    # VALIDATION GATE - Will raise exception if invalid
    validate_enrichment_result(enrichment_result)

    return enrichment_result
```

### Frontend Enforcement

```tsx
// Every data point renders with inline citation

function SourceCitation({ url, date, type }: SourceProps) {
  const isFresh = isWithin12Months(date);

  if (!isFresh) {
    return <StaleSourceWarning date={date} />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 hover:underline"
    >
      [{type}: {formatDate(date)}]
    </a>
  );
}

// Example usage in Financial Card
function FinancialMetric({ label, value, source }: Props) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-semibold">{label}:</span>
      <span>{formatCurrency(value)}</span>
      <SourceCitation
        url={source.url}
        date={source.date}
        type={source.type}
      />
    </div>
  );
}

// Renders as:
// Revenue: $3.72B [Yahoo Finance: Feb 2026]
```

### Source Types Reference

| Source Type | Example URL | Max Age |
|-------------|-------------|---------|
| `yahoo_finance` | finance.yahoo.com/quote/SBH | 12 months |
| `sec_edgar` | sec.gov/cgi-bin/browse-edgar | 12 months |
| `earnings_call` | fool.com/earnings/call-transcripts | 12 months |
| `builtwith` | builtwith.com/{domain} | 12 months |
| `similarweb` | similarweb.com/website/{domain} | 12 months |
| `linkedin` | linkedin.com/jobs/view/* | 12 months |
| `careers_page` | {domain}/careers | 12 months |
| `press_release` | businesswire.com/*, prnewswire.com/* | 12 months |
| `industry_report` | baymard.com/*, forrester.com/* | 12 months |

### Stale Data Handling

When a source becomes stale (> 12 months):
1. Data is NOT deleted
2. Data is marked as `stale: true`
3. Frontend shows warning badge
4. Automatic re-enrichment is triggered
5. User sees "Last verified: [date]" with refresh button

---

## Part 1: Intelligence Layer Taxonomy

### 15 Intelligence Modules Across 5 Tiers

Based on the algolia-search-audit skill patterns, we have identified 15 intelligence modules:

```
TIER 5: FUTURE INTEGRATIONS
├── M13: ZoomInfo Contacts
├── M14: Crossbeam Overlaps
├── M15: Demandbase Intent
└── M16: Search Audit (Full Browser Testing)

TIER 4: ENGAGEMENT INTELLIGENCE
├── M11: Account Engagement (CRM Integration)
└── M12: Relationship Mapping (Champions, Org Chart)

TIER 3: BUYING SIGNALS (Critical for Sales)
├── M07: Hiring Signals (Careers Pages + LinkedIn)
├── M08: Executive Quotes (Earnings Calls, 10-K MD&A)
├── M09: Strategic Triggers (News, Events, Leadership)
└── M10: Investor Intelligence (SEC Filings, Guidance)

TIER 2: COMPETITIVE INTELLIGENCE
├── M05: Competitor Analysis (Similar Sites, Tech Overlap)
└── M06: Market Positioning (Industry Rank, Benchmarks)

TIER 1: FOUNDATION DATA (Always First)
├── M01: Company Profile (Domain, HQ, Employee Count)
├── M02: Tech Stack (BuiltWith 7 Endpoints)
├── M03: Traffic Analytics (SimilarWeb 14 Endpoints)
└── M04: Financial Intelligence (Yahoo Finance, SEC)
```

### Module Specifications

| Module ID | Module Name | Data Sources | Update Frequency | Wave |
|-----------|-------------|--------------|------------------|------|
| `M01` | Company Profile | Domain, WebSearch | On-demand | 1 |
| `M02` | Tech Stack | BuiltWith (7 endpoints) | Weekly | 1 |
| `M03` | Traffic Analytics | SimilarWeb (14 endpoints) | Daily | 1 |
| `M04` | Financial Intelligence | Yahoo Finance, SEC | Daily | 1 |
| `M05` | Competitor Analysis | SimilarWeb + BuiltWith | Weekly | 2 |
| `M06` | Market Positioning | SimilarWeb Rank | Weekly | 2 |
| `M07` | Hiring Signals | Careers Pages (Chrome) | Daily | 2 |
| `M08` | Executive Quotes | Earnings Calls, 10-K | Quarterly | 2 |
| `M09` | Strategic Triggers | News, Press, Events | Daily | 2 |
| `M10` | Investor Intelligence | SEC Filings, Transcripts | Quarterly | 2 |

---

## Part 2: Parallel Processing Architecture

### The Orchestrator Question: Human vs. System

**Answer: HYBRID ORCHESTRATION**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATION MODEL                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐          ┌─────────────────────────────────────┐   │
│  │   HUMAN OPERATOR    │          │      SYSTEM ORCHESTRATOR            │   │
│  │   (Strategic)       │          │      (Tactical)                     │   │
│  ├─────────────────────┤          ├─────────────────────────────────────┤   │
│  │ • Select targets    │──trigger─│ • Spawn parallel workers            │   │
│  │ • Choose modules    │          │ • Manage wave dependencies          │   │
│  │ • Set priorities    │          │ • Handle retries/failures           │   │
│  │ • Review outputs    │◄─results─│ • Aggregate results                 │   │
│  │ • Approve actions   │          │ • Update scores                     │   │
│  └─────────────────────┘          │ • Emit events                       │   │
│                                   └─────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Human Controls:**
- Which companies to enrich
- Which modules to run (full vs. partial)
- Priority/urgency levels
- Review and approve final outputs
- Override automated decisions

**System Controls:**
- Spawn parallel workers automatically
- Manage API rate limits
- Handle failures with retries
- Aggregate results from parallel threads
- Calculate scores and status
- Emit completion events

### Wave-Based Parallel Execution

```python
# Enrichment Waves - Based on algolia-search-audit patterns
ENRICHMENT_WAVES = {
    "wave_1_foundation": {
        "parallel": True,  # ALL RUN SIMULTANEOUSLY
        "modules": [
            "M01_company_profile",
            "M02_tech_stack",
            "M03_traffic",
            "M04_financials"
        ],
        "workers": 4,  # One worker per module
        "timeout": 60,
        "retry": 3,
    },
    "wave_2_intelligence": {
        "parallel": True,
        "depends_on": ["wave_1_foundation"],  # Must complete wave 1 first
        "modules": [
            "M05_competitors",
            "M06_market_position",
            "M07_hiring",
            "M08_exec_quotes",
            "M09_triggers",
            "M10_investor_intel"
        ],
        "workers": 6,
        "timeout": 120,
    },
    "wave_3_scoring": {
        "parallel": False,  # Sequential - needs all data
        "depends_on": ["wave_1_foundation", "wave_2_intelligence"],
        "modules": [
            "icp_score_calculation",
            "signal_score_calculation",
            "priority_ranking",
            "status_classification"
        ],
        "timeout": 30,
    },
}
```

### Parallel Worker Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PARALLEL WORKER POOL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Request: enrich("sallybeauty.com", modules=["all"])                       │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      WAVE 1 (Parallel)                               │   │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│   │  │  Worker 1   │ │  Worker 2   │ │  Worker 3   │ │  Worker 4   │    │   │
│   │  │ M01 Profile │ │ M02 Tech    │ │ M03 Traffic │ │ M04 Finance │    │   │
│   │  │  WebSearch  │ │  BuiltWith  │ │ SimilarWeb  │ │ YahooFinance│    │   │
│   │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘    │   │
│   │         │               │               │               │           │   │
│   │         └───────────────┴───────────────┴───────────────┘           │   │
│   │                              │                                       │   │
│   │                        BARRIER (All must complete)                   │   │
│   │                              │                                       │   │
│   └──────────────────────────────┼───────────────────────────────────────┘   │
│                                  ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      WAVE 2 (Parallel)                               │   │
│   │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │   │
│   │  │ Worker 1  │ │ Worker 2  │ │ Worker 3  │ │ Worker 4  │ ...       │   │
│   │  │ Compete   │ │ Hiring    │ │ Quotes    │ │ Triggers  │           │   │
│   │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘           │   │
│   │        └─────────────┴─────────────┴─────────────┘                  │   │
│   │                              │                                       │   │
│   │                        BARRIER                                       │   │
│   │                              │                                       │   │
│   └──────────────────────────────┼───────────────────────────────────────┘   │
│                                  ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      WAVE 3 (Sequential)                             │   │
│   │  ICP Score → Signal Score → Priority → Status → Output              │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation: FastAPI + Celery

```python
# orchestrator/wave_executor.py

from celery import group, chain, chord
from typing import List, Dict
import asyncio

class WaveOrchestrator:
    """
    Executes enrichment waves with parallel workers.
    Human triggers, system orchestrates.
    """

    def __init__(self, redis_url: str):
        self.celery = create_celery_app(redis_url)

    async def enrich_company(
        self,
        domain: str,
        modules: List[str] = None,
        priority: str = "normal"
    ) -> str:
        """
        Entry point for enrichment.
        Returns job_id for tracking.
        """
        job_id = generate_job_id()

        # Build wave groups
        wave_1 = group([
            enrich_profile.s(domain),
            enrich_techstack.s(domain),
            enrich_traffic.s(domain),
            enrich_financials.s(domain),
        ])

        wave_2 = group([
            enrich_competitors.s(domain),
            enrich_hiring.s(domain),
            enrich_quotes.s(domain),
            enrich_triggers.s(domain),
            enrich_investor_intel.s(domain),
        ])

        wave_3 = chain([
            calculate_icp_score.s(domain),
            calculate_signal_score.s(domain),
            aggregate_results.s(domain, job_id),
        ])

        # Execute: Wave 1 parallel → Wave 2 parallel → Wave 3 sequential
        workflow = chain(
            chord(wave_1, wave_1_complete.s(domain)),
            chord(wave_2, wave_2_complete.s(domain)),
            wave_3
        )

        # Non-blocking execution
        workflow.apply_async(task_id=job_id, priority=self._get_priority(priority))

        return job_id

    async def enrich_batch(
        self,
        domains: List[str],
        modules: List[str] = None
    ) -> str:
        """
        Enrich multiple companies in parallel.
        Each company runs its own wave pipeline.
        """
        batch_id = generate_batch_id()

        # Each company is an independent parallel track
        company_workflows = group([
            self._create_company_workflow(domain, modules)
            for domain in domains
        ])

        # All companies run simultaneously
        chord(
            company_workflows,
            batch_complete.s(batch_id, domains)
        ).apply_async(task_id=batch_id)

        return batch_id


# Individual module tasks (Celery workers)
@celery.task(bind=True, max_retries=3, rate_limit='100/m')
def enrich_techstack(self, domain: str) -> Dict:
    """Worker for M02: Tech Stack"""
    try:
        adapter = BuiltWithAdapter()
        result = adapter.domain_lookup(domain)
        return {
            "module": "M02",
            "domain": domain,
            "status": "success",
            "data": result,
            "source_url": f"https://builtwith.com/{domain}"
        }
    except RateLimitError as e:
        self.retry(countdown=60, exc=e)
    except Exception as e:
        return {
            "module": "M02",
            "domain": domain,
            "status": "error",
            "error": str(e)
        }


@celery.task(bind=True, max_retries=3)
def enrich_hiring(self, domain: str) -> Dict:
    """Worker for M07: Hiring Signals - Uses Chrome headless"""
    try:
        # Find careers page
        careers_url = find_careers_page(domain)

        # Chrome headless scraping (parallel-safe)
        browser = ChromeAdapter()
        jobs = browser.scrape_jobs(careers_url)

        # Classify signals
        signals = classify_hiring_signals(jobs)

        return {
            "module": "M07",
            "domain": domain,
            "status": "success",
            "data": {
                "total_openings": len(jobs),
                "search_related": signals["search_related"],
                "hiring_velocity": signals["velocity"],
                "job_postings": jobs[:20],  # Top 20
            },
            "source_url": careers_url
        }
    except CAPTCHAError:
        return {"module": "M07", "status": "captcha_blocked"}
    except Exception as e:
        return {"module": "M07", "status": "error", "error": str(e)}
```

### Batch Enrichment: True Parallel Processing

```python
# Example: Enrich top 100 hot leads in parallel

async def enrich_top_leads():
    """
    This runs 100 companies SIMULTANEOUSLY.
    Each company runs its own 3-wave pipeline.
    Total parallelism: 100 companies × 10 modules = 1000 workers possible
    """

    orchestrator = WaveOrchestrator(redis_url=REDIS_URL)

    # Get top 100 by priority score
    top_leads = db.query("""
        SELECT domain FROM company_intelligence
        WHERE status = 'hot'
        ORDER BY priority_score DESC
        LIMIT 100
    """)

    domains = [lead.domain for lead in top_leads]

    # This spawns 100 parallel company enrichments
    batch_id = await orchestrator.enrich_batch(domains)

    # Human can monitor progress via:
    # GET /api/batch/{batch_id}/progress
    # Returns: {"completed": 45, "total": 100, "failed": 2, "eta": "3m 20s"}

    return batch_id
```

---

## Part 3: Intelligence Data Model

Based on Sally Beauty scratchpad files, here is the complete data model:

### Core Intelligence Tables

```sql
-- ============================================================================
-- M01: COMPANY PROFILE
-- ============================================================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    company_name VARCHAR(500),

    -- Basic Info
    ticker VARCHAR(20),
    is_public BOOLEAN DEFAULT FALSE,
    founded_year INTEGER,
    employee_count INTEGER,

    -- Location
    headquarters_city VARCHAR(255),
    headquarters_state VARCHAR(100),
    headquarters_country VARCHAR(100),

    -- Classification
    industry VARCHAR(255),
    vertical VARCHAR(100),  -- Commerce, Content, Support
    vertical_tier INTEGER,  -- 1, 2, 3

    -- Partner Relationship
    partner_tech VARCHAR(100),  -- Adobe AEM, Shopify, etc.
    is_algolia_customer BOOLEAN DEFAULT FALSE,
    is_displacement_target BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- M04: FINANCIAL INTELLIGENCE (from 08-financial-profile.md)
-- ============================================================================
CREATE TABLE financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),

    -- Stock Info
    ticker VARCHAR(20),
    market_cap BIGINT,
    current_price DECIMAL(12,2),

    -- Revenue Trends (3-year)
    revenue_fy_minus_2 BIGINT,  -- FY2022
    revenue_fy_minus_1 BIGINT,  -- FY2023
    revenue_fy_current BIGINT,  -- FY2024
    revenue_yoy_change DECIMAL(6,2),

    -- E-Commerce Metrics
    ecommerce_revenue BIGINT,
    ecommerce_pct_of_total DECIMAL(5,2),
    ecommerce_yoy_growth DECIMAL(6,2),

    -- Profitability
    net_income BIGINT,
    profit_margin DECIMAL(6,2),
    ebitda BIGINT,
    ebitda_margin DECIMAL(6,2),

    -- Margin Zone (Red/Yellow/Green)
    margin_zone VARCHAR(20),  -- 'red', 'yellow', 'green'

    -- ROI Estimate
    search_addressable_revenue BIGINT,
    roi_conservative BIGINT,  -- 5% lift
    roi_moderate BIGINT,      -- 10% lift
    roi_aggressive BIGINT,    -- 15% lift

    -- Forward Guidance
    guidance_revenue BIGINT,
    guidance_eps_low DECIMAL(6,2),
    guidance_eps_high DECIMAL(6,2),

    -- ============================================================
    -- MANDATORY SOURCE FIELDS (HARD REQUIREMENT)
    -- ============================================================
    source_url TEXT NOT NULL,  -- PRIMARY source URL (hyperlinked)
    source_date DATE NOT NULL CHECK (source_date > CURRENT_DATE - INTERVAL '365 days'),
    source_type VARCHAR(50) NOT NULL,  -- 'yahoo_finance', 'sec_edgar', etc.
    additional_sources JSONB,  -- {"10k": "...", "earnings": "..."}
    is_stale BOOLEAN DEFAULT FALSE,  -- Auto-set when > 12 months

    fetched_at TIMESTAMP DEFAULT NOW(),
    fiscal_year INTEGER,
    fiscal_quarter INTEGER
);

-- ============================================================================
-- M07: HIRING SIGNALS (from 07-hiring-signals.md)
-- ============================================================================
CREATE TABLE hiring_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),

    -- Summary Stats
    total_open_positions INTEGER,
    search_related_count INTEGER,
    engineering_count INTEGER,
    digital_ecommerce_count INTEGER,

    -- Signal Strength
    overall_signal_strength VARCHAR(20),  -- 'strong', 'moderate', 'weak'

    -- Key Roles
    vp_ecommerce_open BOOLEAN DEFAULT FALSE,
    vp_digital_open BOOLEAN DEFAULT FALSE,
    search_engineer_open BOOLEAN DEFAULT FALSE,

    -- AI/ML Investment Signal
    ai_ml_roles_open INTEGER,
    ai_investment_signal BOOLEAN DEFAULT FALSE,

    -- Detailed Postings (JSONB array with individual source_urls)
    tier1_roles JSONB,  -- VP/Director level - each has source_url
    tier2_roles JSONB,  -- Manager/Senior IC - each has source_url
    tier3_roles JSONB,  -- Technical/Developer - each has source_url

    -- Detected Tech Stack from Job Postings
    detected_technologies JSONB,  -- ["Salesforce Commerce Cloud", "Blue Yonder"]

    -- ============================================================
    -- MANDATORY SOURCE FIELDS (HARD REQUIREMENT)
    -- ============================================================
    careers_url TEXT NOT NULL,  -- Primary careers page URL
    source_date DATE NOT NULL CHECK (source_date > CURRENT_DATE - INTERVAL '365 days'),
    source_type VARCHAR(50) NOT NULL DEFAULT 'careers_page',
    individual_job_urls JSONB NOT NULL,  -- {"vp_ecom": "linkedin.com/...", ...}
    is_stale BOOLEAN DEFAULT FALSE,

    fetched_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- M08: EXECUTIVE QUOTES (from 11-investor-intelligence.md)
-- ============================================================================
CREATE TABLE executive_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),

    -- Speaker
    speaker_name VARCHAR(255) NOT NULL,
    speaker_title VARCHAR(255),

    -- Quote
    quote_text TEXT NOT NULL,
    quote_context TEXT,

    -- Classification
    topics JSONB,  -- ["search", "digital", "personalization", "AI"]
    sentiment VARCHAR(20),  -- positive, negative, neutral

    -- Algolia Mapping
    algolia_solution_mapping VARCHAR(255),  -- "NeuralSearch", "Personalization", etc.
    relevance_score INTEGER,  -- 0-100

    -- ============================================================
    -- MANDATORY SOURCE FIELDS (HARD REQUIREMENT)
    -- ============================================================
    source_url TEXT NOT NULL,  -- MUST be hyperlinked (NOT NULL enforced)
    source_date DATE NOT NULL CHECK (source_date > CURRENT_DATE - INTERVAL '365 days'),
    source_type VARCHAR(50) NOT NULL,  -- 'earnings_call', '10k', 'interview', 'press'
    transcript_url TEXT,  -- Full transcript if available
    is_stale BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- M10: INVESTOR INTELLIGENCE
-- ============================================================================
CREATE TABLE investor_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),

    -- SEC Filings
    latest_10k_date DATE,
    latest_10k_url TEXT,
    latest_10q_date DATE,
    latest_10q_url TEXT,

    -- E-Commerce Metrics from Filings
    ecommerce_pct_of_sales DECIMAL(5,2),
    ecommerce_trend VARCHAR(20),  -- 'growing', 'stable', 'declining'

    -- Digital Initiatives from MD&A
    digital_initiatives JSONB,  -- Array of initiative objects

    -- Risk Factors Mentioning Digital/Technology
    tech_risk_factors JSONB,

    -- Forward Guidance
    forward_guidance JSONB,  -- Revenue, EPS, CapEx targets

    -- Digital Investment Commitments
    digital_investment_commitments JSONB,  -- App upgrades, platform updates

    -- Technology Roadmap from Earnings
    tech_roadmap_highlights JSONB,

    -- Algolia Opportunity Mapping
    algolia_opportunity_mapping JSONB,

    fetched_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- BUYING COMMITTEE (from 07-hiring-signals.md)
-- ============================================================================
CREATE TABLE buying_committee (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),

    -- Person Info
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    linkedin_url TEXT,

    -- Buyer Role Classification
    buyer_role VARCHAR(50),  -- 'economic_buyer', 'technical_buyer', 'user_buyer', 'champion'
    priority VARCHAR(20),  -- 'high', 'medium', 'low'

    -- Entry Point
    recommended_entry_angle TEXT,

    -- Contact Status
    last_contacted DATE,
    contact_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ICP & SIGNAL SCORING
-- ============================================================================
CREATE TABLE company_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) UNIQUE,

    -- ICP Score Components (0-100)
    vertical_score INTEGER DEFAULT 0,    -- 40 max
    traffic_score INTEGER DEFAULT 0,     -- 30 max
    tech_spend_score INTEGER DEFAULT 0,  -- 20 max
    partner_score INTEGER DEFAULT 0,     -- 10 max
    icp_score INTEGER GENERATED ALWAYS AS (
        vertical_score + traffic_score + tech_spend_score + partner_score
    ) STORED,

    -- Signal Score Components
    budget_signals JSONB DEFAULT '{}',
    pain_signals JSONB DEFAULT '{}',
    timing_signals JSONB DEFAULT '{}',
    signal_score INTEGER DEFAULT 0,

    -- Priority Score
    priority_score INTEGER GENERATED ALWAYS AS (
        vertical_score + traffic_score + tech_spend_score + partner_score + signal_score
    ) STORED,

    -- Status
    status VARCHAR(20),  -- 'hot', 'warm', 'cool', 'cold'

    -- Active Signals List
    active_signals JSONB DEFAULT '[]',

    calculated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Part 4: Frontend Component Architecture

### Dashboard with Real-Time Enrichment

```tsx
// Dashboard with parallel enrichment progress

function EnrichmentDashboard() {
  // Zustand store for global state
  const { selectedCompanies, filters } = useTargetStore();

  // React Query for data fetching
  const { data: targets, isLoading } = useInfiniteQuery({
    queryKey: ['targets', filters],
    queryFn: fetchTargets,
    staleTime: 5 * 60 * 1000,
  });

  // Enrichment mutation with progress tracking
  const enrichMutation = useMutation({
    mutationFn: (domains: string[]) =>
      api.post('/api/enrich/batch', { domains }),
    onSuccess: (data) => {
      // Subscribe to SSE for progress updates
      subscribeToProgress(data.batch_id);
    }
  });

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1">
        <StatsCards />
        <FilterBar />

        {/* Batch Actions */}
        <BatchActions
          selectedCount={selectedCompanies.size}
          onEnrich={() => {
            // This triggers PARALLEL enrichment
            enrichMutation.mutate(Array.from(selectedCompanies));
          }}
        />

        {/* Parallel Enrichment Progress */}
        {enrichMutation.isPending && (
          <EnrichmentProgressPanel batchId={enrichMutation.data?.batch_id} />
        )}

        {/* Virtual Scroll Table */}
        <TargetsTable data={targets} />
      </main>
    </div>
  );
}

// Real-time progress for parallel enrichment
function EnrichmentProgressPanel({ batchId }: { batchId: string }) {
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  useEffect(() => {
    // SSE connection for real-time updates
    const eventSource = new EventSource(`/api/batch/${batchId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    };

    return () => eventSource.close();
  }, [batchId]);

  if (!progress) return <Spinner />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enriching {progress.total} Companies</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={(progress.completed / progress.total) * 100} />
        <div className="grid grid-cols-4 gap-4 mt-4">
          <MetricCard label="Completed" value={progress.completed} />
          <MetricCard label="In Progress" value={progress.in_progress} />
          <MetricCard label="Failed" value={progress.failed} />
          <MetricCard label="ETA" value={progress.eta} />
        </div>

        {/* Per-Module Progress */}
        <div className="mt-4 space-y-2">
          {progress.modules.map(module => (
            <ModuleProgress key={module.id} module={module} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Company Intelligence View

```tsx
// Company detail page with all intelligence modules

function CompanyIntelligencePage({ domain }: { domain: string }) {
  // Parallel queries for all modules
  const queries = useQueries({
    queries: [
      { queryKey: ['profile', domain], queryFn: () => fetchProfile(domain) },
      { queryKey: ['techstack', domain], queryFn: () => fetchTechStack(domain) },
      { queryKey: ['traffic', domain], queryFn: () => fetchTraffic(domain) },
      { queryKey: ['financials', domain], queryFn: () => fetchFinancials(domain) },
      { queryKey: ['hiring', domain], queryFn: () => fetchHiring(domain) },
      { queryKey: ['quotes', domain], queryFn: () => fetchQuotes(domain) },
      { queryKey: ['triggers', domain], queryFn: () => fetchTriggers(domain) },
    ],
  });

  return (
    <div className="space-y-6">
      {/* Header with Score */}
      <CompanyHeader
        profile={queries[0].data}
        score={queries[0].data?.priority_score}
      />

      {/* Enrichment Status Bar */}
      <EnrichmentStatusBar domain={domain} />

      {/* Intelligence Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">
            Financials
            <FreshnessIndicator status={queries[3].data?.status} />
          </TabsTrigger>
          <TabsTrigger value="hiring">Hiring Signals</TabsTrigger>
          <TabsTrigger value="quotes">In Their Words</TabsTrigger>
          <TabsTrigger value="triggers">Strategic Triggers</TabsTrigger>
          <TabsTrigger value="committee">Buying Committee</TabsTrigger>
        </TabsList>

        <TabsContent value="financials">
          <FinancialsTab data={queries[3].data} />
        </TabsContent>

        <TabsContent value="hiring">
          <HiringSignalsTab data={queries[4].data} />
        </TabsContent>

        <TabsContent value="quotes">
          {/* "In Their Own Words" section from audit skill */}
          <ExecutiveQuotesTab data={queries[5].data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Part 5: API Design

### Parallel Enrichment Endpoints

```yaml
openapi: 3.0.3
info:
  title: PartnerForge API
  version: 2.0.0

paths:
  /api/enrich/{domain}:
    post:
      summary: Enrich single company (all modules in parallel)
      parameters:
        - name: domain
          in: path
          required: true
        - name: modules
          in: query
          description: Specific modules (default: all)
          schema:
            type: array
            items:
              enum: [profile, techstack, traffic, financials, hiring, quotes, triggers]
        - name: force
          in: query
          description: Force refresh even if fresh
          schema:
            type: boolean
      responses:
        '202':
          description: Enrichment job accepted
          content:
            application/json:
              schema:
                type: object
                properties:
                  job_id:
                    type: string
                  status:
                    type: string
                    enum: [accepted, queued, running]

  /api/enrich/batch:
    post:
      summary: Enrich multiple companies in parallel
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                domains:
                  type: array
                  items:
                    type: string
                  maxItems: 100
                modules:
                  type: array
                  items:
                    type: string
      responses:
        '202':
          description: Batch enrichment accepted
          content:
            application/json:
              schema:
                type: object
                properties:
                  batch_id:
                    type: string
                  total:
                    type: integer
                  estimated_completion:
                    type: string
                    format: date-time

  /api/batch/{batch_id}/progress:
    get:
      summary: Get batch enrichment progress
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  batch_id:
                    type: string
                  total:
                    type: integer
                  completed:
                    type: integer
                  in_progress:
                    type: integer
                  failed:
                    type: integer
                  eta:
                    type: string
                  modules:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        completed:
                          type: integer
                        total:
                          type: integer

  /api/batch/{batch_id}/stream:
    get:
      summary: SSE stream for real-time progress updates
      responses:
        '200':
          description: Server-Sent Events stream
          content:
            text/event-stream:
              schema:
                type: string
```

---

## Part 6: Plugin Architecture for Future Modules

```python
# plugins/base.py

from abc import ABC, abstractmethod
from typing import Dict, Any, List

class IntelligencePlugin(ABC):
    """
    Base class for all intelligence modules.
    ZoomInfo, Crossbeam, Demandbase extend this.
    """

    @property
    @abstractmethod
    def module_id(self) -> str:
        """Unique module identifier (e.g., 'M13')"""
        pass

    @property
    @abstractmethod
    def module_name(self) -> str:
        """Human-readable name"""
        pass

    @property
    @abstractmethod
    def wave(self) -> int:
        """Which enrichment wave (1, 2, or 3)"""
        pass

    @property
    @abstractmethod
    def dependencies(self) -> List[str]:
        """Module IDs this depends on"""
        pass

    @abstractmethod
    async def enrich(self, domain: str) -> Dict[str, Any]:
        """
        Main enrichment method.
        Returns structured data with source_urls.
        """
        pass

    @abstractmethod
    def extract_signals(self, data: Dict) -> List[Dict]:
        """Extract signals for scoring"""
        pass

    async def health_check(self) -> bool:
        """Verify API connectivity"""
        return True


# Example: ZoomInfo Plugin
class ZoomInfoPlugin(IntelligencePlugin):
    module_id = "M13"
    module_name = "ZoomInfo Contacts"
    wave = 2
    dependencies = ["M01"]  # Needs company profile first

    def __init__(self, api_key: str):
        self.client = ZoomInfoClient(api_key)

    async def enrich(self, domain: str) -> Dict[str, Any]:
        contacts = await self.client.search_contacts(
            domain=domain,
            titles=["CTO", "VP Digital", "VP E-Commerce", "Head of Search"],
            limit=50
        )

        return {
            "module": self.module_id,
            "domain": domain,
            "status": "success",
            "data": {
                "contacts": [
                    {
                        "name": c.full_name,
                        "title": c.title,
                        "email": c.email,
                        "linkedin": c.linkedin_url,
                        "buyer_role": self._classify_buyer_role(c.title),
                    }
                    for c in contacts
                ],
                "total_available": contacts.total,
            },
            "source_url": "https://www.zoominfo.com"
        }

    def extract_signals(self, data: Dict) -> List[Dict]:
        signals = []

        # Signal: Has search-related persona
        search_contacts = [
            c for c in data["data"]["contacts"]
            if "search" in c["title"].lower()
        ]
        if search_contacts:
            signals.append({
                "type": "has_search_persona",
                "weight": 15,
                "category": "timing",
                "evidence": f"{len(search_contacts)} search-related contacts"
            })

        return signals


# Plugin Registry
class PluginRegistry:
    _plugins: Dict[str, IntelligencePlugin] = {}

    @classmethod
    def register(cls, plugin: IntelligencePlugin):
        cls._plugins[plugin.module_id] = plugin

    @classmethod
    def get_wave_modules(cls, wave: int) -> List[IntelligencePlugin]:
        return [p for p in cls._plugins.values() if p.wave == wave]

    @classmethod
    def get(cls, module_id: str) -> IntelligencePlugin:
        return cls._plugins.get(module_id)


# Register plugins at startup
PluginRegistry.register(ZoomInfoPlugin(config.ZOOMINFO_API_KEY))
PluginRegistry.register(CrossbeamPlugin(config.CROSSBEAM_API_KEY))
PluginRegistry.register(DemandbasePlugin(config.DEMANDBASE_API_KEY))
```

---

## Part 7: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] PostgreSQL setup with all tables
- [ ] FastAPI project structure
- [ ] Celery + Redis for parallel workers
- [ ] React + Vite + TypeScript scaffold
- [ ] Basic dashboard UI

### Phase 2: Foundation Modules (Weeks 3-4)
- [ ] M01-M04 parallel implementation
- [ ] Wave 1 orchestration
- [ ] Company intelligence view
- [ ] Virtual scroll table

### Phase 3: Intelligence Modules (Weeks 5-6)
- [ ] M05-M10 parallel implementation
- [ ] Wave 2 orchestration
- [ ] Executive quotes view
- [ ] Hiring signals view

### Phase 4: Scoring & Signals (Week 7)
- [ ] ICP scoring engine
- [ ] Signal detection
- [ ] Priority calculation
- [ ] Status classification

### Phase 5: Polish & Deploy (Week 8)
- [ ] Plugin architecture
- [ ] Batch enrichment UI
- [ ] Real-time progress
- [ ] Production deployment

---

## Summary

### Key Architecture Decisions

1. **Parallel Processing**: Every enrichment runs as parallel Celery workers
2. **Wave Dependencies**: Foundation → Intelligence → Scoring (barriers between)
3. **Human + System Orchestration**: Human triggers, system executes
4. **Plugin Architecture**: Future modules plug in without core changes
5. **Real-Time Progress**: SSE for batch enrichment monitoring
6. **Source Citations**: Every data point must have source_url

### Performance Targets

| Metric | Target |
|--------|--------|
| Single company enrichment | < 2 minutes |
| Batch (100 companies) | < 10 minutes |
| API latency (p95) | < 200ms |
| Parallel workers | 20+ |

---

*Document Version: 1.0.0*
*Last Updated: 2026-02-25*
*Author: Thread 3 - Frontend/UX Architecture*
