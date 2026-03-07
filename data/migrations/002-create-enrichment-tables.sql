-- Migration 002: Create Enrichment Tables
-- Description: Audit-scoped data tables with composite PKs (company_id + audit_id)
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: 001-create-core-tables.sql

-- =============================================================================
-- ENRICHMENT TABLES (All use composite PK: company_id + audit_id + domain_key)
-- =============================================================================

-- =============================================================================
-- 1. COMPANY TRAFFIC (SimilarWeb data)
-- =============================================================================
CREATE TABLE company_traffic (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  month DATE NOT NULL, -- '2026-02-01' (first day of month)

  -- Core metrics
  monthly_visits BIGINT,
  unique_visitors BIGINT,
  page_views BIGINT,
  bounce_rate NUMERIC(5,2), -- 0-100
  avg_visit_duration INTEGER, -- seconds
  pages_per_visit NUMERIC(5,2),

  -- Traffic sources (percentages, sum = 100)
  direct_traffic_pct NUMERIC(5,2),
  search_traffic_pct NUMERIC(5,2),
  social_traffic_pct NUMERIC(5,2),
  referral_traffic_pct NUMERIC(5,2),
  paid_traffic_pct NUMERIC(5,2),
  email_traffic_pct NUMERIC(5,2),

  -- Geography (top country)
  top_country VARCHAR(2),
  top_country_pct NUMERIC(5,2),

  -- Device breakdown
  desktop_pct NUMERIC(5,2),
  mobile_pct NUMERIC(5,2),
  tablet_pct NUMERIC(5,2),

  -- Source tracking
  source_provider VARCHAR(50) DEFAULT 'similarweb',
  source_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK: One row per company per audit per month
  PRIMARY KEY (company_id, audit_id, month),

  -- Composite FK to audits
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,

  -- Validation
  CONSTRAINT traffic_bounce_rate_range CHECK (bounce_rate BETWEEN 0 AND 100)
);

CREATE INDEX idx_traffic_fetched ON company_traffic(fetched_at DESC);

COMMENT ON TABLE company_traffic IS 'Monthly traffic metrics from SimilarWeb - point-in-time snapshots per audit';

-- =============================================================================
-- 2. COMPANY FINANCIALS (Yahoo Finance / SEC Edgar)
-- =============================================================================
CREATE TABLE company_financials (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER NOT NULL DEFAULT 0, -- 0 for annual, 1-4 for quarterly

  -- Income statement
  revenue NUMERIC(15,2),
  gross_profit NUMERIC(15,2),
  operating_income NUMERIC(15,2),
  net_income NUMERIC(15,2),

  -- Balance sheet
  total_assets NUMERIC(15,2),
  total_liabilities NUMERIC(15,2),
  shareholders_equity NUMERIC(15,2),
  cash_and_equivalents NUMERIC(15,2),

  -- Cash flow
  operating_cash_flow NUMERIC(15,2),
  investing_cash_flow NUMERIC(15,2),
  financing_cash_flow NUMERIC(15,2),
  free_cash_flow NUMERIC(15,2),

  -- Metrics
  ebitda NUMERIC(15,2),
  earnings_per_share NUMERIC(8,2),
  price_to_earnings NUMERIC(8,2),

  -- Source tracking
  source_provider VARCHAR(50), -- 'yahoo_finance' | 'sec_edgar'
  source_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, fiscal_year, fiscal_quarter),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,

  -- Validation
  CONSTRAINT financials_quarter_range CHECK (fiscal_quarter BETWEEN 0 AND 4)
);

CREATE INDEX idx_financials_year ON company_financials(fiscal_year DESC);

COMMENT ON TABLE company_financials IS 'Financial statements from Yahoo Finance or SEC Edgar - quarterly or annual';

-- =============================================================================
-- 3. COMPANY TECHNOLOGIES (BuiltWith data)
-- =============================================================================
CREATE TABLE company_technologies (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  technology_name VARCHAR(100) NOT NULL,

  technology_category VARCHAR(50), -- 'ecommerce' | 'cms' | 'analytics' | 'search' | 'martech'
  technology_vendor VARCHAR(100),
  confidence_level VARCHAR(20), -- 'high' | 'medium' | 'low'

  -- Detection metadata
  first_detected DATE,
  last_detected DATE,

  -- Source tracking
  source_provider VARCHAR(50) DEFAULT 'builtwith',
  source_url TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, technology_name),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_tech_category ON company_technologies(technology_category);
CREATE INDEX idx_tech_name ON company_technologies(technology_name);

COMMENT ON TABLE company_technologies IS 'Tech stack detected by BuiltWith - captured per audit';

-- =============================================================================
-- 4. COMPANY COMPETITORS (SimilarWeb)
-- =============================================================================
CREATE TABLE company_competitors (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  competitor_domain VARCHAR(255) NOT NULL,

  competitor_name VARCHAR(255),
  similarity_score NUMERIC(5,2), -- 0-100

  -- Competitor tech stack
  competitor_search_provider VARCHAR(100),
  competitor_ecommerce_platform VARCHAR(100),

  -- Traffic comparison
  competitor_monthly_visits BIGINT,
  traffic_ratio NUMERIC(10,4), -- company_visits / competitor_visits

  -- Source tracking
  source_provider VARCHAR(50) DEFAULT 'similarweb',
  source_url TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, competitor_domain),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_competitors_similarity ON company_competitors(similarity_score DESC);

COMMENT ON TABLE company_competitors IS 'Competitor relationships from SimilarWeb - captured per audit';

-- =============================================================================
-- 5. COMPANY EXECUTIVES (Apollo.io / LinkedIn)
-- =============================================================================
CREATE TABLE company_executives (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  full_name VARCHAR(255) NOT NULL,

  title VARCHAR(255),
  role_category VARCHAR(50), -- 'ceo' | 'cfo' | 'cto' | 'cmo' | 'coo' | 'vp_data' | 'vp_ecommerce'
  department VARCHAR(100),

  -- Contact
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url TEXT,

  -- Tenure
  start_date DATE,
  is_current BOOLEAN DEFAULT true,

  -- Source tracking
  source_provider VARCHAR(50), -- 'apollo' | 'linkedin' | 'apify'
  apollo_person_id VARCHAR(100),
  fetched_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, full_name),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_executives_role ON company_executives(role_category);

COMMENT ON TABLE company_executives IS 'Executive team members from Apollo or LinkedIn - captured per audit';

-- =============================================================================
-- 6. EXECUTIVE QUOTES (SEC filings / Earnings calls)
-- =============================================================================
CREATE TABLE executive_quotes (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  executive_name VARCHAR(255) NOT NULL,
  quote_text TEXT NOT NULL,

  context TEXT, -- What they were discussing
  keywords TEXT[], -- Array of keywords (e.g., ['search', 'personalization'])

  -- Source
  source_type VARCHAR(50), -- 'earnings_call' | '10-K' | '10-Q' | 'interview' | 'investor_day'
  source_date DATE,
  source_url TEXT,

  fetched_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK (needs unique identifier beyond name)
  PRIMARY KEY (company_id, audit_id, executive_name, source_type, source_date),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_quotes_keywords ON executive_quotes USING GIN (keywords);
CREATE INDEX idx_quotes_source ON executive_quotes(source_type, source_date DESC);

COMMENT ON TABLE executive_quotes IS 'Executive quotes from SEC filings and earnings calls - for investor intelligence';

-- =============================================================================
-- 7. COMPANY SOCIAL PROFILES (Apify LinkedIn scraper)
-- =============================================================================
CREATE TABLE company_social_profiles (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'linkedin' | 'twitter' | 'facebook' | 'instagram'

  profile_url TEXT NOT NULL,

  -- Follower metrics
  follower_count INTEGER,
  following_count INTEGER,

  -- Engagement metrics
  avg_likes_per_post NUMERIC(10,2),
  avg_comments_per_post NUMERIC(10,2),
  avg_shares_per_post NUMERIC(10,2),
  engagement_rate NUMERIC(5,2), -- percentage

  -- Activity
  post_frequency_per_week NUMERIC(5,2),
  last_post_date DATE,

  -- Source tracking (Apify actor)
  source_actor VARCHAR(100), -- 'apify/linkedin-company-scraper'
  fetched_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, platform),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

COMMENT ON TABLE company_social_profiles IS 'Social media profiles from Apify actors - engagement metrics per audit';

-- =============================================================================
-- 8. COMPANY SOCIAL POSTS (Apify LinkedIn scraper)
-- =============================================================================
CREATE TABLE company_social_posts (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL,
  post_url TEXT NOT NULL,

  post_text TEXT,
  post_date TIMESTAMP,

  -- Engagement
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,

  -- Content analysis
  mentions_search BOOLEAN DEFAULT false, -- Does post mention "search" keywords?
  sentiment VARCHAR(20), -- 'positive' | 'neutral' | 'negative'

  scraped_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, platform, post_url),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_date ON company_social_posts(post_date DESC);
CREATE INDEX idx_posts_mentions ON company_social_posts(mentions_search) WHERE mentions_search = true;

COMMENT ON TABLE company_social_posts IS 'Individual social media posts scraped from LinkedIn/Twitter - for engagement analysis';

-- =============================================================================
-- 9. BUYING COMMITTEE (Apollo.io)
-- =============================================================================
CREATE TABLE buying_committee (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  full_name VARCHAR(255) NOT NULL,

  title VARCHAR(255),
  role_category VARCHAR(50), -- 'decision_maker' | 'influencer' | 'user' | 'blocker'
  department VARCHAR(100), -- 'engineering' | 'data' | 'it' | 'marketing'

  -- Contact
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url TEXT,

  -- Seniority
  seniority_level VARCHAR(50), -- 'c_level' | 'vp' | 'director' | 'manager' | 'individual_contributor'

  -- Apollo metadata
  apollo_person_id VARCHAR(100),

  -- Source tracking
  source_provider VARCHAR(50) DEFAULT 'apollo',
  fetched_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, full_name),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_buying_committee_role ON buying_committee(role_category);
CREATE INDEX idx_buying_committee_seniority ON buying_committee(seniority_level);

COMMENT ON TABLE buying_committee IS 'Buying committee members from Apollo.io - key contacts per audit';

-- =============================================================================
-- 10. INTENT SIGNALS (Apollo.io)
-- =============================================================================
CREATE TABLE intent_signals (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  signal_type VARCHAR(50) NOT NULL, -- 'job_posting' | 'tech_install' | 'funding' | 'web_research' | 'hiring_surge'
  signal_description TEXT NOT NULL,

  signal_category VARCHAR(50), -- 'high_intent' | 'medium_intent' | 'low_intent'
  confidence_score NUMERIC(5,2), -- 0-100

  detected_at TIMESTAMP DEFAULT NOW(),

  -- Source tracking
  source_provider VARCHAR(50) DEFAULT 'apollo',
  source_url TEXT,

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, signal_type, signal_description),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_intent_category ON intent_signals(signal_category);
CREATE INDEX idx_intent_detected ON intent_signals(detected_at DESC);

COMMENT ON TABLE intent_signals IS 'Intent signals from Apollo.io - buying signals per audit';

-- =============================================================================
-- 11. COMPANY HIRING (Apify LinkedIn jobs scraper)
-- =============================================================================
CREATE TABLE company_hiring (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  posted_date DATE NOT NULL,

  department VARCHAR(100),
  role_category VARCHAR(50), -- 'engineering' | 'data' | 'marketing' | 'sales' | 'operations'
  location VARCHAR(255),
  employment_type VARCHAR(50), -- 'full-time' | 'contract' | 'intern'

  -- Buying signals
  is_buying_committee BOOLEAN DEFAULT false, -- VP Data, Director Search, etc.
  keywords TEXT[], -- Array of keywords (e.g., ['search', 'personalization', 'AI'])

  source_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, job_title, posted_date),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_hiring_buying_committee ON company_hiring(is_buying_committee) WHERE is_buying_committee = true;
CREATE INDEX idx_hiring_keywords ON company_hiring USING GIN (keywords);
CREATE INDEX idx_hiring_posted ON company_hiring(posted_date DESC);

COMMENT ON TABLE company_hiring IS 'Job postings from LinkedIn - hiring signals per audit';

-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================
