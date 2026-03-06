# Database Architecture - Search Audit Dashboard

## Decision: Extend Existing Supabase Project

**Recommendation:** Use the SAME Supabase project as algolia-arian
- **Project ID:** `xbitqeejsgqnwvxlnjra`
- **Rationale:** Reuse enrichment infrastructure, same API keys, shared company data

---

## ✅ What Already Exists (Arian Project)

### Core Tables in Production

| Table | Records | Purpose | Reuse? |
|-------|---------|---------|--------|
| **companies** | ~3,000 | Master company table with domain, name, vertical, traffic, revenue | ✅ YES - Reference only |
| **technologies** | ~500 | Tech stack catalog (BuiltWith categories) | ✅ YES - Reference only |
| **company_technologies** | ~15,000 | Junction table (company ↔ tech) | ✅ YES - Reference only |
| **case_studies** | ~82 | Algolia customer case studies | ✅ YES - Reference for deliverables |
| **customer_quotes** | ~379 | Algolia customer testimonials | ✅ YES - Reference for deliverables |
| **target_job_profiles** | ~140 | Job titles for hiring signal analysis | ✅ YES - Reuse for Phase 1 |
| **competitors** | ~1,500 | Competitor relationships (SimilarWeb) | ✅ YES - Reference only |

### ⚠️ NO `displacement_targets` Table

After reviewing the migrations, the current arian schema does NOT have a `displacement_targets` table yet. The structure exists in documentation but hasn't been migrated to production.

**Current enrichment storage pattern:**
- Enrichment data is stored directly in `companies` table as individual columns:
  - `sw_monthly_visits`, `sw_bounce_rate`, `sw_pages_per_visit` (SimilarWeb)
  - `bw_spend_estimate`, `bw_first_indexed` (BuiltWith)
  - Plus JSONB columns added via migrations for complex data

---

## 🔴 What Needs to Be Built

### NEW Table: `audits` (Primary table for Search Audit Dashboard)

```sql
CREATE TABLE audits (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL,  -- NOT unique (can re-audit same domain)
  company_name VARCHAR(255),

  -- Reference to master companies table (optional)
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Audit metadata
  status VARCHAR(20) DEFAULT 'pending',
  -- pending → running → factchecking → completed / needs_review / failed

  audit_type VARCHAR(20) DEFAULT 'full',  -- 'full', 'quick', 'browser_only'
  requested_by VARCHAR(255),  -- User email (for future auth)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Progress tracking
  current_phase INTEGER DEFAULT 1,  -- 1-5
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 52,  -- 14 + 20 + 10 + 3 + 5
  progress_pct DECIMAL(5,2) DEFAULT 0.00,

  -- Phase 1: Enrichment Data (JSONB - reuse arian pattern)
  traffic_data JSONB,              -- SimilarWeb: visits, bounce, sources, demographics
  tech_stack JSONB,                -- BuiltWith: 7 endpoints
  financial_data JSONB,            -- Yahoo Finance: 3-year financials
  competitor_data JSONB,           -- Competitor analysis with search providers
  hiring_signals JSONB,            -- Job postings analysis
  executive_data JSONB,            -- Executive team
  investor_intelligence JSONB,     -- SEC filings, earnings calls, quotes

  -- 🔴 NEW: Source Citations (MANDATORY)
  source_citations JSONB,
  /* Structure:
  {
    "traffic_data": [
      {
        "claim": "100.9M monthly visits",
        "value": 100900000,
        "source": "SimilarWeb API",
        "source_url": "https://api.similarweb.com/v1/...",
        "api_endpoint": "total-traffic-and-engagement",
        "fetched_at": "2025-02-15T14:23:00Z",
        "api_response_hash": "a3f2b91c..."
      }
    ],
    "tech_stack": [...],
    "financial_data": [...],
    "investor_quotes": [...]
  }
  */

  -- 🔴 NEW: Data Freshness Tracking
  data_freshness JSONB,
  /* Structure:
  {
    "traffic_data": "2025-02-15",
    "tech_stack": "2025-02-14",
    "financial_data": "2024-12-31",  // Can be older (3-year history)
    "hiring_signals": "2025-02-15",
    "investor_intelligence": "2024-11-05"
  }
  */

  -- Phase 2: Browser Testing Results
  browser_test_results JSONB,
  /* Structure:
  {
    "tests": [
      {
        "step": 1,
        "test_name": "Homepage Load",
        "status": "passed",
        "screenshot_url": "https://blob.vercel.app/...",
        "observations": ["Search box visible", "SAYT enabled"],
        "score": 10
      },
      ...
    ],
    "total_score": 42,
    "avg_score": 4.2
  }
  */

  screenshot_count INTEGER DEFAULT 0,
  screenshots_url TEXT,  -- S3/Vercel Blob folder URL

  -- Phase 3: Scoring Results
  audit_score JSONB,
  /* Structure:
  {
    "overall_score": 4.2,
    "areas": [
      {
        "name": "SAYT",
        "score": 6,
        "severity": "MEDIUM",
        "gaps": ["No query suggestions", "Text-only results"],
        "strengths": ["Fast response time"]
      },
      ...
    ],
    "gap_count": 18,
    "strength_count": 7,
    "severity_breakdown": {"HIGH": 3, "MEDIUM": 5, "LOW": 2}
  }
  */

  overall_score DECIMAL(3,1),  -- 0.0 - 10.0 (denormalized for filtering)

  -- Phase 4: Generated Deliverables
  report_url TEXT,              -- Markdown report
  landing_page_url TEXT,        -- HTML landing page
  deck_url TEXT,                -- Deck markdown
  book_pdf_url TEXT,            -- PDF book (40-50 pages)
  ae_brief_url TEXT,            -- AE pre-call brief
  signal_brief_url TEXT,        -- Strategic signal brief

  deliverables_generated_at TIMESTAMPTZ,

  -- 🔴 Phase 5: Fact-Check Results
  factcheck_status VARCHAR(20),  -- 'pending', 'running', 'completed', 'failed'
  factcheck_score DECIMAL(4,2),  -- 0.00 - 10.00
  factcheck_report_url TEXT,
  factcheck_corrections JSONB,
  /* Structure:
  {
    "corrections": [
      {
        "file": "costco-search-audit.md",
        "line": 169,
        "type": "INCONSISTENT",
        "field": "bounce_rate",
        "found": "31.3%",
        "expected": "37.2%",
        "source": "03-traffic-data.md L14"
      }
    ],
    "critical_issues": 2,
    "warnings": 5
  }
  */
  factcheck_completed_at TIMESTAMPTZ,

  -- Errors & Diagnostics
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,

  -- Performance metrics
  duration_seconds INTEGER,  -- Total audit runtime
  phase_durations JSONB      -- {"phase1": 180, "phase2": 420, ...}
);

-- Indexes
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_domain ON audits(domain);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_audits_overall_score ON audits(overall_score DESC NULLS LAST);
CREATE INDEX idx_audits_factcheck_score ON audits(factcheck_score DESC NULLS LAST);
CREATE INDEX idx_audits_company_id ON audits(company_id);

-- Row Level Security (RLS)
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all reads (internal tool, no auth yet)
DROP POLICY IF EXISTS "Allow public read access" ON audits;
CREATE POLICY "Allow public read access" ON audits FOR SELECT USING (true);

-- Policy: Allow all inserts (for now)
DROP POLICY IF EXISTS "Allow public insert access" ON audits;
CREATE POLICY "Allow public insert access" ON audits FOR INSERT WITH CHECK (true);

-- Policy: Allow all updates (for now)
DROP POLICY IF EXISTS "Allow public update access" ON audits;
CREATE POLICY "Allow public update access" ON audits FOR UPDATE USING (true);
```

---

## NEW Table: `audit_progress_events` (Real-time progress tracking)

```sql
CREATE TABLE audit_progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  phase INTEGER NOT NULL,  -- 1-5
  step INTEGER,
  step_name VARCHAR(255),

  event_type VARCHAR(50) NOT NULL,  -- 'started', 'progress', 'completed', 'failed', 'warning'
  message TEXT,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_audit_id ON audit_progress_events(audit_id, created_at);
CREATE INDEX idx_progress_type ON audit_progress_events(event_type);

ALTER TABLE audit_progress_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON audit_progress_events;
CREATE POLICY "Allow public read access" ON audit_progress_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert access" ON audit_progress_events;
CREATE POLICY "Allow public insert access" ON audit_progress_events FOR INSERT WITH CHECK (true);
```

---

## NEW Table: `audit_factcheck_dimensions` (Detailed fact-check results)

```sql
CREATE TABLE audit_factcheck_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,

  dimension INTEGER NOT NULL,  -- 1-7
  dimension_name VARCHAR(100) NOT NULL,

  score DECIMAL(4,2) NOT NULL,  -- 0.00 - 10.00
  weight DECIMAL(3,2) NOT NULL, -- 0.10 - 0.20 (percentage)
  weighted_score DECIMAL(4,2),  -- score × weight

  issues_found INTEGER DEFAULT 0,
  warnings_found INTEGER DEFAULT 0,

  details JSONB,
  /* Structure varies by dimension:
  Dimension 1 (Consistency): {"inconsistencies": [...]}
  Dimension 4 (API): {"api_calls": [...], "mismatches": [...]}
  Dimension 5 (Citations): {"broken_links": [...], "verified_links": [...]}
  */

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_factcheck_audit_id ON audit_factcheck_dimensions(audit_id);
CREATE INDEX idx_factcheck_dimension ON audit_factcheck_dimensions(dimension);

ALTER TABLE audit_factcheck_dimensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON audit_factcheck_dimensions;
CREATE POLICY "Allow public read access" ON audit_factcheck_dimensions FOR SELECT USING (true);
```

---

## Summary: Database Build Plan

### Option A: Same Supabase Project (RECOMMENDED)

**Pros:**
- ✅ Reuse existing API keys (SimilarWeb, BuiltWith, Yahoo Finance)
- ✅ Reuse enrichment services without modification
- ✅ Reference `companies`, `case_studies`, `customer_quotes` tables
- ✅ No new Supabase project setup
- ✅ Shared cost model

**Cons:**
- ⚠️ Mixing two products in one database (but tables are isolated)

**Migration:**
```sql
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/sql/new

-- 1. Create audits table (main table)
-- [SQL from above]

-- 2. Create audit_progress_events table
-- [SQL from above]

-- 3. Create audit_factcheck_dimensions table
-- [SQL from above]
```

---

### Option B: New Supabase Project

**Pros:**
- ✅ Clean separation (Arian vs Search Audit)
- ✅ Independent scaling

**Cons:**
- ❌ Need to copy enrichment services AND modify API connections
- ❌ Need to set up new API keys
- ❌ Cannot reference `case_studies` or `customer_quotes` tables
- ❌ More complex deployment

**Not recommended** unless strong organizational reason.

---

## Data Reuse Strategy

### Read-Only References (Arian → Audit)

The `audits` table can optionally link to existing arian tables:

```typescript
// frontend/src/services/api.ts

// Option 1: Start audit from existing company
async function startAuditFromCompany(companyId: string) {
  const company = await supabase
    .from('companies')
    .select('domain, name, vertical')
    .eq('id', companyId)
    .single();

  const audit = await supabase
    .from('audits')
    .insert({
      domain: company.domain,
      company_name: company.name,
      company_id: companyId,  // Link back to arian
      status: 'pending'
    })
    .select()
    .single();

  return audit;
}

// Option 2: Start fresh audit (no company link)
async function startAuditFromDomain(domain: string) {
  const audit = await supabase
    .from('audits')
    .insert({
      domain: domain,
      company_id: null,  // No link
      status: 'pending'
    })
    .select()
    .single();

  return audit;
}
```

### Reference Data for Deliverables

When generating deliverables, pull relevant case studies:

```typescript
// backend/services/deliverables/generator.ts

async function generateDeliverables(auditData) {
  // Pull relevant case studies based on vertical
  const caseStudies = await supabase
    .from('case_studies')
    .select('*')
    .eq('vertical', auditData.vertical)
    .limit(3);

  // Pull customer quotes
  const quotes = await supabase
    .from('customer_quotes')
    .select('*')
    .eq('vertical', auditData.vertical)
    .limit(5);

  // Pass to template
  return fillTemplate('report-template.md', {
    ...auditData,
    relevantCaseStudies: caseStudies,
    customerQuotes: quotes
  });
}
```

---

## Week 1 Action Items

### Database Setup (2-3 hours)

1. **Run migrations in Supabase SQL Editor:**
   - Create `audits` table
   - Create `audit_progress_events` table
   - Create `audit_factcheck_dimensions` table
   - Test: Insert sample audit record

2. **Update enrichment services to capture source URLs:**
   - Modify `frontend/src/services/enrichment/orchestrator.ts`
   - Add `captureSourceUrls: true` option
   - Store source URL alongside each data point

3. **Add data freshness validation:**
   - Modify API clients to check data timestamps
   - Reject API responses >12 months old (except financials = 3 years)

4. **Test Supabase connection from frontend:**
   ```typescript
   // Test API endpoint
   async function testConnection() {
     const { data, error } = await supabase
       .from('audits')
       .select('count');

     console.log('Audits count:', data);
   }
   ```

---

## Summary Table

| Question | Answer |
|----------|--------|
| **Use same Supabase project?** | ✅ YES - `xbitqeejsgqnwvxlnjra` |
| **Tables that exist?** | `companies`, `technologies`, `company_technologies`, `case_studies`, `customer_quotes`, `target_job_profiles` (7 tables) |
| **Tables to build?** | `audits`, `audit_progress_events`, `audit_factcheck_dimensions` (3 tables) |
| **Reuse existing columns?** | ✅ YES - JSONB pattern for enrichment data |
| **New columns?** | `source_citations`, `data_freshness`, `factcheck_*` fields |
| **Migration complexity?** | LOW - 3 CREATE TABLE statements |
| **Ready to migrate?** | ✅ YES - Week 1 Day 1 |

---

**Next Step:** Run the SQL migrations in Supabase SQL Editor to create the 3 new tables.
