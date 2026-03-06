# Database Schema V2 - Properly Normalized

## Design Principles

1. **Separate concerns**: Audit metadata ≠ enrichment data ≠ test results
2. **Avoid duplication**: Enrichment data stored once per company, audits reference it
3. **Queryable**: Critical fields as columns, not JSONB
4. **Reuse arian data**: Link to existing `companies` table when possible

---

## Core Tables

### 1. `audits` (Audit Metadata Only)

```sql
CREATE TABLE audits (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),

  -- Link to arian's companies table (optional)
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Status workflow
  status VARCHAR(20) DEFAULT 'pending',
  -- pending → enriching → testing → scoring → generating → factchecking → completed/failed/needs_review

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  requested_by VARCHAR(255),  -- For future auth

  -- Progress tracking (denormalized for dashboard)
  current_phase INTEGER DEFAULT 1,
  progress_pct DECIMAL(5,2) DEFAULT 0.00,

  -- Overall scores (denormalized for filtering/sorting)
  overall_audit_score DECIMAL(3,1),  -- 0.0 - 10.0
  factcheck_score DECIMAL(4,2),      -- 0.00 - 10.00

  -- Performance
  duration_seconds INTEGER,

  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_domain ON audits(domain);
CREATE INDEX idx_audits_company_id ON audits(company_id);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_audits_overall_score ON audits(overall_audit_score DESC NULLS LAST);
CREATE INDEX idx_audits_factcheck_score ON audits(factcheck_score DESC NULLS LAST);
```

---

### 2. `audit_enrichment_snapshots` (Enrichment Data Captured at Audit Time)

**Why separate table?**
- Same company audited multiple times = separate snapshots
- Can compare data changes over time
- Links to audit, not company (data is point-in-time)

```sql
CREATE TABLE audit_enrichment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  -- SimilarWeb data (as columns for queryability)
  monthly_visits BIGINT,
  bounce_rate DECIMAL(5,2),
  pages_per_visit DECIMAL(5,2),
  avg_visit_duration INTEGER,

  -- Additional traffic data (JSONB for flexibility)
  traffic_sources JSONB,      -- {"direct": 0.35, "organic": 0.42, ...}
  demographics JSONB,          -- {"male": 0.52, "age_25_34": 0.38, ...}
  geography JSONB,             -- [{"country": "US", "share": 0.45}, ...]

  -- Tech stack (as columns + JSONB)
  current_search_provider VARCHAR(100),
  ecommerce_platform VARCHAR(100),
  cms_platform VARCHAR(100),
  tech_stack_full JSONB,       -- Full BuiltWith response

  -- Financials (as columns for queryability)
  annual_revenue DECIMAL(15,2),
  revenue_growth_pct DECIMAL(5,2),
  ebitda_margin DECIMAL(5,2),
  employee_count INTEGER,

  financials_full JSONB,       -- 3-year history

  -- Competitors
  competitors JSONB,           -- [{"name": "...", "search_provider": "...", "traffic": ...}, ...]

  -- Hiring signals
  total_job_postings INTEGER,
  relevant_job_postings INTEGER,
  hiring_signals JSONB,        -- Full breakdown by category

  -- Executive team
  executives JSONB,            -- [{"name": "...", "title": "...", "since": "..."}, ...]

  -- Investor intelligence
  investor_quotes JSONB,       -- [{"quote": "...", "speaker": "...", "source_url": "..."}, ...]

  -- Metadata
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  data_freshness_check TIMESTAMPTZ,  -- When data freshness was validated

  UNIQUE(audit_id)  -- One snapshot per audit
);

CREATE INDEX idx_enrichment_audit_id ON audit_enrichment_snapshots(audit_id);
CREATE INDEX idx_enrichment_search_provider ON audit_enrichment_snapshots(current_search_provider);
```

---

### 3. `audit_source_citations` (Normalized Citations)

**Why separate table?**
- Makes citations queryable
- Can validate/check links independently
- Can track citation health over time

```sql
CREATE TABLE audit_source_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  -- What data point this citation supports
  data_category VARCHAR(50) NOT NULL,  -- 'traffic', 'tech_stack', 'financial', 'competitor', 'hiring', 'investor_quote'
  field_name VARCHAR(100),             -- 'monthly_visits', 'bounce_rate', etc.

  -- The claim
  claim_text TEXT NOT NULL,
  claim_value JSONB,                   -- Structured value: {"numeric": 100900000, "formatted": "100.9M"}

  -- The source
  source_type VARCHAR(50) NOT NULL,    -- 'similarweb_api', 'builtwith_api', 'yahoo_finance', 'sec_filing', 'earnings_call', 'web_search'
  source_name VARCHAR(255),            -- 'SimilarWeb API', 'Yahoo Finance', 'Q2 2024 Earnings Call'
  source_url TEXT NOT NULL,
  source_date DATE,                    -- Date of the source data (for freshness)

  -- Metadata
  fetched_at TIMESTAMPTZ NOT NULL,
  api_response_hash VARCHAR(64),       -- SHA-256 hash for validation

  -- Validation status (populated by fact-check)
  verified BOOLEAN DEFAULT NULL,       -- NULL = not checked, TRUE = verified, FALSE = failed
  verified_at TIMESTAMPTZ,
  verification_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citations_audit_id ON audit_source_citations(audit_id);
CREATE INDEX idx_citations_category ON audit_source_citations(data_category);
CREATE INDEX idx_citations_verified ON audit_source_citations(verified);
CREATE INDEX idx_citations_source_date ON audit_source_citations(source_date);
```

---

### 4. `audit_browser_tests` (Individual Test Results)

**Why separate table?**
- 20 test results per audit = 20 rows
- Can query "how many audits failed SAYT test?"
- Can aggregate scores by test type

```sql
CREATE TABLE audit_browser_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  -- Test identification
  step_number INTEGER NOT NULL,
  test_name VARCHAR(100) NOT NULL,
  test_category VARCHAR(50),           -- 'core', 'value_prop'

  -- Test query (if applicable)
  test_query VARCHAR(255),

  -- Result
  status VARCHAR(20) NOT NULL,         -- 'passed', 'failed', 'warning', 'skipped'
  score INTEGER CHECK (score BETWEEN 0 AND 10),

  -- Observations
  observations TEXT[],                 -- Array of observation strings
  gap_description TEXT,                -- What's missing/broken
  recommendation TEXT,                 -- How to fix

  -- Screenshot
  screenshot_url TEXT,
  screenshot_captured BOOLEAN DEFAULT FALSE,

  -- Metadata
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_ms INTEGER,

  UNIQUE(audit_id, step_number)
);

CREATE INDEX idx_browser_tests_audit_id ON audit_browser_tests(audit_id);
CREATE INDEX idx_browser_tests_status ON audit_browser_tests(status);
CREATE INDEX idx_browser_tests_test_name ON audit_browser_tests(test_name);
```

---

### 5. `audit_scoring_areas` (10 Scoring Areas)

**Why separate table?**
- Can query "average SAYT score across all audits"
- Can track improvements over time
- Can filter audits by specific area score

```sql
CREATE TABLE audit_scoring_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  -- Scoring area
  area_number INTEGER NOT NULL CHECK (area_number BETWEEN 1 AND 10),
  area_name VARCHAR(100) NOT NULL,

  -- Score
  score INTEGER CHECK (score BETWEEN 0 AND 10),
  severity VARCHAR(10),                -- 'HIGH', 'MEDIUM', 'LOW'

  -- Details
  gaps TEXT[],                         -- Array of gap descriptions
  strengths TEXT[],                    -- Array of strength descriptions

  -- Metadata
  scored_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, area_number)
);

CREATE INDEX idx_scoring_audit_id ON audit_scoring_areas(audit_id);
CREATE INDEX idx_scoring_area_name ON audit_scoring_areas(area_name);
CREATE INDEX idx_scoring_severity ON audit_scoring_areas(severity);
```

---

### 6. `audit_deliverables` (Generated Files)

**Why separate table?**
- Multiple deliverables per audit (6 files)
- Can track generation status per file
- Can regenerate individual files

```sql
CREATE TABLE audit_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  -- File identification
  file_type VARCHAR(50) NOT NULL,      -- 'report_md', 'landing_html', 'deck_md', 'book_pdf', 'ae_brief_md', 'signal_brief_md'
  file_name VARCHAR(255) NOT NULL,

  -- Storage
  file_url TEXT NOT NULL,              -- Vercel Blob or S3 URL
  file_size_bytes BIGINT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'

  -- Metadata
  generated_at TIMESTAMPTZ,
  generation_duration_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, file_type)
);

CREATE INDEX idx_deliverables_audit_id ON audit_deliverables(audit_id);
CREATE INDEX idx_deliverables_file_type ON audit_deliverables(file_type);
CREATE INDEX idx_deliverables_status ON audit_deliverables(status);
```

---

### 7. `audit_factcheck_dimensions` (7 Fact-Check Dimensions)

**Already properly normalized in V1 - keep as-is**

```sql
CREATE TABLE audit_factcheck_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  dimension INTEGER NOT NULL CHECK (dimension BETWEEN 1 AND 7),
  dimension_name VARCHAR(100) NOT NULL,

  score DECIMAL(4,2) NOT NULL,
  weight DECIMAL(3,2) NOT NULL,
  weighted_score DECIMAL(4,2),

  issues_found INTEGER DEFAULT 0,
  warnings_found INTEGER DEFAULT 0,

  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audit_id, dimension)
);

CREATE INDEX idx_factcheck_audit_id ON audit_factcheck_dimensions(audit_id);
CREATE INDEX idx_factcheck_dimension ON audit_factcheck_dimensions(dimension);
```

---

### 8. `audit_progress_events` (Real-Time Progress)

**Already properly normalized in V1 - keep as-is**

```sql
CREATE TABLE audit_progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  phase INTEGER NOT NULL,
  step INTEGER,
  step_name VARCHAR(255),

  event_type VARCHAR(50) NOT NULL,
  message TEXT,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_audit_id ON audit_progress_events(audit_id, created_at);
CREATE INDEX idx_progress_type ON audit_progress_events(event_type);
```

---

## Benefits of Normalized Design

### ✅ Queryability

```sql
-- Find all audits where SAYT scored < 5
SELECT a.* FROM audits a
JOIN audit_scoring_areas asa ON a.id = asa.audit_id
WHERE asa.area_name = 'SAYT' AND asa.score < 5;

-- Find companies with > 100M monthly visits
SELECT a.* FROM audits a
JOIN audit_enrichment_snapshots aes ON a.id = aes.audit_id
WHERE aes.monthly_visits > 100000000;

-- Find all audits with failed citations
SELECT a.domain, COUNT(*) as failed_citations
FROM audits a
JOIN audit_source_citations asc ON a.id = asc.audit_id
WHERE asc.verified = FALSE
GROUP BY a.domain;
```

### ✅ No Data Duplication

- Enrichment data stored once per audit (not per table row)
- Citations are individual rows (not nested JSONB)
- Browser tests are individual rows (can rerun specific tests)

### ✅ Easier to Extend

- Add new browser test? → Insert row, no schema change
- Add new scoring area? → Insert row, no schema change
- Add new deliverable type? → Insert row, no schema change

### ✅ Better Performance

- Indexes on critical columns (not JSONB path queries)
- Can use JOIN instead of JSONB extraction
- Can aggregate easily

---

## Migration Path

### Option A: Start Fresh (Recommended)

Use this normalized schema from Day 1.

### Option B: Hybrid Approach

- Keep some JSONB for truly flexible data (e.g., `traffic_sources`)
- But make searchable fields as columns

---

## Summary Table

| Concern | V1 (Denormalized) | V2 (Normalized) |
|---------|-------------------|-----------------|
| **Audit metadata** | ❌ Mixed with enrichment data | ✅ Separate `audits` table |
| **Enrichment data** | ❌ Giant JSONB blob | ✅ Separate `audit_enrichment_snapshots` with key columns |
| **Source citations** | ❌ Nested JSONB array | ✅ Separate `audit_source_citations` (queryable) |
| **Browser tests** | ❌ Single JSONB blob | ✅ Separate `audit_browser_tests` (20 rows per audit) |
| **Scoring** | ❌ Single JSONB blob | ✅ Separate `audit_scoring_areas` (10 rows per audit) |
| **Deliverables** | ❌ 6 TEXT columns | ✅ Separate `audit_deliverables` (6 rows per audit) |
| **Queryability** | ❌ Hard (JSONB path queries) | ✅ Easy (SQL JOINs) |
| **Data duplication** | ❌ High | ✅ Low |
| **Extensibility** | ❌ Schema changes required | ✅ Just insert rows |

---

## Next Steps

1. Review this normalized design
2. Confirm table relationships make sense
3. Decide on JSONB vs columns for specific fields
4. Write migration SQL for all 8 tables

**Your call**: Is this normalized design better?
