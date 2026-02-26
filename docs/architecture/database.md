# Database Schema

This document describes the database schema for PartnerForge.

---

## Overview

PartnerForge uses SQLite for development and PostgreSQL for production. Both use the same schema.

**Connection:**
- Development: `data/partnerforge.db` (SQLite)
- Production: `DATABASE_URL` environment variable (PostgreSQL)

**Total Tables:** 17
**Total Records:** ~3,500+

---

## Entity Relationship Diagram

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   displacement_targets  │         │       companies         │
│        (2,687)          │         │        (400)            │
├─────────────────────────┤         ├─────────────────────────┤
│ id (PK)                 │         │ id (PK)                 │
│ domain (UNIQUE)         │◄───────►│ domain (UNIQUE)         │
│ company_name            │         │ name                    │
│ partner_tech            │         │ is_algolia_customer     │
│ vertical                │         │ algolia_arr             │
│ icp_score               │         └─────────────────────────┘
│ ...                     │
└─────────────────────────┘
            │
            │ matched_case_studies (JSON)
            ▼
┌─────────────────────────┐
│      case_studies       │
│        (161)            │
├─────────────────────────┤
│ id (PK)                 │
│ customer_domain         │
│ vertical                │
│ use_case                │
└─────────────────────────┘
```

---

## Core Tables

### 1. displacement_targets

Primary table containing all displacement target companies.

```sql
CREATE TABLE displacement_targets (
    -- Identity
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT UNIQUE NOT NULL,
    company_name          TEXT,
    partner_tech          TEXT,           -- e.g., "Adobe AEM"

    -- Location
    vertical              TEXT,           -- e.g., "Commerce"
    country               TEXT,
    city                  TEXT,
    state                 TEXT,

    -- Contact
    tech_spend            INTEGER,        -- Annual tech budget (USD)
    emails                TEXT,           -- JSON array
    phones                TEXT,           -- JSON array
    socials               TEXT,           -- JSON array
    exec_titles           TEXT,           -- JSON array

    -- SimilarWeb Traffic
    sw_monthly_visits     INTEGER,
    sw_bounce_rate        REAL,           -- Percentage (0-100)
    sw_pages_per_visit    REAL,
    sw_avg_duration       INTEGER,        -- Seconds
    sw_search_traffic_pct REAL,           -- Percentage
    sw_rank_global        INTEGER,

    -- ICP Scoring
    icp_tier              INTEGER,        -- 1=hot, 2=warm, 3=cool, 4=cold
    icp_score             INTEGER,        -- 0-100
    icp_tier_name         TEXT,           -- "hot", "warm", "cool", "cold"
    score_reasons         TEXT,           -- JSON: breakdown explanation
    score_breakdown       TEXT,           -- JSON: component scores

    -- Financial
    ticker                TEXT,           -- Stock symbol
    is_public             INTEGER,        -- Boolean (0/1)
    revenue               REAL,           -- Annual revenue (USD)
    gross_margin          REAL,           -- Percentage
    traffic_growth        REAL,           -- YoY percentage

    -- Intelligence
    current_search        TEXT,           -- Current search provider
    trigger_events        TEXT,           -- Recent business events
    exec_quote            TEXT,           -- Executive quote
    exec_name             TEXT,
    exec_title            TEXT,
    quote_source          TEXT,           -- Source of quote
    competitors_using_algolia TEXT,       -- Comma-separated
    displacement_angle    TEXT,           -- Sales messaging

    -- Case Studies
    matched_case_studies  TEXT,           -- JSON array of case study names
    lead_score            INTEGER,        -- Alternative scoring

    -- Enrichment
    enrichment_level      TEXT DEFAULT 'basic',  -- "basic", "standard", "full"
    last_enriched         TIMESTAMP,
    financials_json       TEXT,           -- JSON: detailed financials
    hiring_signals        TEXT,           -- JSON: job posting analysis
    tech_stack_json       TEXT,           -- JSON: full tech stack

    -- Metadata
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_targets_icp_score ON displacement_targets(icp_score DESC);
CREATE INDEX idx_targets_vertical ON displacement_targets(vertical);
CREATE INDEX idx_targets_partner_tech ON displacement_targets(partner_tech);
CREATE INDEX idx_targets_icp_tier ON displacement_targets(icp_tier);
```

**Sample Data:**
| domain | company_name | icp_score | vertical | partner_tech |
|--------|--------------|-----------|----------|--------------|
| mercedes-benz.com | Mercedes-Benz | 95 | Automotive | Adobe AEM |
| costco.com | Costco Wholesale | 75 | Commerce | Adobe AEM |
| allianz.com | Allianz | 85 | Financial | Adobe AEM |

---

### 2. companies

Existing Algolia customers (exclusion list).

```sql
CREATE TABLE companies (
    -- Identity
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT UNIQUE NOT NULL,
    name                  TEXT,

    -- Classification
    vertical              TEXT,
    sub_vertical          TEXT,
    country               TEXT,
    country_code          TEXT,           -- ISO 2-letter

    -- Algolia Status
    is_algolia_customer   INTEGER DEFAULT 1,  -- Boolean
    algolia_arr           REAL,           -- Annual recurring revenue
    algolia_products      TEXT,           -- JSON array of products
    algolia_cs_coverage   TEXT,           -- CS tier

    -- Consent
    has_logo_rights       INTEGER DEFAULT 0,
    has_case_study_consent INTEGER DEFAULT 0,
    has_reference_consent INTEGER DEFAULT 0,

    -- Partner
    partner_populations   TEXT,           -- JSON array

    -- History
    signed_date           TEXT,
    competitor_displaced  TEXT,
    tech_platform         TEXT,
    notes                 TEXT,

    -- Metadata
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_vertical ON companies(vertical);
```

**Sample Data:**
| domain | name | algolia_arr | vertical |
|--------|------|-------------|----------|
| nike.com | Nike | 500000 | Retail |
| twitch.tv | Twitch | 250000 | Media |
| stripe.com | Stripe | 150000 | Technology |

---

### 3. case_studies

Documented customer success stories.

```sql
CREATE TABLE case_studies (
    -- Identity
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name         TEXT NOT NULL,
    customer_domain       TEXT,
    company_id            INTEGER REFERENCES companies(id),

    -- Classification
    country               TEXT,
    region                TEXT,
    vertical              TEXT,
    sub_vertical          TEXT,
    use_case              TEXT,           -- e.g., "eCommerce Search"
    customer_type         TEXT,           -- e.g., "Enterprise"

    -- Assets
    story_url             TEXT,           -- Published case study URL
    slide_deck_url        TEXT,
    pdf_url               TEXT,
    status                TEXT DEFAULT 'Complete',

    -- Details
    features_used         TEXT,           -- JSON array
    partner_integrations  TEXT,           -- JSON array
    competitor_takeout    TEXT,           -- Displaced competitor
    key_results           TEXT,           -- Quantified results
    localized_urls        TEXT,           -- JSON: {"fr": "url", "de": "url"}

    -- Metadata
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_case_studies_vertical ON case_studies(vertical);
CREATE INDEX idx_case_studies_use_case ON case_studies(use_case);
```

**Sample Data:**
| customer_name | vertical | use_case | key_results |
|---------------|----------|----------|-------------|
| Lacoste | Retail | eCommerce Search | 150% conversion increase |
| Under Armour | Retail | Site Search | 37% search revenue lift |
| Decathlon | Retail | Omnichannel | 50% faster search |

---

## Supporting Tables

### 4. executive_quotes

Quotes from executives for intelligence.

```sql
CREATE TABLE executive_quotes (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT NOT NULL,
    speaker_name          TEXT NOT NULL,
    speaker_title         TEXT,
    quote                 TEXT NOT NULL,

    source_type           TEXT,           -- "earnings_call", "10-K", etc.
    source_name           TEXT,
    source_url            TEXT,
    quote_date            TEXT,

    maps_to_product       TEXT,           -- Algolia product relevance
    relevance_score       INTEGER,        -- 0-100

    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(domain, quote)
);
```

### 5. hiring_signals

Job posting analysis.

```sql
CREATE TABLE hiring_signals (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT NOT NULL,
    role_title            TEXT NOT NULL,
    team                  TEXT,           -- "Engineering", "Product", etc.
    seniority             TEXT,           -- "VP", "Director", "IC"

    signal_type           TEXT,           -- "hot", "warm", "technical"
    signal_reason         TEXT,
    keywords_found        TEXT,           -- Comma-separated

    careers_url           TEXT,
    job_url               TEXT,
    last_seen             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(domain, role_title)
);
```

### 6. strategic_triggers

Business events indicating buying readiness.

```sql
CREATE TABLE strategic_triggers (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT NOT NULL,
    trigger_type          TEXT,           -- "expansion", "migration", etc.
    trigger_category      TEXT,           -- "positive", "negative", "neutral"
    title                 TEXT NOT NULL,
    description           TEXT,
    source_url            TEXT,
    source_date           TEXT,

    algolia_angle         TEXT,           -- How this connects to Algolia
    priority              INTEGER,        -- 1-5

    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(domain, title)
);
```

### 7. buying_committee

Key stakeholders at target accounts.

```sql
CREATE TABLE buying_committee (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT NOT NULL,
    name                  TEXT NOT NULL,
    title                 TEXT,
    linkedin_url          TEXT,
    email                 TEXT,

    buyer_role            TEXT,           -- "economic", "technical", "user"
    priority              TEXT,           -- "hot", "warm", "cold"
    priority_reason       TEXT,

    tenure                TEXT,
    previous_company      TEXT,
    notes                 TEXT,

    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(domain, name)
);
```

### 8. company_financials

Detailed financial data.

```sql
CREATE TABLE company_financials (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT NOT NULL UNIQUE,
    ticker                TEXT,
    company_name          TEXT,

    -- Revenue (3 years)
    revenue_fy2023        REAL,
    revenue_fy2024        REAL,
    revenue_fy2025        REAL,
    revenue_cagr          REAL,

    -- Net Income
    net_income_fy2023     REAL,
    net_income_fy2024     REAL,
    net_income_fy2025     REAL,

    -- EBITDA & Margins
    ebitda_fy2025         REAL,
    ebitda_margin         REAL,
    margin_zone           TEXT,           -- "green", "yellow", "red"

    -- E-commerce
    ecommerce_revenue     REAL,
    ecommerce_percent     REAL,
    ecommerce_growth      REAL,

    -- Stock
    market_cap            REAL,
    stock_price           REAL,
    price_change_1y       REAL,

    -- Analyst
    analyst_rating        TEXT,           -- "strong_buy", "buy", etc.
    analyst_target_price  REAL,

    -- Metadata
    data_source           TEXT DEFAULT 'yahoo_finance',
    confidence            TEXT DEFAULT 'high',
    last_updated          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 9. competitive_intel

Competitor search provider analysis.

```sql
CREATE TABLE competitive_intel (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    domain                TEXT NOT NULL UNIQUE,
    company_name          TEXT,

    search_provider       TEXT,           -- "Elasticsearch", "Solr", etc.
    search_provider_score INTEGER,        -- Quality assessment

    algolia_opportunity   TEXT,           -- Why they should switch

    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## JSON Field Structures

### emails (displacement_targets.emails)
```json
["contact@company.com", "sales@company.com"]
```

### score_breakdown (displacement_targets.score_breakdown)
```json
{
  "vertical": 25,
  "traffic": 30,
  "tech_spend": 20,
  "partner_tech": 10
}
```

### tech_stack_json (displacement_targets.tech_stack_json)
```json
{
  "cms": ["Adobe AEM"],
  "search": ["Elasticsearch"],
  "analytics": ["Google Analytics 4"],
  "cdp": ["Segment"],
  "ecommerce": ["Salesforce Commerce Cloud"]
}
```

### financials_json (displacement_targets.financials_json)
```json
{
  "revenue_fy2025": 242300000000,
  "revenue_fy2024": 226900000000,
  "revenue_cagr": 6.8,
  "ebitda_margin": 4.2,
  "gross_margin": 11.2,
  "market_cap": 350000000000
}
```

### hiring_signals (displacement_targets.hiring_signals)
```json
{
  "total_openings": 45,
  "search_related": 3,
  "data_engineering": 12,
  "hot_signals": ["Sr. Search Engineer", "VP, Digital Experience"]
}
```

### matched_case_studies (displacement_targets.matched_case_studies)
```json
["Lacoste Case Study", "Under Armour Success Story"]
```

---

## Migrations

### Creating Tables (SQLite)

```sql
-- Run in order:
-- 1. Core tables
CREATE TABLE IF NOT EXISTS displacement_targets (...);
CREATE TABLE IF NOT EXISTS companies (...);
CREATE TABLE IF NOT EXISTS case_studies (...);

-- 2. Supporting tables
CREATE TABLE IF NOT EXISTS executive_quotes (...);
CREATE TABLE IF NOT EXISTS hiring_signals (...);
CREATE TABLE IF NOT EXISTS strategic_triggers (...);
CREATE TABLE IF NOT EXISTS buying_committee (...);
CREATE TABLE IF NOT EXISTS company_financials (...);
CREATE TABLE IF NOT EXISTS competitive_intel (...);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_targets_icp_score ...;
```

### Adding Columns

```sql
-- Example: Adding a new column
ALTER TABLE displacement_targets
ADD COLUMN new_field TEXT;
```

---

## Backup & Restore

### SQLite Backup

```bash
# Backup
cp data/partnerforge.db data/partnerforge.db.backup

# Restore
cp data/partnerforge.db.backup data/partnerforge.db
```

### PostgreSQL Backup

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

## Performance Notes

### Indexes
- Primary queries use `icp_score DESC` — indexed
- Filtering by `vertical`, `partner_tech` — indexed
- Domain lookups — UNIQUE constraint provides index

### Query Optimization
- Use pagination for large result sets (default: 50)
- Filter by status before sorting
- Use `search` parameter for text matching

### Common Queries

```sql
-- Hot leads
SELECT * FROM displacement_targets
WHERE icp_tier = 1
ORDER BY icp_score DESC;

-- Commerce targets with high traffic
SELECT * FROM displacement_targets
WHERE vertical = 'Commerce'
  AND sw_monthly_visits > 1000000
ORDER BY icp_score DESC;

-- Targets not in customer list
SELECT dt.* FROM displacement_targets dt
LEFT JOIN companies c ON dt.domain = c.domain
WHERE c.id IS NULL;
```
