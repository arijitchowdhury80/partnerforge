# PartnerForge - Product Requirements Document

## Executive Summary

**PartnerForge** is an internal SaaS platform for Algolia's Sales & Commercial team that provides partner-powered account-based intelligence. It combines technology stack data (BuiltWith), traffic intelligence (SimilarWeb), partner ecosystem data (Crossbeam), and Algolia's customer evidence to generate qualified lead lists for co-sell motions, displacement campaigns, and competitive positioning.

---

## Problem Statement

Sales teams spend significant time manually researching:
1. Which prospects use a partner technology (Adobe, Shopify, Salesforce, etc.)?
2. Which of those prospects DON'T yet use Algolia (displacement opportunities)?
3. Who are the competitors of a target account, and what search tech do they use?
4. Which Algolia case studies are most relevant to a given prospect?

This manual research is:
- Time-consuming (2-4 hours per account)
- Inconsistent (different reps use different sources)
- Not scalable (can't research 500 accounts at once)
- Not persistent (research isn't stored or shared)

---

## Solution

PartnerForge automates this intelligence gathering and provides:

1. **Co-Sell Lists**: Companies using BOTH Algolia + Partner Tech
2. **Displacement Lists**: Companies using Partner Tech but NOT Algolia
3. **Competitive Intelligence**: Given a target company, find competitors and their tech stacks
4. **Case Study Matching**: Auto-recommend relevant Algolia case studies based on industry, tech stack, and use case
5. **Enriched Profiles**: Traffic data, engagement metrics, and partner pipeline status

---

## Users

| Role | Primary Use Case |
|------|------------------|
| Account Executives | Pre-call research, competitive positioning |
| SDRs/BDRs | Prospecting list generation, outreach prioritization |
| Partner Managers | Co-sell list building, partner QBR prep |
| Sales Leadership | Pipeline coverage analysis, territory planning |

**Estimated Users**: 50-100 (Algolia Sales & Commercial team)

---

## MVP Scope (Phase 1)

### Use Case A: Co-Sell List Generation
**Input**: Partner technology (e.g., "Adobe Experience Manager")
**Output**: List of companies using BOTH Algolia AND the partner tech, enriched with traffic data

### Use Case B: Displacement List Generation
**Input**: Partner technology (e.g., "Shopify")
**Output**: List of companies using the partner tech but NOT Algolia

### Use Case C: Competitive Intelligence
**Input**: Target company domain (e.g., "costco.com")
**Output**:
- List of competitors (from SimilarWeb + BuiltWith)
- Each competitor's search technology
- Relevant Algolia case studies from that vertical

---

## Data Sources

### Primary Sources (MVP)

| Source | Data Type | Refresh | API |
|--------|-----------|---------|-----|
| **BuiltWith** | Technology stacks, company metadata | Weekly | lists8, domain-lookup, relationships-api |
| **SimilarWeb** | Traffic, engagement, similar sites | Weekly | 14 endpoints via MCP |
| **Customer Evidence Excel** | Case studies, quotes, logos | On-demand import | Manual upload |

### Phase 2 Sources

| Source | Data Type | Refresh | API |
|--------|-----------|---------|-----|
| **Crossbeam** | Partner pipeline overlaps | Daily | MCP (Limited Availability) |
| **Salesforce** | Algolia pipeline/customer status | Real-time | Salesforce API |

---

## Database Schema

### Core Tables

```sql
-- Companies master table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    vertical VARCHAR(100),
    country VARCHAR(2),

    -- BuiltWith data
    bw_spend_estimate INTEGER,
    bw_first_indexed TIMESTAMP,
    bw_last_indexed TIMESTAMP,

    -- SimilarWeb data
    sw_monthly_visits BIGINT,
    sw_visits_growth_pct DECIMAL(5,2),
    sw_bounce_rate DECIMAL(5,2),
    sw_pages_per_visit DECIMAL(5,2),
    sw_avg_visit_duration INTEGER, -- seconds
    sw_search_traffic_pct DECIMAL(5,2), -- KEY ALGOLIA SIGNAL
    sw_rank_global INTEGER,
    sw_rank_country INTEGER,

    -- Algolia status
    is_algolia_customer BOOLEAN DEFAULT FALSE,
    algolia_arr DECIMAL(12,2),
    algolia_products TEXT[], -- ['Search', 'Recommend', 'NeuralSearch']

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    bw_updated_at TIMESTAMP,
    sw_updated_at TIMESTAMP
);

-- Technologies catalog
CREATE TABLE technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100), -- 'CMS', 'Search', 'Ecommerce', etc.
    is_partner BOOLEAN DEFAULT FALSE, -- Adobe, Shopify, Salesforce, etc.
    is_competitor BOOLEAN DEFAULT FALSE, -- Coveo, Elastic, etc.
    builtwith_name VARCHAR(255), -- Exact name in BuiltWith
    created_at TIMESTAMP DEFAULT NOW()
);

-- Company-Technology junction (what tech each company uses)
CREATE TABLE company_technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    technology_id UUID REFERENCES technologies(id) ON DELETE CASCADE,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    is_live BOOLEAN DEFAULT TRUE,
    source VARCHAR(50), -- 'builtwith', 'similarweb', 'manual'
    UNIQUE(company_id, technology_id)
);

-- Competitor relationships
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_a_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    company_b_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    source VARCHAR(50), -- 'similarweb', 'builtwith', 'both'
    confidence_score INTEGER CHECK (confidence_score BETWEEN 1 AND 100),
    similarity_score DECIMAL(5,2), -- SimilarWeb similarity
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_a_id, company_b_id)
);

-- Case studies from Customer Evidence
CREATE TABLE case_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    customer_domain VARCHAR(255),
    country VARCHAR(100),
    region VARCHAR(50),
    vertical VARCHAR(100),
    use_case VARCHAR(100),
    story_url TEXT,
    slide_deck_url TEXT,
    status VARCHAR(50), -- 'Complete', 'DRAFT', etc.

    -- Feature flags (from Cust. Stories sheet)
    features_used TEXT[], -- ['NeuralSearch', 'Personalization', 'Recommend']

    -- Results
    competitor_takeout VARCHAR(255),
    partner_integrations TEXT[],
    key_results TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Customer quotes/testimonials
CREATE TABLE customer_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255),
    contact_name VARCHAR(255),
    contact_title VARCHAR(255),
    vertical VARCHAR(100),
    country VARCHAR(100),
    quote_text TEXT NOT NULL,
    source VARCHAR(100), -- 'TechValidate', 'G2', 'TrustRadius'
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Proof points (aggregated stats)
CREATE TABLE proof_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical VARCHAR(100),
    theme VARCHAR(100), -- 'Conversion', 'Revenue', 'Speed'
    result_text TEXT NOT NULL,
    source VARCHAR(100),
    is_shareable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lead lists (saved queries)
CREATE TABLE lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID, -- User ID from Supabase Auth
    filters JSONB, -- Store the filter criteria
    list_type VARCHAR(50), -- 'cosell', 'displacement', 'competitive'
    partner_tech VARCHAR(255),
    target_company VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Lead list members
CREATE TABLE lead_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES lead_lists(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    score INTEGER, -- Lead score
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'disqualified'
    notes TEXT,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(list_id, company_id)
);

-- Indexes for performance
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_vertical ON companies(vertical);
CREATE INDEX idx_companies_is_algolia ON companies(is_algolia_customer);
CREATE INDEX idx_company_tech_company ON company_technologies(company_id);
CREATE INDEX idx_company_tech_tech ON company_technologies(technology_id);
CREATE INDEX idx_competitors_a ON competitors(company_a_id);
CREATE INDEX idx_competitors_b ON competitors(company_b_id);
CREATE INDEX idx_case_studies_vertical ON case_studies(vertical);
CREATE INDEX idx_lead_list_members_list ON lead_list_members(list_id);
```

### Partner Technologies (Seed Data)

```sql
INSERT INTO technologies (name, category, is_partner, builtwith_name) VALUES
-- Adobe Ecosystem
('Adobe Experience Manager', 'CMS', true, 'Adobe Experience Manager'),
('Adobe Commerce', 'Ecommerce', true, 'Magento'),
('Adobe Experience Platform', 'CDP', true, 'Adobe Experience Platform'),
('Adobe Analytics', 'Analytics', true, 'Adobe Analytics'),

-- Shopify Ecosystem
('Shopify', 'Ecommerce', true, 'Shopify'),
('Shopify Plus', 'Ecommerce', true, 'Shopify Plus'),

-- Salesforce Ecosystem
('Salesforce Commerce Cloud', 'Ecommerce', true, 'Salesforce Commerce Cloud'),
('Salesforce', 'CRM', true, 'Salesforce'),

-- Commercetools
('commercetools', 'Ecommerce', true, 'commercetools'),

-- Other Partners
('BigCommerce', 'Ecommerce', true, 'BigCommerce'),
('SAP Commerce Cloud', 'Ecommerce', true, 'SAP Commerce Cloud'),
('Contentful', 'CMS', true, 'Contentful'),
('Sanity', 'CMS', true, 'Sanity'),

-- Competitors (for tracking)
('Coveo', 'Search', false, 'Coveo'),
('Elasticsearch', 'Search', false, 'Elasticsearch'),
('Bloomreach', 'Search', false, 'Bloomreach'),
('Constructor.io', 'Search', false, 'Constructor'),
('Lucidworks', 'Search', false, 'Lucidworks'),
('Searchspring', 'Search', false, 'Searchspring'),
('Klevu', 'Search', false, 'Klevu');
```

---

## API Endpoints (Edge Functions)

### MVP Endpoints

```
POST /api/lists/cosell
Body: { partner_tech: "Adobe Experience Manager", filters: { country: "US", min_traffic: 100000 } }
Returns: List of companies using Algolia + partner tech

POST /api/lists/displacement
Body: { partner_tech: "Shopify", filters: { vertical: "Fashion" } }
Returns: List of companies using partner tech but NOT Algolia

POST /api/competitive/{domain}
Body: { domain: "costco.com" }
Returns: { competitors: [...], tech_stacks: {...}, case_studies: [...] }

GET /api/companies/{domain}
Returns: Full company profile with all enriched data

POST /api/sync/builtwith
Body: { tech: "Algolia" }
Triggers: Background sync of BuiltWith data for technology

POST /api/sync/similarweb/{domain}
Triggers: Enrich a single company with SimilarWeb data
```

---

## User Interface

### Dashboard Views

1. **Partner Co-Sell**
   - Select partner technology from dropdown
   - Apply filters (country, vertical, min traffic)
   - View/export co-sell list
   - See matching case studies

2. **Displacement Finder**
   - Select partner technology
   - See companies using partner but NOT Algolia
   - Prioritized by traffic/engagement
   - One-click to export

3. **Competitive Intel**
   - Enter target company domain
   - See competitors (SimilarWeb + BuiltWith)
   - See each competitor's search tech
   - Matching case studies for the vertical

4. **Company Profile**
   - Full 360° view of any company
   - Tech stack, traffic, competitors
   - Recommended case studies
   - Notes and status tracking

---

## Data Refresh Strategy

| Data | Frequency | Trigger |
|------|-----------|---------|
| BuiltWith tech lists | Weekly (Sunday) | pg_cron |
| SimilarWeb traffic | Weekly (Monday) | pg_cron |
| Case study import | On-demand | Manual upload |
| Company enrichment | On first access + weekly | API call + pg_cron |

### Rate Limit Management

| API | Limit | Strategy |
|-----|-------|----------|
| BuiltWith | ~1000 calls/day | Batch sync, cache aggressively |
| SimilarWeb | ~500 calls/day | Enrich on-demand, cache 7 days |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to generate co-sell list | < 30 seconds |
| Lists generated per week | 50+ |
| User adoption | 80% of sales team |
| Data freshness | < 7 days old |

---

## Development Phases

### Phase 1: MVP (Week 1-2)
- [x] Database schema
- [ ] Supabase project setup
- [ ] BuiltWith sync (lists8 API)
- [ ] SimilarWeb enrichment
- [ ] Case study import from Excel
- [ ] Basic UI: Co-sell, Displacement, Competitive Intel
- [ ] CSV export

### Phase 2: Intelligence (Week 3)
- [ ] Lead scoring algorithm
- [ ] Case study matching by vertical + tech
- [ ] Competitor detection (merge BW + SW)
- [ ] Saved lists with filters

### Phase 3: Integrations (Week 4+)
- [ ] Crossbeam MCP integration
- [ ] Salesforce sync
- [ ] Slack alerts (tech stack changes)
- [ ] HubSpot export

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (Google SSO) |
| Backend | Supabase Edge Functions (Deno) |
| Frontend | React + Tailwind + shadcn/ui |
| Hosting | Vercel |
| Scheduling | Supabase pg_cron |

---

## Open Questions

1. Should we allow non-Algolia employees to access (for partner co-sell)?
2. How do we handle companies with multiple domains?
3. Should we track historical tech stack changes?
4. Integration priority: Salesforce or HubSpot first?

---

## Appendix: Customer Evidence Data Structure

From `Customer Evidence - Algolia.xlsx`:

| Sheet | Records | Key Fields |
|-------|---------|------------|
| Cust.Logos | 1,307 | Company, Industry, Tech, Competitor |
| Cust.Quotes | 379 | Customer, Quote, Industry, Source |
| Cust. Stories | 82 | Customer, URL, Features Used, Industry |
| Case Studies | 134 | Customer, Partner/Integration, Results |
| Adobe | 390 | Account, Partner Population (Commerce/AEM/AEP), ARR |
| Fashion | 170 | Fashion-specific customers |
| Grocery | 54 | Grocery-specific customers |
| $100K+ ARR | 546 | High-value customers |

---

*Document Version: 1.0*
*Created: 2026-02-25*
*Author: Claude + Arijit*
