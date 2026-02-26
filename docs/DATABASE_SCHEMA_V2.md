# PartnerForge Database Schema v2.0

**Version:** 2.0
**Date:** 2026-02-25
**Author:** Thread 1 - Backend Architecture
**Database:** PostgreSQL 15+ with SQLAlchemy ORM

---

## Migration Strategy: SQLite → PostgreSQL

### Current State (SQLite)
```
data/partnerforge.db
├── displacement_targets (2,687 records)
├── companies (400 records)
├── competitive_intel (25 records)
├── case_studies (161 records)
├── company_financials
└── enrichment_status
```

### Target State (PostgreSQL)
```
partnerforge_db
├── core (5 tables)
├── intel (15 tables)
├── jobs (3 tables)
├── users (4 tables)
└── audit (3 tables)
```

### Migration Plan
1. Create PostgreSQL schema with Alembic
2. Extract SQLite data to JSON
3. Transform data to new schema
4. Load into PostgreSQL with validation
5. Verify row counts and data integrity
6. Switch application to PostgreSQL
7. Archive SQLite as backup

---

## Schema Namespaces

### 1. CORE Namespace

#### core_companies
Primary company registry.

```sql
CREATE TABLE core_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    company_name VARCHAR(500),
    ticker VARCHAR(20),
    exchange VARCHAR(20),
    is_public BOOLEAN DEFAULT FALSE,
    headquarters_city VARCHAR(100),
    headquarters_state VARCHAR(100),
    headquarters_country VARCHAR(100),
    industry VARCHAR(200),
    vertical VARCHAR(100),
    sub_vertical VARCHAR(100),
    business_model VARCHAR(50),
    employee_count INTEGER,
    store_count INTEGER,
    fiscal_year_end VARCHAR(20),
    founded_year INTEGER,
    description TEXT,
    website_url VARCHAR(500),
    investor_relations_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_domain CHECK (domain ~ '^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$')
);

CREATE INDEX idx_companies_domain ON core_companies(domain);
CREATE INDEX idx_companies_ticker ON core_companies(ticker);
CREATE INDEX idx_companies_vertical ON core_companies(vertical);
CREATE INDEX idx_companies_is_public ON core_companies(is_public);
```

#### core_domains
Domain aliasing and redirect tracking.

```sql
CREATE TABLE core_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    primary_domain VARCHAR(255) NOT NULL,
    domain_type VARCHAR(50) DEFAULT 'alias',  -- alias, redirect, subdomain
    company_id UUID REFERENCES core_companies(id),
    discovered_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_domain_type CHECK (domain_type IN ('alias', 'redirect', 'subdomain', 'regional'))
);

CREATE INDEX idx_domains_primary ON core_domains(primary_domain);
CREATE INDEX idx_domains_company ON core_domains(company_id);
```

#### core_enrichment_jobs
Enrichment job tracking.

```sql
CREATE TABLE core_enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) NOT NULL,  -- full, partial, single_module
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    modules_requested JSONB DEFAULT '[]',
    modules_completed JSONB DEFAULT '[]',
    modules_failed JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_job_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_jobs_domain ON core_enrichment_jobs(domain);
CREATE INDEX idx_jobs_status ON core_enrichment_jobs(status);
CREATE INDEX idx_jobs_created_at ON core_enrichment_jobs(created_at DESC);
```

#### core_api_cache
API response caching.

```sql
CREATE TABLE core_api_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(500) NOT NULL UNIQUE,
    api_source VARCHAR(50) NOT NULL,
    domain VARCHAR(255),
    endpoint VARCHAR(200),
    response_data JSONB NOT NULL,
    http_status INTEGER,
    response_size INTEGER,
    ttl_seconds INTEGER DEFAULT 604800,  -- 7 days
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,

    CONSTRAINT valid_api_source CHECK (api_source IN ('builtwith', 'similarweb', 'yahoo_finance', 'sec_edgar', 'websearch'))
);

CREATE INDEX idx_cache_key ON core_api_cache(cache_key);
CREATE INDEX idx_cache_domain ON core_api_cache(domain);
CREATE INDEX idx_cache_expires ON core_api_cache(expires_at);
CREATE INDEX idx_cache_source ON core_api_cache(api_source);
```

#### core_brands
Brand registry for multi-brand companies.

```sql
CREATE TABLE core_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES core_companies(id),
    brand_name VARCHAR(200) NOT NULL,
    brand_domain VARCHAR(255),
    brand_type VARCHAR(50),  -- consumer, professional, sub-brand
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, brand_name)
);

CREATE INDEX idx_brands_company ON core_brands(company_id);
```

---

### 2. INTEL Namespace

#### intel_technology_stack
Technology detection results.

```sql
CREATE TABLE intel_technology_stack (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    technology_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    tag VARCHAR(50),
    is_partner_tech BOOLEAN DEFAULT FALSE,
    partner_tier VARCHAR(20),
    is_competitor_search BOOLEAN DEFAULT FALSE,
    competitor_name VARCHAR(100),
    first_detected DATE,
    last_detected DATE,
    confidence DECIMAL(3,2),
    source VARCHAR(50),
    source_url VARCHAR(500),
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(domain, technology_name)
);

CREATE INDEX idx_techstack_domain ON intel_technology_stack(domain);
CREATE INDEX idx_techstack_category ON intel_technology_stack(category);
CREATE INDEX idx_techstack_partner ON intel_technology_stack(is_partner_tech);
CREATE INDEX idx_techstack_competitor ON intel_technology_stack(is_competitor_search);
```

#### intel_search_provider
Current search provider summary (denormalized for fast queries).

```sql
CREATE TABLE intel_search_provider (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    current_provider VARCHAR(100),
    provider_type VARCHAR(50),  -- native, third_party, custom, unknown
    is_algolia BOOLEAN DEFAULT FALSE,
    displacement_priority VARCHAR(20),
    tech_spend_estimate INTEGER,
    tech_spend_source VARCHAR(100),
    source_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_displacement_priority CHECK (displacement_priority IN ('HIGH', 'MEDIUM', 'LOW', 'NONE'))
);

CREATE INDEX idx_searchprovider_domain ON intel_search_provider(domain);
CREATE INDEX idx_searchprovider_provider ON intel_search_provider(current_provider);
CREATE INDEX idx_searchprovider_priority ON intel_search_provider(displacement_priority);
```

#### intel_traffic_analysis
SimilarWeb traffic data.

```sql
CREATE TABLE intel_traffic_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    monthly_visits BIGINT,
    avg_visit_duration_seconds INTEGER,
    pages_per_visit DECIMAL(4,2),
    bounce_rate DECIMAL(4,3),
    mobile_share DECIMAL(4,3),
    mom_change DECIMAL(5,4),
    yoy_change DECIMAL(5,4),
    trend_direction VARCHAR(20),
    traffic_sources JSONB,
    geography JSONB,
    demographics JSONB,
    keywords JSONB,
    website_rank_global INTEGER,
    website_rank_country INTEGER,
    website_rank_category INTEGER,
    data_month VARCHAR(7),  -- YYYY-MM
    source_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_trend_direction CHECK (trend_direction IN ('growing', 'stable', 'declining', 'unknown'))
);

CREATE INDEX idx_traffic_domain ON intel_traffic_analysis(domain);
CREATE INDEX idx_traffic_visits ON intel_traffic_analysis(monthly_visits DESC);
CREATE INDEX idx_traffic_trend ON intel_traffic_analysis(trend_direction);
```

#### intel_financial_profile
Financial data from Yahoo Finance and SEC.

```sql
CREATE TABLE intel_financial_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    ticker VARCHAR(20),
    fiscal_year_end VARCHAR(20),
    latest_revenue BIGINT,
    revenue_trend VARCHAR(20),
    revenue_3yr JSONB,  -- Array of {fiscal_year, revenue, yoy_change}
    net_income_3yr JSONB,
    ebitda_margin DECIMAL(5,4),
    operating_margin DECIMAL(5,4),
    margin_zone VARCHAR(10),  -- RED, YELLOW, GREEN
    ecommerce_revenue BIGINT,
    ecommerce_share DECIMAL(5,4),
    ecommerce_growth_yoy DECIMAL(5,4),
    addressable_search_revenue BIGINT,
    stock_current_price DECIMAL(10,2),
    stock_market_cap BIGINT,
    stock_52_week_high DECIMAL(10,2),
    stock_52_week_low DECIMAL(10,2),
    analyst_consensus VARCHAR(20),
    roi_scenarios JSONB,
    source_urls JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_margin_zone CHECK (margin_zone IN ('RED', 'YELLOW', 'GREEN'))
);

CREATE INDEX idx_financial_domain ON intel_financial_profile(domain);
CREATE INDEX idx_financial_ticker ON intel_financial_profile(ticker);
CREATE INDEX idx_financial_margin_zone ON intel_financial_profile(margin_zone);
CREATE INDEX idx_financial_revenue ON intel_financial_profile(latest_revenue DESC);
```

#### intel_competitor_intelligence
Competitor analysis.

```sql
CREATE TABLE intel_competitor_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    competitor_domain VARCHAR(255) NOT NULL,
    similarity_score DECIMAL(4,3),
    competitor_monthly_visits BIGINT,
    competitor_search_provider VARCHAR(100),
    competitor_uses_algolia BOOLEAN DEFAULT FALSE,
    tech_overlap JSONB,
    competitive_angle TEXT,
    source VARCHAR(50),
    source_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(domain, competitor_domain)
);

CREATE INDEX idx_competitor_domain ON intel_competitor_intelligence(domain);
CREATE INDEX idx_competitor_competitor ON intel_competitor_intelligence(competitor_domain);
CREATE INDEX idx_competitor_algolia ON intel_competitor_intelligence(competitor_uses_algolia);
```

#### intel_competitor_landscape
Aggregated competitor landscape summary.

```sql
CREATE TABLE intel_competitor_landscape (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    total_competitors_analyzed INTEGER,
    algolia_users INTEGER DEFAULT 0,
    constructor_users INTEGER DEFAULT 0,
    elasticsearch_users INTEGER DEFAULT 0,
    native_search_users INTEGER DEFAULT 0,
    other_search_users INTEGER DEFAULT 0,
    first_mover_opportunity BOOLEAN DEFAULT FALSE,
    competitive_positioning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_landscape_domain ON intel_competitor_landscape(domain);
CREATE INDEX idx_landscape_first_mover ON intel_competitor_landscape(first_mover_opportunity);
```

#### intel_hiring_signals
Hiring data and signals.

```sql
CREATE TABLE intel_hiring_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    role_title VARCHAR(200) NOT NULL,
    status VARCHAR(50),
    location VARCHAR(200),
    signal_tier INTEGER,  -- 1=Strong, 2=Moderate, 3=Technical
    signal_strength VARCHAR(20),
    category VARCHAR(50),  -- ecommerce, engineering, data, ai_ml, product, merchandising
    salary_min INTEGER,
    salary_max INTEGER,
    implication TEXT,
    source_url VARCHAR(500),
    posted_date DATE,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(domain, role_title, source_url)
);

CREATE INDEX idx_hiring_domain ON intel_hiring_signals(domain);
CREATE INDEX idx_hiring_tier ON intel_hiring_signals(signal_tier);
CREATE INDEX idx_hiring_category ON intel_hiring_signals(category);
CREATE INDEX idx_hiring_posted ON intel_hiring_signals(posted_date DESC);
```

#### intel_hiring_summary
Aggregated hiring intelligence.

```sql
CREATE TABLE intel_hiring_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    total_open_roles INTEGER,
    tier_1_count INTEGER DEFAULT 0,
    tier_2_count INTEGER DEFAULT 0,
    tier_3_count INTEGER DEFAULT 0,
    ecommerce_roles INTEGER DEFAULT 0,
    engineering_roles INTEGER DEFAULT 0,
    data_analytics_roles INTEGER DEFAULT 0,
    ai_ml_roles INTEGER DEFAULT 0,
    product_roles INTEGER DEFAULT 0,
    merchandising_roles INTEGER DEFAULT 0,
    ai_investment_signal BOOLEAN DEFAULT FALSE,
    leadership_vacancies JSONB,
    platform_confirmed VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hiringsummary_domain ON intel_hiring_summary(domain);
CREATE INDEX idx_hiringsummary_ai_signal ON intel_hiring_summary(ai_investment_signal);
```

#### intel_strategic_context
Strategic initiatives and trigger events.

```sql
CREATE TABLE intel_strategic_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    strategic_initiatives JSONB,
    trigger_events JSONB,
    caution_signals JSONB,
    timing_assessment JSONB,
    overall_timing VARCHAR(20),  -- EXCELLENT, GOOD, MODERATE, POOR
    decision_window VARCHAR(50),
    urgency_level VARCHAR(20),
    source_urls JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_timing CHECK (overall_timing IN ('EXCELLENT', 'GOOD', 'MODERATE', 'POOR'))
);

CREATE INDEX idx_strategic_domain ON intel_strategic_context(domain);
CREATE INDEX idx_strategic_timing ON intel_strategic_context(overall_timing);
CREATE INDEX idx_strategic_urgency ON intel_strategic_context(urgency_level);
```

#### intel_investor_intelligence
SEC filings and earnings call data.

```sql
CREATE TABLE intel_investor_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    ticker VARCHAR(20),
    sec_filings JSONB,
    earnings_calls JSONB,
    guidance JSONB,
    digital_commitments JSONB,
    key_quotes JSONB,
    source_bibliography JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investor_domain ON intel_investor_intelligence(domain);
CREATE INDEX idx_investor_ticker ON intel_investor_intelligence(ticker);
```

#### intel_executive_quotes
Individual executive quotes for "In Their Own Words".

```sql
CREATE TABLE intel_executive_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    speaker_name VARCHAR(200) NOT NULL,
    speaker_title VARCHAR(200),
    quote TEXT NOT NULL,
    quote_context VARCHAR(200),  -- Q1 2026 Earnings, Interview, 10-K
    maps_to_product VARCHAR(200),
    priority VARCHAR(20),
    source_url VARCHAR(500),
    source_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(domain, quote)
);

CREATE INDEX idx_quotes_domain ON intel_executive_quotes(domain);
CREATE INDEX idx_quotes_speaker ON intel_executive_quotes(speaker_name);
CREATE INDEX idx_quotes_priority ON intel_executive_quotes(priority);
```

#### intel_executive_intelligence
Executive profiles and speaking language mapping.

```sql
CREATE TABLE intel_executive_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    name VARCHAR(200) NOT NULL,
    title VARCHAR(200),
    linkedin_url VARCHAR(500),
    tenure_start DATE,
    background TEXT,
    buyer_role VARCHAR(50),
    priority VARCHAR(20),
    is_new_to_role BOOLEAN DEFAULT FALSE,
    is_active_on_linkedin BOOLEAN DEFAULT FALSE,
    speaks_at_events JSONB,
    speaking_language JSONB,
    entry_approach TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(domain, name)
);

CREATE INDEX idx_executive_domain ON intel_executive_intelligence(domain);
CREATE INDEX idx_executive_buyer_role ON intel_executive_intelligence(buyer_role);
CREATE INDEX idx_executive_priority ON intel_executive_intelligence(priority);
```

#### intel_buying_committee
Aggregated buying committee structure.

```sql
CREATE TABLE intel_buying_committee (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    executive_sponsor JSONB,
    economic_buyer JSONB,
    technical_buyer JSONB,
    champion JSONB,
    user_buyers JSONB,
    technical_evaluators JSONB,
    committee_dynamics JSONB,
    engagement_sequence JSONB,
    total_decision_makers INTEGER,
    primary_blockers JSONB,
    recent_departures JSONB,
    turnover_insight TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buyingcommittee_domain ON intel_buying_committee(domain);
```

#### intel_displacement_analysis
Displacement opportunity analysis.

```sql
CREATE TABLE intel_displacement_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    current_search_provider VARCHAR(100),
    provider_type VARCHAR(50),
    displacement_difficulty VARCHAR(20),
    displacement_reasoning TEXT,
    partner_co_sell_opportunities JSONB,
    competitive_displacement JSONB,
    algolia_fit_score JSONB,
    recommended_products JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_displacement_difficulty CHECK (displacement_difficulty IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX idx_displacement_domain ON intel_displacement_analysis(domain);
CREATE INDEX idx_displacement_provider ON intel_displacement_analysis(current_search_provider);
CREATE INDEX idx_displacement_difficulty ON intel_displacement_analysis(displacement_difficulty);
```

#### intel_case_study_matches
Matched case studies for social proof.

```sql
CREATE TABLE intel_case_study_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    case_study_customer VARCHAR(200) NOT NULL,
    case_study_vertical VARCHAR(100),
    relevance_score DECIMAL(4,3),
    results_headline TEXT,
    results_details JSONB,
    relevance_reasoning TEXT,
    case_study_url VARCHAR(500),
    use_in_pitch TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(domain, case_study_customer)
);

CREATE INDEX idx_casestudy_domain ON intel_case_study_matches(domain);
CREATE INDEX idx_casestudy_relevance ON intel_case_study_matches(relevance_score DESC);
```

#### intel_icp_priority_mapping
ICP classification and lead scoring.

```sql
CREATE TABLE intel_icp_priority_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    icp_tier INTEGER,
    icp_tier_name VARCHAR(50),
    icp_tier_description VARCHAR(200),
    icp_confidence DECIMAL(4,3),
    lead_score_total INTEGER,
    lead_score_breakdown JSONB,
    signal_score_total INTEGER,
    signal_score_active JSONB,
    signal_types JSONB,
    priority_score INTEGER,
    priority_status VARCHAR(20),  -- HOT, WARM, COOL, COLD
    priority_reasoning TEXT,
    algolia_product_mapping JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_priority_status CHECK (priority_status IN ('HOT', 'WARM', 'COOL', 'COLD'))
);

CREATE INDEX idx_icpmapping_domain ON intel_icp_priority_mapping(domain);
CREATE INDEX idx_icpmapping_tier ON intel_icp_priority_mapping(icp_tier);
CREATE INDEX idx_icpmapping_status ON intel_icp_priority_mapping(priority_status);
CREATE INDEX idx_icpmapping_score ON intel_icp_priority_mapping(priority_score DESC);
CREATE INDEX idx_icpmapping_lead_score ON intel_icp_priority_mapping(lead_score_total DESC);
```

#### intel_signal_scoring
Detailed signal scoring breakdown.

```sql
CREATE TABLE intel_signal_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    budget_signals JSONB,
    budget_total INTEGER,
    has_budget_signal BOOLEAN DEFAULT FALSE,
    pain_signals JSONB,
    pain_total INTEGER,
    has_pain_signal BOOLEAN DEFAULT FALSE,
    timing_signals JSONB,
    timing_total INTEGER,
    has_timing_signal BOOLEAN DEFAULT FALSE,
    negative_signals JSONB,
    negative_total INTEGER,
    raw_signal_score INTEGER,
    adjusted_signal_score INTEGER,
    signal_quality JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signalscoring_domain ON intel_signal_scoring(domain);
CREATE INDEX idx_signalscoring_adjusted ON intel_signal_scoring(adjusted_signal_score DESC);
```

#### intel_strategic_signal_briefs
Final output: Strategic Signal Brief.

```sql
CREATE TABLE intel_strategic_signal_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    sixty_second_story TEXT,
    timing_signals JSONB,
    in_their_own_words JSONB,
    people JSONB,
    money JSONB,
    gaps JSONB,
    competitive_landscape JSONB,
    hiring_intelligence JSONB,
    icp_mapping JSONB,
    the_angle TEXT,
    sources_bibliography JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1,

    -- Full brief as JSON for API delivery
    full_brief JSONB
);

CREATE INDEX idx_brief_domain ON intel_strategic_signal_briefs(domain);
CREATE INDEX idx_brief_generated ON intel_strategic_signal_briefs(generated_at DESC);
```

---

### 3. JOBS Namespace

#### jobs_enrichment_queue
Redis-backed job queue persistence.

```sql
CREATE TABLE jobs_enrichment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'queued',
    modules JSONB,
    redis_job_id VARCHAR(100),
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    CONSTRAINT valid_queue_status CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_queue_status ON jobs_enrichment_queue(status);
CREATE INDEX idx_queue_priority ON jobs_enrichment_queue(priority DESC);
CREATE INDEX idx_queue_queued_at ON jobs_enrichment_queue(queued_at);
```

#### jobs_enrichment_history
Historical job records.

```sql
CREATE TABLE jobs_enrichment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20),
    modules_requested JSONB,
    modules_completed JSONB,
    modules_failed JSONB,
    duration_seconds INTEGER,
    api_calls_made INTEGER,
    api_cost_estimate DECIMAL(10,4),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_log TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_history_domain ON jobs_enrichment_history(domain);
CREATE INDEX idx_history_status ON jobs_enrichment_history(status);
CREATE INDEX idx_history_created_at ON jobs_enrichment_history(created_at DESC);
```

#### jobs_scheduled_tasks
Scheduled enrichment tasks.

```sql
CREATE TABLE jobs_scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,  -- refresh, batch, cleanup
    schedule_cron VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    task_config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_active ON jobs_scheduled_tasks(is_active);
CREATE INDEX idx_scheduled_next_run ON jobs_scheduled_tasks(next_run_at);
```

---

### 4. USERS Namespace

#### users_accounts
User accounts for API access.

```sql
CREATE TABLE users_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(200),
    organization VARCHAR(200),
    role VARCHAR(50) DEFAULT 'user',  -- admin, user, readonly
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    CONSTRAINT valid_role CHECK (role IN ('admin', 'user', 'readonly'))
);

CREATE INDEX idx_accounts_email ON users_accounts(email);
CREATE INDEX idx_accounts_org ON users_accounts(organization);
```

#### users_api_keys
API key management.

```sql
CREATE TABLE users_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_accounts(id),
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,
    name VARCHAR(100),
    permissions JSONB DEFAULT '["read"]',
    rate_limit_rpm INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,

    UNIQUE(key_hash)
);

CREATE INDEX idx_apikeys_user ON users_api_keys(user_id);
CREATE INDEX idx_apikeys_hash ON users_api_keys(key_hash);
CREATE INDEX idx_apikeys_active ON users_api_keys(is_active);
```

#### users_rate_limits
Rate limit tracking (Redis-backed, PostgreSQL fallback).

```sql
CREATE TABLE users_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES users_api_keys(id),
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER DEFAULT 0,

    UNIQUE(api_key_id, window_start)
);

CREATE INDEX idx_ratelimits_key ON users_rate_limits(api_key_id);
CREATE INDEX idx_ratelimits_window ON users_rate_limits(window_start);
```

#### users_preferences
User preferences and settings.

```sql
CREATE TABLE users_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_accounts(id) UNIQUE,
    default_view VARCHAR(50) DEFAULT 'dashboard',
    notification_email BOOLEAN DEFAULT TRUE,
    notification_slack BOOLEAN DEFAULT FALSE,
    slack_webhook_url VARCHAR(500),
    dashboard_filters JSONB,
    export_format VARCHAR(20) DEFAULT 'csv',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_preferences_user ON users_preferences(user_id);
```

---

### 5. AUDIT Namespace

#### audit_api_calls
API call logging for billing and debugging.

```sql
CREATE TABLE audit_api_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_api VARCHAR(50) NOT NULL,
    endpoint VARCHAR(200),
    domain VARCHAR(255),
    http_method VARCHAR(10),
    http_status INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    latency_ms INTEGER,
    error_message TEXT,
    cost_estimate DECIMAL(8,4),
    called_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apicalls_api ON audit_api_calls(external_api);
CREATE INDEX idx_apicalls_domain ON audit_api_calls(domain);
CREATE INDEX idx_apicalls_called_at ON audit_api_calls(called_at DESC);

-- Partitioning by month for performance
-- CREATE TABLE audit_api_calls_2026_02 PARTITION OF audit_api_calls
--     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

#### audit_data_changes
Data change tracking for compliance.

```sql
CREATE TABLE audit_data_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    domain VARCHAR(255),
    operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_datachanges_table ON audit_data_changes(table_name);
CREATE INDEX idx_datachanges_domain ON audit_data_changes(domain);
CREATE INDEX idx_datachanges_changed_at ON audit_data_changes(changed_at DESC);
```

#### audit_user_actions
User action logging.

```sql
CREATE TABLE audit_user_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users_accounts(id),
    api_key_id UUID REFERENCES users_api_keys(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    domain VARCHAR(255),
    request_path VARCHAR(500),
    request_method VARCHAR(10),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    action_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_useractions_user ON audit_user_actions(user_id);
CREATE INDEX idx_useractions_action ON audit_user_actions(action);
CREATE INDEX idx_useractions_action_at ON audit_user_actions(action_at DESC);
```

---

## Views

### v_hot_leads
Quick access to hot leads.

```sql
CREATE VIEW v_hot_leads AS
SELECT
    c.domain,
    c.company_name,
    c.vertical,
    c.ticker,
    icp.icp_tier,
    icp.lead_score_total,
    icp.priority_status,
    icp.priority_score,
    sp.current_provider AS search_provider,
    ta.monthly_visits,
    fp.latest_revenue,
    fp.ecommerce_revenue,
    bc.champion,
    sc.overall_timing,
    icp.updated_at
FROM core_companies c
JOIN intel_icp_priority_mapping icp ON c.domain = icp.domain
LEFT JOIN intel_search_provider sp ON c.domain = sp.domain
LEFT JOIN intel_traffic_analysis ta ON c.domain = ta.domain
LEFT JOIN intel_financial_profile fp ON c.domain = fp.domain
LEFT JOIN intel_buying_committee bc ON c.domain = bc.domain
LEFT JOIN intel_strategic_context sc ON c.domain = sc.domain
WHERE icp.priority_status = 'HOT'
ORDER BY icp.priority_score DESC;
```

### v_displacement_targets
Displacement opportunity view.

```sql
CREATE VIEW v_displacement_targets AS
SELECT
    c.domain,
    c.company_name,
    c.vertical,
    sp.current_provider,
    sp.displacement_priority,
    ts.technology_name AS partner_tech,
    ts.partner_tier,
    ta.monthly_visits,
    icp.lead_score_total,
    icp.priority_status
FROM core_companies c
JOIN intel_search_provider sp ON c.domain = sp.domain
LEFT JOIN intel_technology_stack ts ON c.domain = ts.domain AND ts.is_partner_tech = TRUE
LEFT JOIN intel_traffic_analysis ta ON c.domain = ta.domain
LEFT JOIN intel_icp_priority_mapping icp ON c.domain = icp.domain
WHERE sp.is_algolia = FALSE
  AND sp.displacement_priority IN ('HIGH', 'MEDIUM')
ORDER BY icp.priority_score DESC NULLS LAST;
```

### v_enrichment_dashboard
Enrichment status dashboard.

```sql
CREATE VIEW v_enrichment_dashboard AS
SELECT
    c.domain,
    c.company_name,
    CASE
        WHEN ssb.id IS NOT NULL THEN 'Complete'
        WHEN icp.id IS NOT NULL THEN 'Scored'
        WHEN ta.id IS NOT NULL THEN 'Partial'
        ELSE 'Not Enriched'
    END AS enrichment_level,
    COALESCE(ssb.generated_at, icp.updated_at, ta.updated_at, c.updated_at) AS last_enriched,
    EXTRACT(DAY FROM NOW() - COALESCE(ssb.generated_at, icp.updated_at, ta.updated_at)) AS days_since_enrichment
FROM core_companies c
LEFT JOIN intel_strategic_signal_briefs ssb ON c.domain = ssb.domain
LEFT JOIN intel_icp_priority_mapping icp ON c.domain = icp.domain
LEFT JOIN intel_traffic_analysis ta ON c.domain = ta.domain
ORDER BY days_since_enrichment DESC NULLS LAST;
```

---

## Alembic Migration Example

```python
# alembic/versions/001_initial_schema.py

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create core_companies table
    op.create_table(
        'core_companies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('domain', sa.String(255), nullable=False, unique=True),
        sa.Column('company_name', sa.String(500)),
        sa.Column('ticker', sa.String(20)),
        sa.Column('exchange', sa.String(20)),
        sa.Column('is_public', sa.Boolean(), server_default='false'),
        sa.Column('vertical', sa.String(100)),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'))
    )

    op.create_index('idx_companies_domain', 'core_companies', ['domain'])
    op.create_index('idx_companies_ticker', 'core_companies', ['ticker'])
    op.create_index('idx_companies_vertical', 'core_companies', ['vertical'])

    # Continue with other tables...

def downgrade():
    op.drop_table('core_companies')
```

---

## Performance Considerations

### Indexing Strategy
- Primary keys on UUID with `gen_random_uuid()`
- Foreign keys indexed automatically
- Composite indexes for common query patterns
- Partial indexes for status-based queries

### Partitioning
- `audit_api_calls` partitioned by month
- `jobs_enrichment_history` partitioned by month
- Consider partitioning `intel_*` tables by vertical if >1M rows

### Connection Pooling
```python
# SQLAlchemy connection pool settings
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600
)
```

### Caching Layer
- Redis for API response caching (7-day TTL)
- Redis for rate limiting (sliding window)
- PostgreSQL `core_api_cache` as fallback

---

## Data Retention Policy

| Table Category | Retention | Action |
|----------------|-----------|--------|
| Core data | Indefinite | Soft delete only |
| Intel data | 1 year | Archive to cold storage |
| Job history | 90 days | Purge |
| API call audit | 30 days | Purge |
| User actions | 1 year | Archive |

---

*Schema Version: 2.0*
*Last Updated: 2026-02-25*
*Author: Thread 1 - Backend Architecture*
