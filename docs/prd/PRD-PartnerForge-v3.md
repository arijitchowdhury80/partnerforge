# PartnerForge PRD v3.0
## Partner Intelligence Platform for Algolia GTM

**Last Updated:** 2026-02-26
**Status:** Planning
**Author:** Arijit Chowdhury + Claude

---

## Executive Summary

PartnerForge is evolving from a simple displacement target finder into a **unified GTM account intelligence platform** that centralizes enrichment data from **34 data sources** across **8 signal categories** into a single AI-interpreted, confidence-scored, decay-aware view.

**Core Value Proposition:**
> "The only platform that merges external market intelligence, internal engagement signals, partner ecosystem data, and financial health indicators into a single, AI-interpreted, confidence-scored account view."

---

## Part 1: Current State (v2.x)

### What We Have Today

| Component | Status | Description |
|-----------|--------|-------------|
| **Database** | Supabase | Single `displacement_targets` table with 2,737 records |
| **Frontend** | Vercel | React dashboard at partnerforge.vercel.app |
| **Data Sources** | 2 active | BuiltWith (tech detection), SimilarWeb (traffic) |
| **Partners** | 4 | Adobe AEM (2,687), Adobe Commerce (18), Amplience (20), Spryker (12) |

### Current Data Model (Flat)

```sql
displacement_targets (
  id, domain, company_name, partner_tech, vertical, country,
  icp_score, icp_tier, sw_monthly_visits, revenue, ...
)
```

**Problems with Current Design:**
1. Single flat table - no normalization
2. One partner_tech per company (reality: companies use multiple)
3. No signal history or decay tracking
4. No gap-to-feature mapping
5. No trigger event detection
6. Can't support union/intersection queries across partners

---

## Part 2: Vision (v3.0+)

### The Campaign Query We Want to Enable

```
"Adobe AEM customers, $5M-$10M revenue, 5+ years tenure,
 NOT using Algolia, with semantic search gap identified,
 hiring for 'search engineer' roles, traffic growing 20%+"

→ 47 companies
→ $12M addressable pipeline
→ Export to Salesforce campaign
```

### 34 Data Sources Across 8 Categories

#### Category 1: Firmographic & Financial (Core)

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 1 | ZoomInfo | INTEGRATE | Firmographic, org charts, technographic | P1 | FUTURE |
| 2 | SEC EDGAR (10K/10Q/8K) | BUILD | Revenue, risk factors, M&A, strategy | P1 | FUTURE |
| 3 | Crunchbase/PitchBook | INTEGRATE | Funding, investors, M&A, company profile | P1 | FUTURE |
| 4 | S&P/Moody's credit data | INTEGRATE | Credit health, financial risk | P2 | FUTURE |

#### Category 2: Intent & Engagement

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 5 | Demandbase/6sense | INTEGRATE | Buyer intent, topic interest, account surge | P1 | FUTURE |
| 6 | Marketo | INTEGRATE | Email engagement, MQL scoring, campaign response | P1 | FUTURE |
| 7 | Gong | INTEGRATE | Call insights, competitor mentions, objections | P2 | FUTURE |
| 8 | **Algolia Internal Signals** | BUILD | Free-tier usage, trial signups, doc visits, SDK downloads | P1 | ⭐ DIFFERENTIATOR |

#### Category 3: Digital & Technology Signals

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 9 | **SimilarWeb** | INTEGRATE (MCP) | Web traffic, growth, marketing channels | P1 | ✅ ACTIVE |
| 10 | **BuiltWith/Wappalyzer** | INTEGRATE (MCP) | Tech stack, competitor tech, Algolia fit | P1 | ✅ ACTIVE |
| 11 | GitHub Organization Intel | BUILD | Engineering velocity, tech direction, dependencies | P1 | FUTURE |
| 12 | Core Web Vitals/Lighthouse | BUILD | Digital maturity, site performance | P2 | FUTURE |
| 13 | **Search Quality Assessment** | BUILD | Prospect's search relevance, speed, typo tolerance | P1 | ⭐ DIFFERENTIATOR |

#### Category 4: Social & Content Signals

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 14 | LinkedIn Sales Navigator | INTEGRATE | People, accounts, InMail, saved leads | P1 | FUTURE |
| 15 | LinkedIn Content & Posts | BUILD | Company posts, employee posts, job openings | P1 | FUTURE |
| 16 | LinkedIn Network Mining | BUILD | 2nd/3rd degree connections, warm intros | P2 | FUTURE |
| 17 | Twitter/X | BUILD | Contact tweets, company mentions, topic tracking | P1 | FUTURE |
| 18 | YouTube Channel | BUILD | Company releases, product demos, exec talks | P2 | FUTURE |
| 19 | Podcasts & Webinars | BUILD | Exec speaking appearances, topic signals | P2 | FUTURE |

#### Category 5: Market Perception & Reviews

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 20 | G2/Capterra/Gartner PI | INTEGRATE/SCRAPE | Review velocity, sentiment, competitor mentions | P1 | FUTURE |
| 21 | App Store Reviews | SCRAPE | Product traction, user sentiment (mobile cos) | P2 | FUTURE |
| 22 | Stack Overflow/Reddit/HN | BUILD | Developer pain points, tech discussions | P2 | FUTURE |
| 23 | Engineering Blogs | SCRAPE | Architecture decisions, scaling challenges | P2 | FUTURE |

#### Category 6: Hiring & Organizational

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 24 | **Career Pages** | BUILD (Apify) | Hiring velocity, department growth, tech needs | P1 | PARTIAL |
| 25 | Job Board Aggregation | INTEGRATE | Role types, salary bands, urgency signals | P1 | FUTURE |
| 26 | H1B/Visa Databases | INTEGRATE | Specialized hiring, growth indicators | P3 | FUTURE |

#### Category 7: Partner & Competitive Intelligence

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 27 | **Crossbeam** | INTEGRATE | Partner overlap, co-sell opportunities | P1 | FUTURE |
| 28 | **Algolia Customer DB** | BUILD | "Your competitor uses Algolia" messaging | P1 | ⭐ DIFFERENTIATOR |
| 29 | Champions/Advocates | BUILD | Industry speakers, case study quotes, influencers | P2 | FUTURE |
| 30 | Competitor Displacement | BUILD | Blog posts, reviews, job posts about migrations | P2 | FUTURE |

#### Category 8: Regulatory, Legal & Real-Time Triggers

| # | Source | Strategy | Signal Type | Phase | Status |
|---|--------|----------|-------------|-------|--------|
| 31 | Patent/Trademark (USPTO) | INTEGRATE | Innovation direction, new product signals | P3 | FUTURE |
| 32 | Press Release Wires | INTEGRATE | M&A, partnerships, product launches (same-day) | P1 | FUTURE |
| 33 | News APIs | INTEGRATE | Company mentions, industry trends | P1 | FUTURE |
| 34 | Government Contracts (SAM) | INTEGRATE | Public sector opportunities | P3 | FUTURE |

### Algolia-Unique Differentiators (⭐)

These are capabilities NO competitor (Clay, ZoomInfo, etc.) provides:

1. **Search Quality Assessment** - Automatically audit prospect's site search (relevance, speed, typo tolerance). "Your search returns irrelevant results 40% of the time."
2. **Algolia Usage Detection** - Detect Algolia/competitor JS on prospect websites. Instant displacement intelligence.
3. **"Your Competitor Uses Algolia" Messaging** - Cross-reference prospect's competitors with Algolia customer database.
4. **Customer Similarity Clustering** - Find companies that look like Algolia's best customers but aren't customers yet.

---

## Part 3: Normalized Database Schema

### Entity-Relationship Diagram

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│   partners   │     │  company_partners │     │  companies   │
├──────────────┤     ├───────────────────┤     ├──────────────┤
│ id (PK)      │────<│ partner_id (FK)   │>────│ id (PK)      │
│ name         │     │ company_id (FK)   │     │ domain (UK)  │
│ category     │     │ first_detected    │     │ name         │
│ builtwith_id │     │ last_verified     │     │ vertical_id  │
│ tier         │     │ tenure_years      │     │ revenue_band │
│ our_contact  │     │ confidence        │     │ employee_cnt │
│ logo_url     │     │ source            │     │ hq_country   │
└──────────────┘     └───────────────────┘     │ is_public    │
                                               │ ticker       │
┌──────────────┐     ┌───────────────────┐     │ created_at   │
│   features   │     │   gap_features    │     └──────────────┘
├──────────────┤     ├───────────────────┤           │
│ id (PK)      │────<│ feature_id (FK)   │           │
│ name         │     │ gap_id (FK)       │>──────────┤
│ category     │     │ fit_score         │           │
│ pitch_angle  │     │ pitch_template    │           │
│ product_url  │     └───────────────────┘           │
└──────────────┘                                     │
                     ┌───────────────────┐           │
┌──────────────┐     │   company_gaps    │           │
│     gaps     │     ├───────────────────┤           │
├──────────────┤     │ id (PK)           │           │
│ id (PK)      │────<│ company_id (FK)   │>──────────┤
│ name         │     │ gap_id (FK)       │           │
│ description  │     │ severity (1-10)   │           │
│ audit_area   │     │ detected_at       │           │
│ detection    │     │ evidence_url      │           │
└──────────────┘     │ screenshot_path   │           │
                     └───────────────────┘           │
                                                     │
┌──────────────┐     ┌───────────────────┐           │
│ signal_types │     │  company_signals  │           │
├──────────────┤     ├───────────────────┤           │
│ id (PK)      │────<│ signal_type_id    │           │
│ name         │     │ company_id (FK)   │>──────────┤
│ category     │     │ detected_at       │           │
│ source       │     │ value             │           │
│ half_life    │     │ confidence        │           │
│ ttl_days     │     │ raw_data (JSONB)  │           │
│ decay_type   │     │ expires_at        │           │
│ weight       │     └───────────────────┘           │
└──────────────┘                                     │
                     ┌───────────────────┐           │
┌──────────────┐     │   enrichments     │           │
│ data_sources │     ├───────────────────┤           │
├──────────────┤     │ id (PK)           │           │
│ id (PK)      │────<│ source_id (FK)    │           │
│ name         │     │ company_id (FK)   │>──────────┘
│ category     │     │ ran_at            │
│ api_endpoint │     │ status            │
│ refresh_days │     │ data (JSONB)      │
│ cost_per_call│     │ confidence        │
│ phase        │     │ expires_at        │
└──────────────┘     └───────────────────┘

┌──────────────┐     ┌───────────────────┐
│  verticals   │     │ trigger_events    │
├──────────────┤     ├───────────────────┤
│ id (PK)      │     │ id (PK)           │
│ name         │     │ company_id (FK)   │
│ icp_weight   │     │ event_type        │
│ case_studies │     │ category          │
└──────────────┘     │ detected_at       │
                     │ description       │
┌──────────────┐     │ source_url        │
│  campaigns   │     │ is_positive       │
├──────────────┤     │ action_taken      │
│ id (PK)      │     └───────────────────┘
│ name         │
│ partner_id   │     ┌───────────────────┐
│ criteria     │     │ search_audits     │
│ created_by   │     ├───────────────────┤
│ export_count │     │ id (PK)           │
└──────────────┘     │ company_id (FK)   │
                     │ overall_score     │
                     │ audit_date        │
                     │ gaps_found        │
                     │ screenshots_path  │
                     │ report_path       │
                     └───────────────────┘
```

### Key Tables (Supabase SQL)

```sql
-- Partners (technology vendors we track)
CREATE TABLE partners (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'CMS', 'Ecommerce', 'Search', 'Analytics'
  builtwith_name TEXT,    -- Name as it appears in BuiltWith
  tier INT DEFAULT 1,     -- 1=Strategic, 2=Growth, 3=Emerging
  our_contact TEXT,       -- Algolia partner manager
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies (the accounts we're tracking)
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  vertical_id INT REFERENCES verticals(id),
  revenue_band TEXT,      -- '<$10M', '$10M-$50M', '$50M-$100M', etc.
  employee_count INT,
  hq_country TEXT,
  hq_city TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  ticker TEXT,
  is_algolia_customer BOOLEAN DEFAULT FALSE,
  account_readiness_score DECIMAL(5,2),
  last_scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: which companies use which partners
CREATE TABLE company_partners (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  partner_id INT REFERENCES partners(id) ON DELETE CASCADE,
  first_detected TIMESTAMPTZ,
  last_verified TIMESTAMPTZ,
  tenure_months INT,
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  source TEXT,             -- 'builtwith', 'similarweb', 'manual'
  UNIQUE(company_id, partner_id)
);

-- Algolia features (for gap-to-feature mapping)
CREATE TABLE features (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT,          -- 'Search', 'Discovery', 'Recommend', 'Analytics'
  pitch_angle TEXT,       -- One-liner pitch
  product_url TEXT,
  priority INT DEFAULT 1
);

-- Gaps identified (from Search Audit skill)
CREATE TABLE gaps (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  audit_area TEXT,        -- 'Latency', 'Typo Tolerance', 'Semantic', etc.
  detection_method TEXT   -- How we detect this gap
);

-- Gap-to-Feature mapping
CREATE TABLE gap_features (
  id SERIAL PRIMARY KEY,
  gap_id INT REFERENCES gaps(id),
  feature_id INT REFERENCES features(id),
  fit_score INT,          -- 1-10 how well this feature addresses the gap
  pitch_template TEXT,    -- "You have {gap}. {feature} solves this by..."
  UNIQUE(gap_id, feature_id)
);

-- Company-specific gaps found
CREATE TABLE company_gaps (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  gap_id INT REFERENCES gaps(id),
  severity INT,           -- 1-10
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  evidence_url TEXT,
  screenshot_path TEXT,
  notes TEXT
);

-- Signal types with decay model
CREATE TABLE signal_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT,          -- 'Intent', 'Hiring', 'Financial', etc.
  source TEXT,            -- 'demandbase', 'linkedin', 'builtwith'
  half_life_days INT,     -- When signal loses 50% value
  ttl_days INT,           -- When signal expires completely
  decay_type TEXT,        -- 'exponential', 'linear', 'sigmoid', 'step'
  weight DECIMAL(3,2),    -- Weight in composite score
  is_negative BOOLEAN DEFAULT FALSE
);

-- Actual signals detected for companies
CREATE TABLE company_signals (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  signal_type_id INT REFERENCES signal_types(id),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  value TEXT,             -- The actual signal value
  confidence DECIMAL(3,2),
  raw_data JSONB,         -- Full API response
  source_url TEXT,
  expires_at TIMESTAMPTZ
);

-- Trigger events (high-value timing signals)
CREATE TABLE trigger_events (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'funding', 'leadership_change', 'hiring_spree', etc.
  category TEXT NOT NULL,    -- One of 8 categories
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  source_url TEXT,
  is_positive BOOLEAN DEFAULT TRUE,  -- Negative = deprioritize
  action_taken TEXT,
  assigned_to TEXT
);

-- Search audit results
CREATE TABLE search_audits (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  overall_score DECIMAL(3,1),  -- 0.0 to 10.0
  audit_date TIMESTAMPTZ DEFAULT NOW(),
  gaps_found INT,
  screenshots_path TEXT,
  report_path TEXT,
  auditor TEXT DEFAULT 'claude'
);

-- Data sources configuration
CREATE TABLE data_sources (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  api_endpoint TEXT,
  refresh_days INT,
  cost_per_call DECIMAL(10,4),
  phase TEXT,              -- 'P1', 'P2', 'P3'
  status TEXT DEFAULT 'planned'  -- 'active', 'planned', 'deprecated'
);

-- Enrichment history
CREATE TABLE enrichments (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  source_id INT REFERENCES data_sources(id),
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT,            -- 'success', 'partial', 'failed'
  data JSONB,
  confidence DECIMAL(3,2),
  expires_at TIMESTAMPTZ,
  error_message TEXT
);

-- Campaigns (for partner co-sell motions)
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  partner_id INT REFERENCES partners(id),
  criteria JSONB,         -- Filter criteria used
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  export_count INT DEFAULT 0,
  last_exported TIMESTAMPTZ
);

-- Verticals with ICP weighting
CREATE TABLE verticals (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  icp_weight INT,         -- Base ICP score contribution
  case_study_ids INT[],   -- Related Algolia case studies
  query_templates JSONB   -- Search audit test queries for this vertical
);
```

---

## Part 4: Gap-to-Feature Mapping (Search Audit Integration)

When the `/algolia-search-audit` skill identifies gaps, they map to Algolia features:

| Gap Identified | Audit Area | Algolia Feature | Pitch Angle |
|----------------|------------|-----------------|-------------|
| No semantic search | Semantic/NLP | **Neural Search** | "Understand intent, not just keywords" |
| Poor typo handling | Typo Tolerance | **Typo Tolerance** | "Never lose a sale to a typo" |
| No personalization | Personalization | **Personalization** | "1:1 results for every shopper" |
| Slow search (>200ms) | Latency | **Edge Infrastructure** | "Sub-50ms from 100+ POPs" |
| No recommendations | Recommendations | **Algolia Recommend** | "AI-powered cross-sell" |
| Manual merchandising | Merchandising | **Rules Engine** | "Automate your best practices" |
| No A/B testing | Intelligence | **A/B Testing** | "Data-driven optimization" |
| Poor mobile search | UX | **InstantSearch** | "Mobile-first UI components" |
| No federated search | Content Commerce | **Federated Search** | "Products + content + FAQs in one" |
| Static filters | Dynamic Facets | **Dynamic Faceting** | "Context-aware filtering" |
| Weak empty state | Query Suggestions | **Query Suggestions** | "Guide users to discovery" |
| No trending/popular | Analytics | **Analytics** | "Surface what's working" |
| Poor no-results | Query Rules | **Query Rules** | "Rescue dead-end searches" |
| No brand redirects | Intent Detection | **Rules + Redirects** | "Intent-aware navigation" |
| Inconsistent merchandising | Consistency | **Merchandising Studio** | "Unified search & browse" |

### Seed Data for Gap-Feature Mapping

```sql
-- Insert gaps
INSERT INTO gaps (name, audit_area, description) VALUES
('no_semantic_search', 'Semantic/NLP', 'Pure keyword matching, no understanding of intent'),
('poor_typo_handling', 'Typo Tolerance', 'Typos return zero or wrong results'),
('no_personalization', 'Personalization', 'Same results for all users regardless of behavior'),
('slow_search', 'Latency', 'Search response time >200ms'),
('no_recommendations', 'Recommendations', 'No product recommendations on PDP'),
('manual_merchandising', 'Merchandising', 'Manual product ranking, no automation'),
('no_ab_testing', 'Intelligence', 'No search A/B testing capability'),
('poor_mobile_search', 'UX', 'Degraded mobile search experience'),
('no_federated_search', 'Content Commerce', 'Products only, no content/FAQs in results'),
('static_filters', 'Dynamic Facets', 'Same filters regardless of search context'),
('weak_empty_state', 'Query Suggestions', 'Blank or unhelpful empty search state'),
('no_trending', 'Analytics', 'No trending/popular/bestseller signals'),
('poor_no_results', 'Query Rules', 'Dead-end "no results found" pages'),
('no_brand_redirects', 'Intent Detection', 'Brand searches don''t redirect to brand pages'),
('inconsistent_merchandising', 'Consistency', 'Search and browse show different rankings');

-- Insert features
INSERT INTO features (name, category, pitch_angle, product_url) VALUES
('Neural Search', 'Search', 'Understand intent, not just keywords', 'https://www.algolia.com/products/ai-search/'),
('Typo Tolerance', 'Search', 'Never lose a sale to a typo', 'https://www.algolia.com/doc/guides/managing-results/optimize-search-results/typo-tolerance/'),
('Personalization', 'Discovery', '1:1 results for every shopper', 'https://www.algolia.com/products/search-and-discovery/personalization/'),
('Edge Infrastructure', 'Platform', 'Sub-50ms from 100+ POPs worldwide', 'https://www.algolia.com/distributed-secure/'),
('Algolia Recommend', 'Recommend', 'AI-powered cross-sell and upsell', 'https://www.algolia.com/products/recommendations/'),
('Rules Engine', 'Merchandising', 'Automate your best practices', 'https://www.algolia.com/doc/guides/managing-results/rules/rules-overview/'),
('A/B Testing', 'Analytics', 'Data-driven search optimization', 'https://www.algolia.com/doc/guides/ab-testing/what-is-ab-testing/'),
('InstantSearch', 'UI', 'Mobile-first UI components', 'https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/js/'),
('Federated Search', 'Search', 'Products + content + FAQs unified', 'https://www.algolia.com/doc/guides/solutions/ecommerce/search/'),
('Dynamic Faceting', 'Discovery', 'Context-aware filtering', 'https://www.algolia.com/doc/guides/managing-results/refine-results/faceting/'),
('Query Suggestions', 'Discovery', 'Guide users to discovery', 'https://www.algolia.com/doc/guides/building-search-ui/ui-and-ux-patterns/query-suggestions/js/'),
('Analytics', 'Analytics', 'Surface what''s working', 'https://www.algolia.com/products/search-and-discovery/analytics/'),
('Query Rules', 'Merchandising', 'Rescue dead-end searches', 'https://www.algolia.com/doc/guides/managing-results/rules/'),
('Redirects', 'Search', 'Intent-aware navigation', 'https://www.algolia.com/doc/guides/managing-results/rules/'),
('Merchandising Studio', 'Merchandising', 'Unified search & browse', 'https://www.algolia.com/products/search-and-discovery/visual-merchandising/');

-- Map gaps to features
INSERT INTO gap_features (gap_id, feature_id, fit_score, pitch_template) VALUES
(1, 1, 10, 'Your search treats "{query}" as keywords. Neural Search understands the intent.'),
(2, 2, 10, 'Typos like "{typo}" return zero results. Algolia handles this automatically.'),
(3, 3, 10, 'Every visitor sees identical results. Personalization shows relevant items.'),
(4, 4, 10, 'Your {latency}ms search feels slow. Algolia delivers <50ms globally.'),
(5, 5, 10, 'No recommendations = missed cross-sell. Algolia Recommend drives 15% more AOV.'),
(6, 6, 9, 'Manual ranking is labor-intensive. Rules Engine automates merchandising.'),
(7, 7, 9, 'No A/B testing means guessing. Our analytics show what works.'),
(8, 8, 9, 'Mobile search is broken. InstantSearch provides production-ready components.'),
(9, 9, 9, 'Products-only search misses support content. Federated Search unifies everything.'),
(10, 10, 8, 'Static filters confuse users. Dynamic Faceting adapts to context.'),
(11, 11, 8, 'Empty search = lost opportunity. Query Suggestions guide discovery.'),
(12, 12, 8, 'No visibility into search behavior. Analytics surfaces insights.'),
(13, 13, 8, 'Dead-end searches frustrate users. Query Rules rescue them.'),
(14, 14, 8, 'Brand searches should redirect. Rules handle this automatically.'),
(15, 15, 7, 'Search/browse rankings differ. Merchandising Studio unifies them.');
```

---

## Part 5: Trigger Event Taxonomy (60+ Events)

### A. Funding & Capital (Crunchbase + SEC + Press Wires)

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| New funding round (ANY stage) | 🔥🔥🔥 | 8x more likely to buy |
| Acquisition/M&A announcement | 🔥🔥🔥 | Immediate vendor re-evaluation |
| IPO filing (S-1) | 🔥🔥 | 6-9 month infrastructure buying window |
| PE investment / LBO | 🔥🔥 | Vendor consolidation urgency |

### B. Leadership Changes (LinkedIn + Press)

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| New CTO/VP Engineering | 🔥🔥🔥 | Re-evaluates entire tech stack (30-60 day window) |
| New CDO/CPO | 🔥🔥 | Drives product roadmap re-evaluation |
| CEO departure | 🔥 | Strategic shift, vendor re-evaluation |
| Board composition change | 🔥 | New strategic priorities |

### C. Hiring Signals (Career Pages + Job Boards)

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| Rapid hiring spree (30+ roles/month) | 🔥🔥 | Expansion = budget |
| Function-specific hiring ("Site Search Engineer") | 🔥🔥🔥 | Buying signal |
| Hiring freeze / layoffs | ⚠️ NEGATIVE | Deprioritize |
| New department creation | 🔥🔥 | Major capability expansion |

### D. Technology Changes (BuiltWith + GitHub)

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| Competitor tech removal | 🔥🔥🔥 | ACTIVE displacement opportunity |
| Competitor tech addition | ⚠️ NEGATIVE | They just committed |
| Major framework upgrade | 🔥🔥 | Active modernization |
| New product launch | 🔥🔥 | Needs search/discovery capabilities |

### E. Financial Health (SEC EDGAR + News)

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| Earnings beat / revenue growth | 🔥🔥 | Budget available |
| Earnings miss | ⚠️ NEGATIVE | Budget frozen |
| Guidance raise | 🔥🔥 | Forward growth signal |
| Cost-cutting initiative | 🔥 | Context needed |

### F. Market Expansion (Press + Career Pages + Domains)

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| International expansion | 🔥🔥 | New infrastructure needs |
| Strategic partnership announced | 🔥🔥 | Co-sell opportunity |
| New customer segment focus | 🔥 | Different buying criteria |
| Domain registrations in new regions | 🔥 | Localization needs |

### G. Regulatory & Compliance

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| Security incident/breach | 🔥🔥🔥 | Urgent vendor re-evaluation |
| New industry regulation | 🔥 | Compliance tooling needed |
| Compliance certification push | 🔥 | Vendor readiness requirements |

### H. Internal Algolia Signals (⭐ Unfair Advantage)

| Trigger | Signal Strength | Action |
|---------|-----------------|--------|
| Free-tier usage spike | 🔥🔥🔥 | Buying evaluation underway |
| Trial signup | 🔥🔥🔥 | Hottest lead possible |
| SDK download from target domain | 🔥🔥🔥 | Proof-of-concept phase |
| Dashboard login frequency increase | 🔥🔥 | Deepening evaluation |
| Community forum activity | 🔥 | Technical evaluation signals |

---

## Part 6: Data Decay & Freshness Model

Different signal types decay at different rates:

| Signal Category | Half-Life | TTL | Decay Type | Refresh |
|-----------------|-----------|-----|------------|---------|
| Intent Signals | 7-14 days | 30 days | Exponential | Real-time/daily |
| Funding | 60-90 days | 180 days | Linear | Real-time + quarterly |
| Leadership Change | 90-180 days | 365 days | Sigmoid (peak at 30-90d) | Monthly |
| Job Posting | 14-30 days | 60 days | Linear | Weekly |
| Technographic | 90-180 days | 365 days | Linear | Monthly |
| Firmographic | 180-365 days | 540 days | Linear | Quarterly |
| Financial | 90 days | 180 days | Step (quarterly) | Quarterly |
| News/PR | 7-14 days | 30 days | Exponential | Real-time |
| Internal (Algolia) | 14-30 days | 60 days | Exponential | Real-time |

### Composite Account Readiness Score

```python
Account_Readiness(t) =
    0.25 × Intent_Score(t)          # [Demandbase, internal signals]
  + 0.20 × Tech_Fit_Score(t)        # [BuiltWith, search quality, GitHub]
  + 0.15 × Financial_Score(t)       # [SEC, Crunchbase, funding]
  + 0.15 × Engagement_Score(t)      # [Marketo, content, events]
  + 0.10 × Partner_Score(t)         # [Crossbeam, competitor intelligence]
  + 0.10 × Hiring_Score(t)          # [Career pages, job boards]
  + 0.05 × Champion_Score(t)        # [Network, advocates, LinkedIn]

where each score(t) = base_score × decay_function(days_since_signal)
```

---

## Part 7: Phased Delivery Roadmap

### Phase 0: Foundation (Weeks 0-2) ← CURRENT

| Task | Status |
|------|--------|
| Supabase migration | ✅ DONE |
| Frontend connected to Supabase | ✅ DONE |
| Basic dashboard with 2,737 targets | ✅ DONE |
| PRD v3.0 | ✅ THIS DOCUMENT |

### Phase 1 Sprint 1 (Weeks 3-4): Schema + MCP-Ready Sources

| Task | Sources |
|------|---------|
| Create normalized schema in Supabase | All tables above |
| Migrate existing data to new schema | 2,737 → companies + company_partners |
| SimilarWeb connector | #9 - Already have MCP |
| BuiltWith connector | #10 - Already have MCP |
| SEC EDGAR connector | #2 - Free public API |
| News APIs connector | #33 - Low cost, fast setup |
| Search Quality Assessment | #13 - Via /algolia-search-audit |

### Phase 1 Sprint 2 (Weeks 4-5): Core Enrichment

| Task | Sources |
|------|---------|
| Career Pages (Apify) | #24 |
| GitHub Org Intelligence | #11 - Free API |
| Twitter/X monitoring | #17 - API or Apify |
| G2/Review Sites | #20 - API + scraping |
| Algolia Internal Signals | #8 - If product analytics access |

### Phase 1 Sprint 3 (Weeks 5-6): Premium Sources

| Task | Sources |
|------|---------|
| ZoomInfo | #1 - Needs credentials |
| Demandbase | #5 - Needs credentials |
| LinkedIn via Sales Nav / Apify | #14 - Needs compliance review |
| Crossbeam | #27 - Limited availability |
| Crunchbase | #3 - Funding/M&A triggers |

### Phase 2 (Weeks 9-12): Extended Intelligence

| Task | Sources |
|------|---------|
| YouTube Channel scraping | #18 |
| Podcast/Webinar monitoring | #19 |
| LinkedIn Network Mining | #16 |
| Competitor Displacement Detection | #30 |
| Champions/Advocates module | #29 |
| Marketo (API) | #6 |
| Gong (API) | #7 |

### Phase 3 (Post-MVP): Advanced

| Task | Sources |
|------|---------|
| Stack Overflow/Reddit/HN | #22 |
| Engineering Blog analysis | #23 |
| Patent/Trademark monitoring | #31 |
| Digital Maturity Scoring | #26 |
| Customer Similarity Clustering | AI module |
| Buying Committee Simulation | AI module |
| Win Probability Prediction | AI module |

---

## Part 8: Partner Campaign Use Cases

### Use Case 1: Adobe Co-Sell Campaign

```sql
-- "Adobe AEM customers, $5M-$10M revenue, 5+ years, not using Algolia,
--  with semantic search gap, hiring for search roles, traffic growing"

SELECT c.domain, c.name, c.revenue_band,
       cp.tenure_months/12 as years_with_adobe,
       cg.severity as semantic_gap_severity,
       cs_hiring.value as search_hires,
       cs_traffic.raw_data->>'growth_pct' as traffic_growth
FROM companies c
JOIN company_partners cp ON c.id = cp.company_id
JOIN partners p ON cp.partner_id = p.id
LEFT JOIN company_gaps cg ON c.id = cg.company_id
LEFT JOIN gaps g ON cg.gap_id = g.id AND g.name = 'no_semantic_search'
LEFT JOIN company_signals cs_hiring ON c.id = cs_hiring.company_id
  AND cs_hiring.signal_type_id = (SELECT id FROM signal_types WHERE name = 'hiring_search')
LEFT JOIN company_signals cs_traffic ON c.id = cs_traffic.company_id
  AND cs_traffic.signal_type_id = (SELECT id FROM signal_types WHERE name = 'traffic_growth')
WHERE p.name = 'Adobe Experience Manager'
  AND c.revenue_band IN ('$5M-$10M', '$10M-$50M')
  AND cp.tenure_months >= 60
  AND c.is_algolia_customer = FALSE
  AND cg.id IS NOT NULL  -- Has semantic search gap
ORDER BY cg.severity DESC, cs_traffic.raw_data->>'growth_pct' DESC;
```

### Use Case 2: Neural Search Campaign

```sql
-- "Companies with semantic search gap, traffic >1M,
--  in commerce/media verticals, with recent hiring"

SELECT c.domain, c.name, v.name as vertical,
       cs_traffic.value as monthly_visits,
       cg.severity,
       cg.evidence_url
FROM companies c
JOIN verticals v ON c.vertical_id = v.id
JOIN company_gaps cg ON c.id = cg.company_id
JOIN gaps g ON cg.gap_id = g.id
JOIN company_signals cs_traffic ON c.id = cs_traffic.company_id
WHERE g.name = 'no_semantic_search'
  AND v.name IN ('Commerce', 'Media', 'Marketplace')
  AND CAST(cs_traffic.value AS INT) > 1000000
  AND EXISTS (
    SELECT 1 FROM company_signals cs2
    WHERE cs2.company_id = c.id
    AND cs2.signal_type_id = (SELECT id FROM signal_types WHERE name = 'hiring_tech')
    AND cs2.detected_at > NOW() - INTERVAL '90 days'
  );
```

### Use Case 3: Crossbeam Overlap + Trigger Events

```sql
-- "Companies in our partner overlap with recent funding or leadership change"

SELECT c.domain, c.name,
       te.event_type, te.description, te.detected_at,
       cs_crossbeam.raw_data->>'overlap_type' as crossbeam_overlap
FROM companies c
JOIN trigger_events te ON c.id = te.company_id
JOIN company_signals cs_crossbeam ON c.id = cs_crossbeam.company_id
WHERE cs_crossbeam.signal_type_id = (SELECT id FROM signal_types WHERE name = 'crossbeam_overlap')
  AND te.is_positive = TRUE
  AND te.detected_at > NOW() - INTERVAL '30 days'
  AND te.category IN ('funding', 'leadership_change')
ORDER BY te.detected_at DESC;
```

---

## Part 9: Success Metrics

| Metric | Current | Target (Phase 1) | Target (Phase 2) |
|--------|---------|------------------|------------------|
| Data sources integrated | 2 | 15 | 25 |
| Companies enriched | 2,737 | 10,000 | 50,000 |
| Signal types tracked | 3 | 20 | 40 |
| Average enrichment freshness | N/A | <7 days | <3 days |
| Campaign exports/month | 0 | 10 | 50 |
| Partner co-sell meetings sourced | 0 | 5/month | 20/month |
| Pipeline attributed | $0 | $500K | $5M |

---

## Part 10: Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| LinkedIn scraping ToS violation | HIGH | Immediate legal review; use Sales Nav API |
| LLM hallucination in recommendations | HIGH | Always show source signals; "insufficient data" floor |
| API rate limiting and cost explosion | HIGH | Aggressive caching; tiered enrichment; budget alerts |
| Data staleness producing false confidence | HIGH | Auto-decay based on data age; visual freshness indicators |
| Entity resolution across 6-8 sources | HIGH | Domain as canonical key; alias table; human-in-the-loop |
| Standalone UI fails adoption | HIGH | Prioritize CRM widget + Slack notifications |
| GDPR non-compliance | HIGH | DPIA required; document lawful basis; DSAR handling |

---

## Appendix A: MCP Server Status

| MCP | Priority | Status |
|-----|----------|--------|
| SimilarWeb | Active | ✅ Already configured |
| BuiltWith | Active | ✅ Already configured |
| Supabase | High | Add now (OAuth, no PAT needed) |
| GitHub | High | Add now (requires PAT) |
| Apify | High | Add now (requires API token) |
| ZoomInfo | Medium | Requires enterprise API access |
| Crossbeam | Medium | Limited availability |
| Gong | Medium | Community MCP available |
| Marketo | Medium | Community MCP available |

---

## Appendix B: Related Documents

- [GTM Enrichment Agent Brief](./GTM%20Enrichment%20Agent%20_%20Project%20Brief%20&%20Plan.pdf) - Full 34-source research
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [algolia-search-audit SKILL.md](~/.claude/skills/algolia-search-audit/SKILL.md) - Gap detection methodology

---

*This PRD is a living document. Last updated: 2026-02-26*
