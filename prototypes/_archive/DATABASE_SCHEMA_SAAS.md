# Database Schema - SaaS Architecture (Normalized)

**Version**: v4 (Proper SaaS Design)
**Date**: March 3, 2026
**Change from v3**: Eliminated `scratchpad_files` table, replaced with normalized domain tables

---

## Architecture Philosophy

### ❌ What We're NOT Doing (CLI Artifact)

```sql
-- DON'T: Store markdown text blobs
CREATE TABLE scratchpad_files (
  audit_id UUID,
  file_name VARCHAR, -- '01-company-context.md'
  content TEXT       -- Entire markdown as blob
);
```

**Why this is wrong for SaaS**:
- Unqueryable data (can't filter audits by revenue or margin_zone)
- Can't aggregate metrics across audits
- Can't build dashboards or analytics
- Forces clients to parse markdown text
- Wastes storage (markdown formatting overhead)

### ✅ What We're Doing (Normalized Tables)

Each Phase 1 research step writes to **purpose-built tables** with proper columns:
- **Company data** → `audit_company_data` table
- **Executives** → `audit_executives` table
- **Tech stack** → `audit_tech_stack` table
- **Traffic metrics** → `audit_traffic_metrics` table
- **Competitors** → `audit_competitors` table
- **Financial data** → `audit_financial_data` table (multi-year)
- **Investor quotes** → `audit_investor_quotes` table
- **Hiring signals** → `audit_hiring_signals` table in the data schema SaaS file, can you show me what tables are being created? 
- **Test queries** → `audit_test_queries` table

**Benefits**:
- ✅ Queryable: `SELECT AVG(overall_score) FROM audits WHERE margin_zone = 'green'`
- ✅ Aggregatable: Dashboard showing avg score by vertical
- ✅ Filterable: "Show me all audits where competitor uses Algolia"
- ✅ Efficient: Only store data, not markdown formatting
- ✅ Type-safe: Numeric fields are BIGINT/DECIMAL, not parsed strings

---

## Core Tables

### 1. `companies` (Target Companies - Reused from Arian)

```sql
-- This table already exists in algolia-arian project
-- We reference it via audits.target_company_id

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  vertical VARCHAR(100),
  sub_vertical VARCHAR(100),

  -- Core metrics (from enrichment)
  sw_monthly_visits BIGINT,
  sw_bounce_rate DECIMAL(5,2),
  bw_technology_profile JSONB,

  -- Algolia relationship
  is_algolia_customer BOOLEAN DEFAULT FALSE,
  algolia_customer_since DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 3. `audits` (Main Entity)

```sql
CREATE TABLE audits (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number VARCHAR(20) UNIQUE,  -- Human-readable: AUD-2026-001234

  -- Relationships
  target_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  domain VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  opportunity_id UUID REFERENCES algolia_opportunities(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  -- pending → enriching → testing → scoring → generating → completed / failed / needs_review

  -- Scores
  overall_audit_score DECIMAL(3,1),  -- 0.0-10.0
  factcheck_score DECIMAL(4,2),      -- 0.0-10.0
  brand_compliance_score DECIMAL(3,1), -- 0.0-10.0

  -- Progress
  current_phase INTEGER DEFAULT 0,  -- 0-5
  progress_pct DECIMAL(5,2) DEFAULT 0.00,

  -- Configuration
  config JSONB,  -- { mode: 'full', phases: [1,2,3,4,5], custom_queries: [...] }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_audits_target_company_id ON audits(target_company_id);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_domain ON audits(domain);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_audits_overall_score ON audits(overall_audit_score);
```

---

## Phase 1 Research Data Tables

### 4. `audit_company_data` (Step 1: Company Context)

```sql
CREATE TABLE audit_company_data (
  audit_id UUID PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,

  -- Basic info
  company_name VARCHAR(255),
  industry VARCHAR(100),
  vertical VARCHAR(100),
  founded_year INT,
  headquarters VARCHAR(255),

  -- Size
  employee_count INT,
  employee_count_confidence VARCHAR(20), -- 'FACT', 'ESTIMATE', 'OBSERVED'
  store_count INT,

  -- Financial (high-level, detailed data in audit_financial_data)
  revenue_usd BIGINT,
  revenue_year INT,
  revenue_confidence VARCHAR(20), -- 'FACT', 'ESTIMATE'

  -- Ticker & Classification
  ticker_symbol VARCHAR(10),
  is_public BOOLEAN,
  margin_zone VARCHAR(20), -- 'red', 'yellow', 'green'

  -- Leadership
  ceo_name VARCHAR(255),
  ceo_tenure_years INT,
  cfo_name VARCHAR(255),
  cto_name VARCHAR(255),

  -- Sources
  data_sources JSONB,  -- { revenue: 'https://ecdb.com/...', employees: 'https://linkedin.com/...' }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_company_margin_zone ON audit_company_data(margin_zone);
CREATE INDEX idx_audit_company_vertical ON audit_company_data(vertical);
CREATE INDEX idx_audit_company_ticker ON audit_company_data(ticker_symbol);
```

---

### 5. `audit_executives` (Step 1: Company Context - Leadership Deep Dive)

```sql
CREATE TABLE audit_executives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  tier INT NOT NULL, -- 1 (CEO/CFO/COO), 2 (CTO/CDO/VP Ecomm), 3 (VP Eng/Product)

  tenure_years INT,
  previous_company VARCHAR(255),
  education VARCHAR(500),
  linkedin_url VARCHAR(500),

  buyer_role VARCHAR(50), -- 'economic', 'technical', 'user', 'champion'
  priority_signal VARCHAR(20), -- '🔥 hot', '🟡 warm', '⚡ technical', '👤 user'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_execs_audit_id ON audit_executives(audit_id);
CREATE INDEX idx_audit_execs_tier ON audit_executives(tier);
CREATE INDEX idx_audit_execs_buyer_role ON audit_executives(buyer_role);
```

---

### 6. `audit_tech_stack` (Step 2: Technology Stack)

```sql
CREATE TABLE audit_tech_stack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  technology VARCHAR(255) NOT NULL,
  vendor VARCHAR(255),
  category VARCHAR(100), -- 'search', 'ecommerce_platform', 'analytics', 'personalization', 'recommendations'

  status VARCHAR(20) NOT NULL, -- 'current', 'removed', 'added'
  status_date DATE, -- When was it added/removed?

  is_search_provider BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN, -- NULL if unknown, TRUE/FALSE if verified via network requests in Phase 2

  -- Displacement opportunity
  is_algolia_competitor BOOLEAN DEFAULT FALSE,

  source VARCHAR(50), -- 'builtwith', 'similarweb_technologies'
  source_url VARCHAR(500),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tech_audit_id ON audit_tech_stack(audit_id);
CREATE INDEX idx_audit_tech_category ON audit_tech_stack(category);
CREATE INDEX idx_audit_tech_is_search ON audit_tech_stack(is_search_provider);
CREATE INDEX idx_audit_tech_status ON audit_tech_stack(status);
```

---

### 7. `audit_traffic_metrics` (Step 3: Traffic & Engagement)

```sql
CREATE TABLE audit_traffic_metrics (
  audit_id UUID PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,

  -- Volume
  monthly_visits BIGINT,
  bounce_rate DECIMAL(5,2),
  pages_per_visit DECIMAL(4,2),
  avg_duration_sec INT,

  -- Traffic Sources (%)
  source_organic_pct DECIMAL(5,2),
  source_direct_pct DECIMAL(5,2),
  source_paid_pct DECIMAL(5,2),
  source_social_pct DECIMAL(5,2),
  source_referral_pct DECIMAL(5,2),
  source_mail_pct DECIMAL(5,2),

  -- Geography (top 3 countries)
  geo_country_1 VARCHAR(50),
  geo_country_1_pct DECIMAL(5,2),
  geo_country_2 VARCHAR(50),
  geo_country_2_pct DECIMAL(5,2),
  geo_country_3 VARCHAR(50),
  geo_country_3_pct DECIMAL(5,2),

  -- Demographics
  age_18_24_pct DECIMAL(5,2),
  age_25_34_pct DECIMAL(5,2),
  age_35_44_pct DECIMAL(5,2),
  age_45_54_pct DECIMAL(5,2),
  age_55_64_pct DECIMAL(5,2),
  age_65_plus_pct DECIMAL(5,2),
  gender_male_pct DECIMAL(5,2),
  gender_female_pct DECIMAL(5,2),

  -- Ranking
  global_rank INT,
  category_rank INT,
  category VARCHAR(100),

  -- API Metadata (for reproducibility)
  web_source VARCHAR(20), -- 'total', 'desktop', 'mobile'
  country_filter VARCHAR(10), -- 'ww', 'us', etc.
  date_range_start DATE,
  date_range_end DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_traffic_visits ON audit_traffic_metrics(monthly_visits DESC);
```

---

### 8. `audit_competitors` (Step 4: Competitor Identification + Step 6: Search Analysis)

```sql
CREATE TABLE audit_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  domain VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),

  -- Similarity
  similarity_score DECIMAL(5,2), -- From SimilarWeb similar-sites
  similarity_source VARCHAR(50), -- 'similar_sites', 'keyword_competitors'

  -- Traffic
  monthly_visits BIGINT,
  bounce_rate DECIMAL(5,2),

  -- Search Provider
  search_provider VARCHAR(100),
  search_provider_verified BOOLEAN DEFAULT FALSE,

  -- Golden Angle
  uses_algolia BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, domain)
);

CREATE INDEX idx_audit_competitors_audit_id ON audit_competitors(audit_id);
CREATE INDEX idx_audit_competitors_uses_algolia ON audit_competitors(uses_algolia);
```

---

### 9. `audit_test_queries` (Step 5: Test Query Generation)

```sql
CREATE TABLE audit_test_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  query_text VARCHAR(500) NOT NULL,
  query_type VARCHAR(50), -- 'broad', 'specific', 'nlp', 'typo', 'non_product', 'brand', 'company_specific'

  source VARCHAR(50), -- 'vertical_library', 'custom', 'auto_generated'

  -- Test Results (populated in Phase 2)
  tested BOOLEAN DEFAULT FALSE,
  result_count INT,
  latency_ms INT,
  severity VARCHAR(20), -- 'PASS', 'WARNING', 'CRITICAL'
  screenshot_file VARCHAR(255),
  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_queries_audit_id ON audit_test_queries(audit_id);
CREATE INDEX idx_audit_queries_tested ON audit_test_queries(tested);
CREATE INDEX idx_audit_queries_severity ON audit_test_queries(severity);
```

---

### 10. `audit_financial_data` (Step 9: Financial Synthesis)

**Multi-year financial trends (3 fiscal years)**

```sql
CREATE TABLE audit_financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  fiscal_year INT NOT NULL,

  -- Income Statement
  revenue_usd BIGINT,
  net_income_usd BIGINT,
  operating_income_usd BIGINT,
  ebitda_usd BIGINT,

  -- Margins
  operating_margin_pct DECIMAL(5,2),
  ebitda_margin_pct DECIMAL(5,2),
  net_margin_pct DECIMAL(5,2),

  -- E-commerce
  ecommerce_revenue_usd BIGINT,
  ecommerce_pct_total DECIMAL(5,2),

  -- Balance Sheet
  total_assets_usd BIGINT,
  total_debt_usd BIGINT,
  cash_usd BIGINT,

  -- Capex
  digital_capex_usd BIGINT,
  total_capex_usd BIGINT,

  -- Growth
  yoy_revenue_growth_pct DECIMAL(5,2),
  yoy_ecommerce_growth_pct DECIMAL(5,2),

  -- Source
  data_source VARCHAR(50), -- 'yahoo_finance', 'sec_edgar', 'estimate'
  confidence VARCHAR(20), -- 'FACT', 'ESTIMATE'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, fiscal_year)
);

CREATE INDEX idx_audit_financial_audit_id ON audit_financial_data(audit_id);
CREATE INDEX idx_audit_financial_year ON audit_financial_data(fiscal_year DESC);
```

---

### 11. `audit_roi_estimates` (Step 9: ROI Calculation)

```sql
CREATE TABLE audit_roi_estimates (
  audit_id UUID PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,

  -- Inputs
  total_revenue_usd BIGINT,
  digital_revenue_usd BIGINT,
  digital_pct DECIMAL(5,2),
  search_driven_pct DECIMAL(5,2) DEFAULT 15.0, -- Assumption: 15% of digital is search-driven

  -- Revenue Addressable
  revenue_addressable_usd BIGINT,

  -- Scenarios
  conservative_lift_pct DECIMAL(5,2), -- e.g., 5%
  conservative_value_usd BIGINT,

  moderate_lift_pct DECIMAL(5,2), -- e.g., 10%
  moderate_value_usd BIGINT,

  aggressive_lift_pct DECIMAL(5,2), -- e.g., 15%
  aggressive_value_usd BIGINT,

  -- Benchmarks Used
  case_study_primary VARCHAR(255), -- 'Huckberry (+9.4% revenue)'
  case_study_primary_url VARCHAR(500),
  case_study_secondary VARCHAR(255),
  case_study_secondary_url VARCHAR(500),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 12. `audit_investor_quotes` (Step 12: Investor Intelligence)

```sql
CREATE TABLE audit_investor_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  speaker_name VARCHAR(255) NOT NULL,
  speaker_title VARCHAR(255) NOT NULL,

  quote_text TEXT NOT NULL,

  source_type VARCHAR(50) NOT NULL, -- 'earnings_call', '10-K', '10-Q', 'investor_day', 'interview'
  source_name VARCHAR(255), -- 'Q4 FY2025 Earnings Call', '2024 10-K', 'Goldman Sachs Conference'
  source_date DATE,
  source_url VARCHAR(500),

  -- Mapping
  strategic_priority VARCHAR(255), -- e.g., 'Digital transformation', 'AI investment'
  maps_to_algolia_product VARCHAR(100), -- 'NeuralSearch', 'Recommend', 'Personalization'
  discovery_question TEXT, -- Generated question for AE: "You mentioned X, how can we help?"

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_quotes_audit_id ON audit_investor_quotes(audit_id);
CREATE INDEX idx_audit_quotes_algolia_product ON audit_investor_quotes(maps_to_algolia_product);
```

---

### 13. `audit_hiring_signals` (Step 8 + 13: Hiring Signals & Deep Hiring)

```sql
CREATE TABLE audit_hiring_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  job_title VARCHAR(255) NOT NULL,
  job_category VARCHAR(100), -- 'Engineering', 'Product', 'Data', 'eCommerce', 'Merchandising'

  tier INT, -- 1 (VP/Director), 2 (Manager), 3 (IC)
  signal_strength VARCHAR(20), -- '🔥 strong', '🟡 moderate', '⚡ technical'

  job_url VARCHAR(500),
  posted_date DATE,

  skills_mentioned TEXT[], -- Array of skills from JD
  tools_mentioned VARCHAR(500), -- 'Algolia', 'Elasticsearch', 'Solr'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_hiring_audit_id ON audit_hiring_signals(audit_id);
CREATE INDEX idx_audit_hiring_category ON audit_hiring_signals(job_category);
CREATE INDEX idx_audit_hiring_signal ON audit_hiring_signals(signal_strength);
```

---

## Phase 2 Browser Testing Data

### 14. `screenshots` (Phase 2: Browser Testing)

```sql
CREATE TABLE screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  file_name VARCHAR(255) NOT NULL,
  query VARCHAR(500), -- Test query used (or NULL for homepage)
  test_step VARCHAR(100), -- 'homepage', 'sayt', 'typo_tolerance', 'nlp_search', etc.

  severity VARCHAR(20), -- 'PASS', 'WARNING', 'CRITICAL'
  result_count INT,
  latency_ms INT,

  storage_url TEXT NOT NULL, -- S3 URL
  thumbnail_url TEXT,
  file_size_bytes BIGINT,

  observations TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, file_name)
);

CREATE INDEX idx_screenshots_audit_id ON screenshots(audit_id);
CREATE INDEX idx_screenshots_severity ON screenshots(severity);
CREATE INDEX idx_screenshots_test_step ON screenshots(test_step);
```

---

## Phase 3 Scoring Data

### 15. `audit_scoring` (Phase 3: Analyze & Score)

```sql
CREATE TABLE audit_scoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  challenge_area VARCHAR(100) NOT NULL, -- 'latency', 'typo_tolerance', 'query_suggestions', etc.

  score DECIMAL(3,1) NOT NULL, -- 0.0-10.0
  severity VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
  severity_weight DECIMAL(3,1), -- 0.5 (LOW), 1.0 (MED), 2.0 (HIGH)

  evidence TEXT, -- What was tested
  screenshot_refs VARCHAR(500)[], -- Array of screenshot file names

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, challenge_area)
);

CREATE INDEX idx_audit_scoring_audit_id ON audit_scoring(audit_id);
CREATE INDEX idx_audit_scoring_severity ON audit_scoring(severity);
```

---

## Phase 5 Deliverables

### 16. `deliverables` (Phase 5: PDF Book, AE Brief, Signal Brief)

```sql
CREATE TABLE deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL, -- 'book', 'ae_brief', 'signal_brief'
  file_name VARCHAR(255) NOT NULL,

  storage_url TEXT NOT NULL, -- S3 URL
  file_size_bytes BIGINT,
  page_count INT,

  brand_score DECIMAL(3,1), -- From /algolia-brand-check
  factcheck_score DECIMAL(3,1), -- From /algolia-audit-factcheck

  -- HTML content (for book only, used for on-demand regeneration)
  html_content TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, type)
);

CREATE INDEX idx_deliverables_audit_id ON deliverables(audit_id);
CREATE INDEX idx_deliverables_type ON deliverables(type);
```

---

## Execution Monitoring

### 17. `execution_logs` (All Phases: Progress Tracking)

```sql
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  timestamp TIMESTAMPTZ DEFAULT NOW(),

  phase VARCHAR(50), -- 'phase_0', 'phase_1', 'phase_2', etc.
  step VARCHAR(255), -- 'Company Context', 'Tech Stack', 'Browser Testing: SAYT'

  level VARCHAR(20), -- 'info', 'warning', 'error'
  message TEXT,

  metadata JSONB, -- Flexible data: { ticker: 'COST', revenue: 254200000000, ... }

  -- For tracking MCP calls
  mcp_server VARCHAR(50), -- 'builtwith', 'similarweb', etc.
  mcp_endpoint VARCHAR(100),
  mcp_latency_ms INT,
  mcp_cached BOOLEAN
);

CREATE INDEX idx_execution_logs_audit_id ON execution_logs(audit_id);
CREATE INDEX idx_execution_logs_timestamp ON execution_logs(timestamp DESC);
CREATE INDEX idx_execution_logs_level ON execution_logs(level);
CREATE INDEX idx_execution_logs_phase ON execution_logs(phase);
```

---

### 18. `mcp_calls` (API Call History - For Caching & Analytics)

```sql
CREATE TABLE mcp_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  server VARCHAR(50) NOT NULL, -- 'builtwith', 'similarweb', 'yahoo_finance', 'sec_edgar', 'websearch'
  endpoint VARCHAR(100) NOT NULL,

  params_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of params (for cache key)
  params JSONB, -- Full params for debugging

  response_cached BOOLEAN DEFAULT FALSE,
  cache_key VARCHAR(255),

  latency_ms INT,
  credits_used INT,

  http_status INT,
  error TEXT,

  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_calls_audit_id ON mcp_calls(audit_id);
CREATE INDEX idx_mcp_calls_server ON mcp_calls(server);
CREATE INDEX idx_mcp_calls_params_hash ON mcp_calls(params_hash); -- For cache lookup
CREATE INDEX idx_mcp_calls_timestamp ON mcp_calls(timestamp DESC);
```

---

## Supporting Tables

### 19. `algolia_opportunities` (Sales Context)

```sql
CREATE TABLE algolia_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  opportunity_name VARCHAR(255) NOT NULL,
  opportunity_type VARCHAR(50) NOT NULL, -- 'new_business', 'upsell', 'renewal', 'competitive_intel'

  sfdc_opportunity_id VARCHAR(18) UNIQUE,
  sfdc_account_id VARCHAR(18),

  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,

  stage VARCHAR(50), -- 'discovery', 'technical_evaluation', 'proposal', 'negotiation'

  estimated_arr DECIMAL(12,2),
  close_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_owner_id ON algolia_opportunities(owner_id);
CREATE INDEX idx_opportunities_sfdc_id ON algolia_opportunities(sfdc_opportunity_id);
CREATE INDEX idx_opportunities_stage ON algolia_opportunities(stage);
```

---

## Summary

### Total Tables: 19

| Category | Tables | Purpose |
|----------|--------|---------|
| **Core** | 3 | users, companies, audits |
| **Phase 1 Research** | 9 | company_data, executives, tech_stack, traffic_metrics, competitors, test_queries, financial_data, roi_estimates, investor_quotes, hiring_signals |
| **Phase 2 Browser** | 1 | screenshots |
| **Phase 3 Scoring** | 1 | audit_scoring |
| **Phase 5 Deliverables** | 1 | deliverables |
| **Monitoring** | 2 | execution_logs, mcp_calls |
| **Supporting** | 1 | algolia_opportunities |

### Key Differences from CLI Skill

| CLI Skill | SaaS Application |
|-----------|------------------|
| 12 markdown files on disk | 9 normalized tables + JSONB where appropriate |
| Unqueryable text blobs | Structured, indexed, aggregatable data |
| No historical tracking | Full audit history with queryable metrics |
| No caching layer | `mcp_calls` table enables 24hr cache |
| No progress visibility | `execution_logs` + WebSocket for real-time updates |
| File size = storage cost | Compressed JSONB, S3 lifecycle policies |

---

**Database Schema Complete** ✅
19 tables with proper normalization, indexes, and foreign keys for production SaaS application.
