# Database Schema v5 - Time-Series Architecture

**Date**: March 3, 2026
**Key Change**: Companies are the main entity. Audits are point-in-time snapshots enabling version comparison.

---

## Architecture Principle: Time-Series Snapshots

### The Core Concept

```
Company (Lightweight Entity)
    ├─ Audit 1 (June 2025)      ← Snapshot at time T1
    │   ├─ Traffic: 2.5M visits
    │   ├─ Financials: $254B revenue
    │   └─ Hiring: 12 roles open
    │
    ├─ Audit 2 (December 2025)  ← Snapshot at time T2
    │   ├─ Traffic: 3.1M visits (+24%)
    │   ├─ Financials: $268B revenue (+5.5%)
    │   └─ Hiring: 28 roles open (+133%)
    │
    └─ Audit 3 (June 2026)      ← Snapshot at time T3
        ├─ Traffic: 3.3M visits (+6.5% vs T2)
        ├─ Financials: $275B revenue (+2.6% vs T2)
        └─ Hiring: 8 roles open (-71% vs T2 — red flag!)
```

**Key Benefit**: Compare any two audits of the same company to track changes over time.

---

## Table Structure

### 1. `industries` (Reference/Lookup Table - EXISTING)

**Purpose**: Unified industry taxonomy (30 industries). Already exists in Supabase. Enrichment service validates discovered industries against this table.

**⚠️ Note**: This table already exists in the `algolia-arian` Supabase database. Do NOT recreate it.

```sql
-- EXISTING TABLE (from algolia-arian project)
CREATE TABLE industries (
  id SERIAL PRIMARY KEY,

  -- Canonical name (what we display/filter on)
  name VARCHAR(100) UNIQUE NOT NULL,

  -- Slug for URLs/codes
  slug VARCHAR(100) UNIQUE NOT NULL,

  -- Source mappings (for data import matching)
  demandbase_name VARCHAR(100),      -- Original Demandbase name
  zoominfo_names TEXT[],             -- Array of ZoomInfo names that map here

  -- Metadata
  description TEXT,
  display_order INTEGER DEFAULT 999,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Existing indexes
CREATE INDEX idx_industries_slug ON industries(slug);
CREATE INDEX idx_industries_demandbase ON industries(demandbase_name);
```

**Sub-Industries** (hierarchical support):
```sql
CREATE TABLE sub_industries (
  id SERIAL PRIMARY KEY,
  industry_id INTEGER REFERENCES industries(id) ON DELETE CASCADE,
  name VARCHAR(150) UNIQUE NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  demandbase_name VARCHAR(150),
  zoominfo_names TEXT[],
  description TEXT,
  display_order INTEGER DEFAULT 999,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**30 Pre-populated Industries** (already in database):
| ID | Name | Slug | Category |
|----|------|------|----------|
| 1 | Computer Software | `computer-software` | Technology |
| 2 | Computer Hardware | `computer-hardware` | Technology |
| 3 | Telecommunications | `telecommunications` | Technology |
| 4 | Electronics | `electronics` | Technology |
| 10 | Retail | `retail` | Retail & Consumer |
| 11 | Consumer Product Manufacturing | `consumer-product-manufacturing` | Retail & Consumer |
| 12 | Consumer Services | `consumer-services` | Retail & Consumer |
| 20 | Media | `media` | Media & Entertainment |
| 21 | Leisure, Sports and Recreation | `leisure-sports-recreation` | Media & Entertainment |
| 30 | Financial Services | `financial-services` | Financial |
| 31 | Banks | `banks` | Financial |
| 32 | Insurance | `insurance` | Financial |
| 40 | Hospitals and Healthcare | `hospitals-healthcare` | Healthcare |
| 41 | Pharmaceuticals and Biotechnology | `pharma-biotech` | Healthcare |
| 50 | Corporate Services | `corporate-services` | Professional Services |
| 60 | Industrial Manufacturing and Services | `industrial-manufacturing` | Industrial |
| 61 | Construction and Building Materials | `construction-building` | Industrial |
| 62 | Automotive | `automotive` | Industrial |
| 63 | Aerospace and Defense | `aerospace-defense` | Industrial |
| 64 | Chemicals | `chemicals` | Industrial |
| 65 | Mining and Metals | `mining-metals` | Industrial |
| 70 | Energy and Environmental | `energy-environmental` | Energy & Utilities |
| 80 | Food and Beverage | `food-beverage` | Food & Beverage |
| 90 | Transportation | `transportation` | Transportation & Logistics |
| 100 | Real Estate | `real-estate` | Real Estate |
| 110 | Schools and Education | `schools-education` | Education & Government |
| 111 | Government | `government` | Education & Government |
| 112 | Civic, Non-Profit and Membership Groups | `civic-nonprofit` | Education & Government |
| 120 | Holding Companies | `holding-companies` | Holding Companies |
| 130 | Agriculture and Forestry | `agriculture-forestry` | Agriculture |

---

### 2. `companies` (Main Entity - Lightweight)

**Purpose**: Represents a company. Initially just name + domain. Industry is validated during enrichment. All time-series data lives in audit snapshots.

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Initial data (set when company is first created)
  company_name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,

  -- Industry (validated against existing industries table)
  industry_id INTEGER REFERENCES industries(id) ON DELETE SET NULL,

  -- Industry validation tracking
  discovered_industry_text VARCHAR(255),  -- Raw text from enrichment sources
  industry_validation_status VARCHAR(20) DEFAULT 'pending',
  -- 'pending'        → Not yet validated
  -- 'auto_matched'   → Automatically matched to industries table
  -- 'needs_review'   → No match found, requires manual mapping
  -- 'user_confirmed' → User manually selected/confirmed industry
  industry_validated_at TIMESTAMPTZ,

  -- Optional: sub-industry for more granular classification
  sub_industry_id INTEGER REFERENCES sub_industries(id) ON DELETE SET NULL,

  -- Audit tracking metadata
  first_audit_id UUID,              -- FK to first audit
  latest_audit_id UUID,             -- FK to most recent audit
  audit_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name ON companies(company_name);
CREATE INDEX idx_companies_industry ON companies(industry_id);
CREATE INDEX idx_companies_validation_status ON companies(industry_validation_status);
CREATE INDEX idx_companies_latest_audit ON companies(latest_audit_id);
```

**What's NOT in this table**:
- ❌ Revenue (this changes over time → audit_company_data)
- ❌ Traffic (this changes over time → audit_traffic_metrics)
- ❌ Tech stack (this changes over time → audit_tech_stack)
- ❌ Vertical/sub-vertical (more granular categorization → audit_company_data)

**What IS in this table**:
- ✅ Company name (stable)
- ✅ Domain (stable identifier)
- ✅ Industry reference (validated FK)
- ✅ Audit tracking pointers

---

### 3. `audits` (Time-Series Snapshots)

**Purpose**: Each audit is a versioned snapshot of company data at a specific point in time.

```sql
CREATE TABLE audits (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number VARCHAR(20) UNIQUE,  -- AUD-2026-001234

  -- Main relationship
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Snapshot metadata
  audit_date TIMESTAMPTZ DEFAULT NOW(),  -- When this snapshot was taken
  audit_version INTEGER,                  -- Version number (1, 2, 3...)

  -- External relationships
  opportunity_id UUID REFERENCES algolia_opportunities(id) ON DELETE SET NULL,

  -- Audit execution status
  status VARCHAR(20) DEFAULT 'pending',
  -- pending → enriching → testing → scoring → generating → completed / failed

  -- Scores (computed after audit completes)
  overall_audit_score DECIMAL(3,1),       -- 0.0-10.0
  factcheck_score DECIMAL(4,2),           -- 0.00-10.00
  brand_compliance_score DECIMAL(3,1),    -- 0.0-10.0

  -- Progress tracking
  current_phase INTEGER DEFAULT 0,  -- 0-5
  progress_pct DECIMAL(5,2) DEFAULT 0.00,

  -- Configuration
  config JSONB,  -- { mode: 'full', phases: [1,2,3,4,5], custom_queries: [...] }

  -- Audit metadata (populated during audit)
  ticker_symbol VARCHAR(10),           -- Resolved during Phase 1
  margin_zone VARCHAR(20),             -- 'red', 'yellow', 'green'
  vertical_matched VARCHAR(100),       -- Matched vertical

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Unique constraint: only one active audit per company at a time
  UNIQUE(company_id, audit_date)
);

-- Indexes
CREATE INDEX idx_audits_company_id ON audits(company_id);
CREATE INDEX idx_audits_audit_date ON audits(audit_date DESC);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audits_version ON audits(company_id, audit_version DESC);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
```

**Key Insight**: `company_id` is the main FK. All enrichment data for this snapshot references `audit_id`.

---

## Phase 1 Enrichment Data (Time-Series)

All these tables store **point-in-time data** for a specific audit snapshot.

### 3. `audit_company_data` (Company Context Snapshot)

```sql
CREATE TABLE audit_company_data (
  audit_id UUID PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,

  -- Basic info (as of audit_date)
  company_name VARCHAR(255),
  industry VARCHAR(100),
  vertical VARCHAR(100),
  founded_year INT,
  headquarters VARCHAR(255),

  -- Size (as of audit_date)
  employee_count INT,
  employee_count_confidence VARCHAR(20), -- 'FACT', 'ESTIMATE'
  store_count INT,

  -- Financial (high-level, as of audit_date)
  revenue_usd BIGINT,
  revenue_year INT,
  revenue_confidence VARCHAR(20),

  -- Ticker & Classification
  ticker_symbol VARCHAR(10),
  is_public BOOLEAN,
  margin_zone VARCHAR(20), -- 'red', 'yellow', 'green'

  -- Leadership (as of audit_date)
  ceo_name VARCHAR(255),
  ceo_tenure_years INT,
  cfo_name VARCHAR(255),

  -- Timestamps
  data_as_of_date TIMESTAMPTZ,  -- When this data is current for
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_data_audit ON audit_company_data(audit_id);
```

**Version Comparison Query**:
```sql
-- Compare employee count between two audits
SELECT
  a1.audit_date as audit_1_date,
  c1.employee_count as employees_then,
  a2.audit_date as audit_2_date,
  c2.employee_count as employees_now,
  c2.employee_count - c1.employee_count as change,
  ((c2.employee_count - c1.employee_count) * 100.0 / c1.employee_count) as pct_change
FROM audits a1
JOIN audits a2 ON a1.company_id = a2.company_id
JOIN audit_company_data c1 ON c1.audit_id = a1.id
JOIN audit_company_data c2 ON c2.audit_id = a2.id
WHERE a1.company_id = ?
  AND a1.audit_date < a2.audit_date
ORDER BY a1.audit_date DESC
LIMIT 1;  -- Most recent comparison
```

---

### 4. `audit_traffic_metrics` (Traffic Snapshot)

```sql
CREATE TABLE audit_traffic_metrics (
  audit_id UUID PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,

  -- Core traffic (as of audit_date)
  monthly_visits BIGINT,
  bounce_rate DECIMAL(5,2),           -- 0.00-100.00
  pages_per_visit DECIMAL(5,2),
  avg_session_duration_sec INTEGER,

  -- Traffic sources (as of audit_date)
  source_direct_pct DECIMAL(5,2),
  source_search_pct DECIMAL(5,2),
  source_paid_pct DECIMAL(5,2),
  source_social_pct DECIMAL(5,2),
  source_referral_pct DECIMAL(5,2),
  source_mail_pct DECIMAL(5,2),

  -- Geography (top 3 countries)
  top_country_1 VARCHAR(2),            -- ISO code
  top_country_1_pct DECIMAL(5,2),
  top_country_2 VARCHAR(2),
  top_country_2_pct DECIMAL(5,2),
  top_country_3 VARCHAR(2),
  top_country_3_pct DECIMAL(5,2),

  -- SimilarWeb metadata
  sw_data_date VARCHAR(7),             -- '2025-11' (YYYY-MM)
  sw_web_source VARCHAR(20),           -- 'total', 'desktop', 'mobile'
  sw_country VARCHAR(3),               -- 'ww', 'us', etc.

  -- Timestamps
  data_as_of_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_traffic_audit ON audit_traffic_metrics(audit_id);
```

**Version Comparison Query**:
```sql
-- Compare traffic between two audits
SELECT
  a1.audit_date,
  t1.monthly_visits as visits_then,
  a2.audit_date,
  t2.monthly_visits as visits_now,
  ((t2.monthly_visits - t1.monthly_visits) * 100.0 / t1.monthly_visits) as growth_pct
FROM audits a1
JOIN audits a2 ON a1.company_id = a2.company_id
JOIN audit_traffic_metrics t1 ON t1.audit_id = a1.id
JOIN audit_traffic_metrics t2 ON t2.audit_id = a2.id
WHERE a1.company_id = ?
  AND a1.audit_date < a2.audit_date
ORDER BY a1.audit_date DESC
LIMIT 1;
```

---

### 5. `audit_tech_stack` (Tech Stack Snapshot)

```sql
CREATE TABLE audit_tech_stack (
  audit_id UUID PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,

  -- Core technologies (as of audit_date)
  search_provider VARCHAR(100),        -- 'Shopify Native', 'Elasticsearch', 'Algolia'
  search_provider_verified BOOLEAN,    -- Did we verify via network requests?
  ecommerce_platform VARCHAR(100),     -- 'Shopify', 'Magento', 'Custom'
  analytics_provider VARCHAR(100),     -- 'Google Analytics', 'Adobe Analytics'
  tag_manager VARCHAR(100),            -- 'GTM', 'Tealium', 'Segment'
  cdn_provider VARCHAR(100),           -- 'Cloudflare', 'Fastly', 'Akamai'

  -- BuiltWith details
  bw_technologies JSONB,               -- Full tech list from BuiltWith
  bw_removed_technologies JSONB,       -- Tech removed in last 12mo
  bw_added_technologies JSONB,         -- Tech added in last 6mo

  -- Timestamps
  data_as_of_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tech_stack_audit ON audit_tech_stack(audit_id);
CREATE INDEX idx_tech_stack_search_provider ON audit_tech_stack(search_provider);
```

**Version Comparison Query**:
```sql
-- Detect tech stack changes
SELECT
  a1.audit_date as old_audit,
  ts1.search_provider as old_provider,
  a2.audit_date as new_audit,
  ts2.search_provider as new_provider,
  CASE
    WHEN ts1.search_provider != ts2.search_provider THEN 'CHANGED'
    ELSE 'SAME'
  END as change_status
FROM audits a1
JOIN audits a2 ON a1.company_id = a2.company_id
JOIN audit_tech_stack ts1 ON ts1.audit_id = a1.id
JOIN audit_tech_stack ts2 ON ts2.audit_id = a2.id
WHERE a1.company_id = ?
  AND a1.audit_date < a2.audit_date
ORDER BY a1.audit_date DESC
LIMIT 1;
```

---

### 6. `audit_executives` (Leadership Snapshot)

```sql
CREATE TABLE audit_executives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,

  -- Executive details (as of audit_date)
  name VARCHAR(255) NOT NULL,
  title VARCHAR(100),                  -- 'CEO', 'CFO', 'CTO', 'CDO'
  linkedin_url TEXT,
  background TEXT,                     -- Brief background
  tenure_years INT,

  -- Source
  source_url TEXT,                     -- Where we found this info
  confidence VARCHAR(20),              -- 'FACT', 'ESTIMATE'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_executives_audit ON audit_executives(audit_id);
CREATE INDEX idx_executives_title ON audit_executives(audit_id, title);
```

---

### 7. `audit_competitors` (Competitor Snapshot)

```sql
CREATE TABLE audit_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,

  -- Competitor details (as of audit_date)
  competitor_domain VARCHAR(255) NOT NULL,
  competitor_name VARCHAR(255),
  similarity_score DECIMAL(5,2),       -- 0.00-100.00 (from SimilarWeb)

  -- Their tech stack
  search_provider VARCHAR(100),
  ecommerce_platform VARCHAR(100),

  -- Their traffic
  monthly_visits BIGINT,
  bounce_rate DECIMAL(5,2),

  -- Algolia relationship
  uses_algolia BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitors_audit ON audit_competitors(audit_id);
CREATE INDEX idx_competitors_uses_algolia ON audit_competitors(audit_id, uses_algolia);
```

---

### 8. `audit_financial_data` (Multi-Year Financial Snapshot)

```sql
CREATE TABLE audit_financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,

  -- Fiscal period
  fiscal_year INTEGER NOT NULL,        -- 2023, 2024, 2025
  fiscal_quarter VARCHAR(6),           -- 'Q1 2025', 'Q2 2025', or NULL for annual

  -- Financials (as reported in this period)
  revenue_usd BIGINT,
  net_income_usd BIGINT,
  ebitda_usd BIGINT,
  gross_margin_pct DECIMAL(5,2),

  -- Growth metrics
  yoy_revenue_growth_pct DECIMAL(6,2),

  -- Source
  source VARCHAR(50),                  -- 'yahoo_finance', 'sec_10k', 'estimate'
  confidence VARCHAR(20),              -- 'FACT', 'ESTIMATE'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_id, fiscal_year, fiscal_quarter)
);

CREATE INDEX idx_financial_audit ON audit_financial_data(audit_id);
CREATE INDEX idx_financial_year ON audit_financial_data(audit_id, fiscal_year DESC);
```

**Version Comparison Query**:
```sql
-- Compare revenue across audits (same fiscal year)
SELECT
  a1.audit_date as audit_1,
  f1.revenue_usd as revenue_audit_1,
  a2.audit_date as audit_2,
  f2.revenue_usd as revenue_audit_2,
  f2.revenue_usd - f1.revenue_usd as revenue_change
FROM audits a1
JOIN audits a2 ON a1.company_id = a2.company_id
JOIN audit_financial_data f1 ON f1.audit_id = a1.id
JOIN audit_financial_data f2 ON f2.audit_id = a2.id
WHERE a1.company_id = ?
  AND f1.fiscal_year = 2025
  AND f2.fiscal_year = 2025
  AND a1.audit_date < a2.audit_date
ORDER BY a1.audit_date DESC
LIMIT 1;
```

---

### 9. `audit_hiring_signals` (Hiring Snapshot)

```sql
CREATE TABLE audit_hiring_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,

  -- Job posting details (as of audit_date)
  job_title VARCHAR(255),
  job_category VARCHAR(50),            -- 'Engineering', 'Product', 'Data', 'Merchandising'
  job_tier VARCHAR(20),                -- 'Tier 1', 'Tier 2', 'Tier 3' (from taxonomy)
  signal_strength VARCHAR(20),         -- 'STRONG', 'MODERATE', 'WEAK'

  -- Source
  careers_url TEXT,
  posting_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hiring_audit ON audit_hiring_signals(audit_id);
CREATE INDEX idx_hiring_category ON audit_hiring_signals(audit_id, job_category);
```

**Version Comparison Query**:
```sql
-- Compare hiring volume across audits
SELECT
  a1.audit_date,
  COUNT(h1.id) as roles_then,
  a2.audit_date,
  COUNT(h2.id) as roles_now,
  COUNT(h2.id) - COUNT(h1.id) as role_change
FROM audits a1
JOIN audits a2 ON a1.company_id = a2.company_id
LEFT JOIN audit_hiring_signals h1 ON h1.audit_id = a1.id
LEFT JOIN audit_hiring_signals h2 ON h2.audit_id = a2.id
WHERE a1.company_id = ?
  AND a1.audit_date < a2.audit_date
GROUP BY a1.audit_date, a2.audit_date
ORDER BY a1.audit_date DESC
LIMIT 1;
```

---

### 10-13. Other Phase 1 Tables

```sql
-- audit_test_queries (test queries generated for this audit)
-- audit_roi_estimates (ROI calculated for this audit)
-- audit_investor_quotes (executive quotes captured during this audit)
```

*(Same structure as v4, just clarifying they're audit-specific)*

---

## Phase 2-5 Tables (Same as v4)

- `screenshots` (audit-specific)
- `audit_scoring` (audit-specific)
- `deliverables` (audit-specific)
- `execution_logs` (audit-specific)
- `mcp_calls` (audit-specific)

---

## Industry Validation Workflow

### How Industry Matching Works

**Step 1: Enrichment Service Discovers Industry**

During Phase 1 enrichment, multiple sources may provide industry information:
- WebSearch: "Costco is a warehouse club retailer"
- BuiltWith keywords: "retail, wholesale, e-commerce"
- SimilarWeb category: "Shopping > Warehouse Clubs"

**Step 2: Normalize & Attempt Auto-Match**

```typescript
async function validateIndustry(discoveredText: string): Promise<IndustryMatch> {
  // 1. Normalize discovered text
  const normalized = discoveredText.toLowerCase().trim();

  // 2. Try exact match on canonical name
  let match = await db.query(
    'SELECT * FROM industries WHERE LOWER(name) = $1 AND is_active = TRUE',
    [normalized]
  );

  // 3. Try match on demandbase_name (common source)
  if (!match) {
    match = await db.query(`
      SELECT * FROM industries
      WHERE LOWER(demandbase_name) = $1 AND is_active = TRUE
    `, [normalized]);
  }

  // 4. Try fuzzy match on zoominfo_names array
  if (!match) {
    match = await db.query(`
      SELECT * FROM industries
      WHERE $1 = ANY(SELECT LOWER(unnest(zoominfo_names)))
        AND is_active = TRUE
    `, [normalized]);
  }

  // 5. Try partial match (contains)
  if (!match) {
    match = await db.query(`
      SELECT * FROM industries
      WHERE LOWER(name) LIKE '%' || $1 || '%' AND is_active = TRUE
      ORDER BY display_order
      LIMIT 1
    `, [normalized]);
  }

  return match;
}
```

**Step 3: Update Company Record**

```typescript
if (match) {
  // Auto-matched successfully
  await db.query(`
    UPDATE companies
    SET
      industry_id = $1,
      discovered_industry_text = $2,
      industry_validation_status = 'auto_matched',
      industry_validated_at = NOW()
    WHERE id = $3
  `, [match.id, discoveredText, companyId]);
} else {
  // No match found - flag for manual review
  await db.query(`
    UPDATE companies
    SET
      discovered_industry_text = $1,
      industry_validation_status = 'needs_review'
    WHERE id = $2
  `, [discoveredText, companyId]);
}
```

**Step 4: UI Shows Validation Status**

Dashboard displays companies needing industry review:

```typescript
// Get companies needing industry review
const needsReview = await db.query(`
  SELECT
    c.id,
    c.company_name,
    c.domain,
    c.discovered_industry_text,
    c.industry_validation_status
  FROM companies c
  WHERE c.industry_validation_status = 'needs_review'
  ORDER BY c.created_at DESC
`);
```

**Step 5: User Confirms or Corrects**

```typescript
// User selects correct industry from dropdown
async function confirmIndustry(companyId: string, industryId: string) {
  await db.query(`
    UPDATE companies
    SET
      industry_id = $1,
      industry_validation_status = 'user_confirmed',
      industry_validated_at = NOW()
    WHERE id = $2
  `, [industryId, companyId]);
}
```

### UI Mockup: Industry Review Panel

```
┌─────────────────────────────────────────────────────────┐
│ Companies Needing Industry Review (3)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Costco Wholesale (costco.com)                          │
│ Discovered: "Warehouse Club & Supercenters"            │
│ ⚠️  No matching industry found                         │
│                                                         │
│ [Select Industry ▼]                                    │
│   - Retail                                             │
│   - E-commerce                                         │
│   - Marketplace                                        │
│   - + Add New Industry                                 │
│                                                         │
│ [Confirm] [Skip]                                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Nike (nike.com)                                        │
│ Discovered: "Athletic Apparel & Footwear Mfg"         │
│ ⚠️  No matching industry found                         │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### Industry Validation States

| Status | Meaning | Action Required | UI Display |
|--------|---------|-----------------|------------|
| `pending` | Enrichment not yet run | Wait for Phase 1 to complete | 🟡 Pending |
| `auto_matched` | System found a match | None | ✅ Validated |
| `needs_review` | No match found in industries table | User must select from dropdown | ⚠️ Needs Review |
| `user_confirmed` | User manually selected industry | None | ✅ Confirmed |

### Adding New Industries

If discovered industry doesn't exist in existing 30 industries, admin can add it:

**Option 1: Via Supabase Dashboard**
1. Go to Supabase Table Editor → `industries`
2. Insert new row with:
   - `name`: "E-commerce" (canonical display name)
   - `slug`: "ecommerce" (URL-friendly)
   - `demandbase_name`: mapping for Demandbase sources
   - `zoominfo_names`: `{'online retail', 'digital commerce'}` (array)
   - `display_order`: 15 (controls sort order)

**Option 2: Via SQL Migration**
```sql
INSERT INTO industries (name, slug, demandbase_name, zoominfo_names, display_order)
VALUES (
  'E-commerce',
  'ecommerce',
  'E-commerce',
  ARRAY['online retail', 'digital commerce', 'internet retail'],
  15
);
```

Then reprocess companies with `needs_review` status:
```typescript
// Retry validation for companies needing review
const needsReview = await db.query(`
  SELECT id, discovered_industry_text
  FROM companies
  WHERE industry_validation_status = 'needs_review'
`);

for (const company of needsReview.rows) {
  const match = await validateIndustry(company.discovered_industry_text);
  if (match) {
    await db.query(`
      UPDATE companies
      SET industry_id = $1,
          industry_validation_status = 'auto_matched',
          industry_validated_at = NOW()
      WHERE id = $2
    `, [match.id, company.id]);
  }
}
```

---

## Key Time-Series Queries

### 1. Get Latest Audit for Company

```sql
SELECT a.*,
       cd.employee_count,
       tm.monthly_visits,
       ts.search_provider
FROM companies c
JOIN audits a ON a.id = c.latest_audit_id
LEFT JOIN audit_company_data cd ON cd.audit_id = a.id
LEFT JOIN audit_traffic_metrics tm ON tm.audit_id = a.id
LEFT JOIN audit_tech_stack ts ON ts.audit_id = a.id
WHERE c.id = ?;
```

### 2. Compare Two Most Recent Audits

```sql
WITH ranked_audits AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY audit_date DESC) as rn
  FROM audits
  WHERE company_id = ?
)
SELECT
  a1.audit_date as latest_date,
  cd1.revenue_usd as latest_revenue,
  tm1.monthly_visits as latest_traffic,
  a2.audit_date as previous_date,
  cd2.revenue_usd as previous_revenue,
  tm2.monthly_visits as previous_traffic,
  ((cd1.revenue_usd - cd2.revenue_usd) * 100.0 / cd2.revenue_usd) as revenue_change_pct,
  ((tm1.monthly_visits - tm2.monthly_visits) * 100.0 / tm2.monthly_visits) as traffic_change_pct
FROM ranked_audits a1
JOIN ranked_audits a2 ON a1.company_id = a2.company_id
LEFT JOIN audit_company_data cd1 ON cd1.audit_id = a1.id
LEFT JOIN audit_company_data cd2 ON cd2.audit_id = a2.id
LEFT JOIN audit_traffic_metrics tm1 ON tm1.audit_id = a1.id
LEFT JOIN audit_traffic_metrics tm2 ON tm2.audit_id = a2.id
WHERE a1.rn = 1 AND a2.rn = 2;
```

### 3. Audit History for Company

```sql
SELECT
  a.audit_date,
  a.overall_audit_score,
  cd.revenue_usd,
  cd.employee_count,
  tm.monthly_visits,
  ts.search_provider,
  COUNT(hs.id) as hiring_roles_count
FROM audits a
LEFT JOIN audit_company_data cd ON cd.audit_id = a.id
LEFT JOIN audit_traffic_metrics tm ON tm.audit_id = a.id
LEFT JOIN audit_tech_stack ts ON ts.audit_id = a.id
LEFT JOIN audit_hiring_signals hs ON hs.audit_id = a.id
WHERE a.company_id = ?
GROUP BY a.id, a.audit_date, a.overall_audit_score, cd.revenue_usd,
         cd.employee_count, tm.monthly_visits, ts.search_provider
ORDER BY a.audit_date DESC;
```

---

## Auto-Update Triggers

```sql
-- Update company metadata when audit completes
CREATE OR REPLACE FUNCTION update_company_after_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE companies
    SET
      latest_audit_id = NEW.id,
      audit_count = audit_count + 1,
      updated_at = NOW()
    WHERE id = NEW.company_id;

    -- Set first_audit_id if this is the first audit
    UPDATE companies
    SET first_audit_id = NEW.id
    WHERE id = NEW.company_id AND first_audit_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_completion_trigger
AFTER UPDATE ON audits
FOR EACH ROW
EXECUTE FUNCTION update_company_after_audit();
```

---

## Summary: v5 Key Changes

| Aspect | v4 (Old) | v5 (New - Time-Series) |
|--------|----------|------------------------|
| **Main Entity** | `audits` | `companies` |
| **Audit FK** | `audits.target_company_id` (optional) | `audits.company_id` (required) |
| **Enrichment Data** | Tied to audit_id (same) | Tied to audit_id (same) BUT versioned |
| **Version Comparison** | Not supported | ✅ Supported via audit_date queries |
| **Companies Table** | Has enrichment data | Lean (just name, domain, pointers) |
| **Use Case** | Single audit snapshots | Time-series analysis, trend detection |

**Key Benefit**: "What changed between June and December?" becomes a simple SQL query.
