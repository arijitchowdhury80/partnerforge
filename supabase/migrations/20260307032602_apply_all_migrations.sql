-- ============================================================================
-- FIXED MIGRATION - Drops existing objects before creating
-- ============================================================================

-- Drop all potentially conflicting indexes
DROP INDEX IF EXISTS idx_companies_search CASCADE;
DROP INDEX IF EXISTS idx_audits_company_type_status CASCADE;
DROP INDEX IF EXISTS idx_displacement_status_score CASCADE;
DROP INDEX IF EXISTS idx_displacement_assigned_status CASCADE;
DROP INDEX IF EXISTS idx_api_call_params CASCADE;
DROP INDEX IF EXISTS idx_audit_log_old_value CASCADE;
DROP INDEX IF EXISTS idx_audit_log_new_value CASCADE;
DROP INDEX IF EXISTS idx_audits_failed CASCADE;
DROP INDEX IF EXISTS idx_audits_running CASCADE;
DROP INDEX IF EXISTS idx_displacement_hot CASCADE;
DROP INDEX IF EXISTS idx_buying_committee_decision_makers CASCADE;
DROP INDEX IF EXISTS idx_traffic_visits CASCADE;
DROP INDEX IF EXISTS idx_financials_revenue CASCADE;
DROP INDEX IF EXISTS idx_api_calls_cost_provider CASCADE;
DROP INDEX IF EXISTS idx_cache_hit_count CASCADE;
DROP INDEX IF EXISTS idx_companies_basic_info CASCADE;
DROP INDEX IF EXISTS idx_audits_with_scores CASCADE;

-- Now include the full APPLY_MIGRATIONS.sql content
-- Migration 001: Create Core Tables
-- Description: Companies, Users, Partner Technologies, and Audits
-- Author: Dashboard Builder Team
-- Date: 2026-03-06

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. COMPANIES TABLE (Master Entity)
-- =============================================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,

  -- Basic info
  industry VARCHAR(100),
  sector VARCHAR(100),
  founded_year INTEGER,
  headquarters_city VARCHAR(100),
  headquarters_country VARCHAR(2),

  -- Size indicators
  employee_count INTEGER,
  annual_revenue NUMERIC(15,2),
  revenue_currency VARCHAR(3) DEFAULT 'USD',

  -- Status
  is_public BOOLEAN DEFAULT false,
  stock_ticker VARCHAR(10),
  stock_exchange VARCHAR(20),

  -- Contact
  website_url TEXT,
  linkedin_url TEXT,

  -- Soft delete
  deleted_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_name ON companies(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_industry ON companies(industry) WHERE deleted_at IS NULL;

COMMENT ON TABLE companies IS 'Master company entities - stores only company attributes, not audit data';
COMMENT ON COLUMN companies.deleted_at IS 'Soft delete timestamp for GDPR compliance';

-- =============================================================================
-- 2. USERS TABLE (Master Entity)
-- =============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,

  role VARCHAR(50) NOT NULL, -- 'admin' | 'manager' | 'analyst' | 'viewer'
  team VARCHAR(100),

  -- Authentication (Supabase Auth handles this, but we track here too)
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE is_active = true;
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;

COMMENT ON TABLE users IS 'Application users - synced with Supabase Auth';

-- =============================================================================
-- 3. PARTNER TECHNOLOGIES TABLE (Master Entity)
-- =============================================================================
CREATE TABLE partner_technologies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'cms' | 'commerce' | 'martech' | 'cdp'
  vendor VARCHAR(100),

  -- Algolia partnership status
  is_active_partner BOOLEAN DEFAULT true,
  partnership_tier VARCHAR(50), -- 'platinum' | 'gold' | 'silver'

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_partner_tech_category ON partner_technologies(category) WHERE is_active_partner = true;

COMMENT ON TABLE partner_technologies IS 'Master list of partner technologies we track (Adobe AEM, Shopify, etc.)';

-- =============================================================================
-- 4. AUDITS TABLE (Bridge between Companies and Data)
-- =============================================================================
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,

  -- Audit type
  audit_type VARCHAR(50) NOT NULL, -- 'partner-intel' | 'search-audit'
  status VARCHAR(50) NOT NULL,     -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

  -- Scores (aggregated from findings)
  overall_score NUMERIC(3,1),
  fit_score NUMERIC(3,1),
  intent_score NUMERIC(3,1),
  value_score NUMERIC(3,1),
  displacement_score NUMERIC(3,1),

  -- Execution metadata
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Error tracking
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,

  -- Ownership
  created_by UUID REFERENCES users(id),

  -- Soft delete
  deleted_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- CRITICAL: Unique constraint for composite FKs from data tables
  CONSTRAINT audits_company_id_unique UNIQUE (company_id, id),

  -- Validation
  CONSTRAINT audits_score_range CHECK (overall_score BETWEEN 0 AND 10),
  CONSTRAINT audits_duration_positive CHECK (duration_seconds >= 0)
);

CREATE INDEX idx_audits_company_id ON audits(company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_audits_status ON audits(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_audits_type ON audits(audit_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_audits_created_by ON audits(created_by, created_at DESC);
CREATE INDEX idx_audits_completed ON audits(completed_at DESC) WHERE status = 'completed' AND deleted_at IS NULL;

COMMENT ON TABLE audits IS 'Audit execution records - bridge between companies and point-in-time data snapshots';
COMMENT ON CONSTRAINT audits_company_id_unique ON audits IS 'Required for composite FKs: FOREIGN KEY (company_id, audit_id)';

-- =============================================================================
-- TRIGGERS for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_technologies_updated_at BEFORE UPDATE ON partner_technologies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audits_updated_at BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
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
-- Migration 003: Create Partner Intelligence Tables
-- Description: Displacement opportunities and sales engagement tracking
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: 001-create-core-tables.sql, 002-create-enrichment-tables.sql

-- =============================================================================
-- PARTNER INTELLIGENCE TABLES
-- =============================================================================

-- =============================================================================
-- 1. DISPLACEMENT OPPORTUNITIES (Scores per audit)
-- =============================================================================
CREATE TABLE displacement_opportunities (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  partner_tech_id UUID NOT NULL REFERENCES partner_technologies(id) ON DELETE RESTRICT,

  -- Scores (calculated per audit)
  fit_score NUMERIC(3,1), -- 0-10
  intent_score NUMERIC(3,1), -- 0-10
  value_score NUMERIC(3,1), -- 0-10
  displacement_score NUMERIC(3,1), -- 0-10
  overall_score NUMERIC(3,1), -- Weighted average

  -- Status
  opportunity_status VARCHAR(50) DEFAULT 'cold', -- 'hot' | 'warm' | 'cold' | 'engaged' | 'won' | 'lost'
  assigned_to UUID REFERENCES users(id),

  -- Displacement details
  current_search_provider VARCHAR(100),
  estimated_annual_value NUMERIC(12,2), -- $15M-$30M
  estimated_deal_size NUMERIC(12,2),

  -- Sales notes
  notes TEXT,
  next_action VARCHAR(255),
  next_action_date DATE,

  detected_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, partner_tech_id),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,

  -- Validation
  CONSTRAINT displacement_scores_range CHECK (
    fit_score BETWEEN 0 AND 10 AND
    intent_score BETWEEN 0 AND 10 AND
    value_score BETWEEN 0 AND 10 AND
    displacement_score BETWEEN 0 AND 10 AND
    overall_score BETWEEN 0 AND 10
  )
);

CREATE INDEX idx_displacement_status ON displacement_opportunities(opportunity_status);
CREATE INDEX idx_displacement_score ON displacement_opportunities(overall_score DESC);
CREATE INDEX idx_displacement_assigned ON displacement_opportunities(assigned_to);
CREATE INDEX idx_displacement_detected ON displacement_opportunities(detected_at DESC);

COMMENT ON TABLE displacement_opportunities IS 'Displacement opportunities per company per audit - scores change over time';
COMMENT ON COLUMN displacement_opportunities.opportunity_status IS 'Sales pipeline status: hot → warm → cold → engaged → won/lost';

-- =============================================================================
-- 2. PARTNER ENGAGEMENT LOG (Sales activity)
-- =============================================================================
CREATE TABLE partner_engagement_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL, -- NULL if general engagement
  partner_tech_id UUID REFERENCES partner_technologies(id) ON DELETE CASCADE,

  engagement_type VARCHAR(50) NOT NULL, -- 'email_sent' | 'call_made' | 'demo_scheduled' | 'contract_signed' | 'opportunity_lost'
  engagement_date TIMESTAMP DEFAULT NOW(),

  notes TEXT,
  outcome VARCHAR(50), -- 'positive' | 'neutral' | 'negative' | 'no_response'

  -- Ownership
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_engagement_company ON partner_engagement_log(company_id, engagement_date DESC);
CREATE INDEX idx_engagement_type ON partner_engagement_log(engagement_type);
CREATE INDEX idx_engagement_date ON partner_engagement_log(engagement_date DESC);

COMMENT ON TABLE partner_engagement_log IS 'Sales activity log - who did what when (not audit-scoped)';

-- =============================================================================
-- 3. TRIGGER for displacement_opportunities.last_updated
-- =============================================================================
CREATE TRIGGER update_displacement_last_updated BEFORE UPDATE ON displacement_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: Reuses update_updated_at_column() function from migration 001

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================
-- NOTE: Migration 004 removed - conflicts with Migration 009 (different schema for search_audit_tests)
-- Migration 005: Create Activity and Log Tables
-- Description: Audit log, API call tracking, error logging, data freshness
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: 001-create-core-tables.sql

-- =============================================================================
-- ACTIVITY TABLES (NOT audit-scoped, use regular PKs)
-- =============================================================================

-- =============================================================================
-- 1. AUDIT LOG (Who did what when)
-- =============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  actor_id UUID REFERENCES users(id),
  actor_email VARCHAR(255),

  action_type VARCHAR(50) NOT NULL, -- 'audit_created' | 'audit_deleted' | 'company_added' | 'opportunity_assigned'
  resource_type VARCHAR(50) NOT NULL, -- 'audit' | 'company' | 'displacement_opportunity' | 'user'
  resource_id UUID,

  -- What changed
  old_value JSONB,
  new_value JSONB,

  -- Request metadata
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action_type, created_at DESC);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

COMMENT ON TABLE audit_log IS 'Activity log - who did what when (not audit-scoped)';
COMMENT ON COLUMN audit_log.old_value IS 'Before value (JSONB for flexibility)';
COMMENT ON COLUMN audit_log.new_value IS 'After value (JSONB for flexibility)';

-- =============================================================================
-- 2. API CALL LOG (Cost tracking + debugging)
-- =============================================================================
CREATE TABLE api_call_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  provider VARCHAR(50) NOT NULL, -- 'similarweb' | 'builtwith' | 'apollo' | 'yahoo_finance' | 'apify'
  endpoint VARCHAR(255) NOT NULL,

  -- Request
  request_params JSONB,
  cache_key VARCHAR(255),

  -- Response
  status_code INTEGER,
  response_time_ms INTEGER,
  was_cached BOOLEAN DEFAULT false,

  -- Cost tracking
  cost_usd NUMERIC(10,6),
  api_credits_used INTEGER, -- For providers with credit system

  -- Context (if part of audit)
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Error tracking
  error_message TEXT,
  retry_attempt INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_calls_provider ON api_call_log(provider, created_at DESC);
CREATE INDEX idx_api_calls_audit ON api_call_log(audit_id);
CREATE INDEX idx_api_calls_company ON api_call_log(company_id, created_at DESC);
CREATE INDEX idx_api_calls_cached ON api_call_log(was_cached, created_at DESC);
CREATE INDEX idx_api_calls_cost ON api_call_log(cost_usd DESC) WHERE cost_usd > 0;

COMMENT ON TABLE api_call_log IS 'All API calls made to external providers - cost tracking and debugging';
COMMENT ON COLUMN api_call_log.was_cached IS 'True if response was served from cache (no API cost)';

-- =============================================================================
-- 3. API ERROR LOG (What failed)
-- =============================================================================
CREATE TABLE api_error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,

  -- Error details
  error_type VARCHAR(100), -- 'rate_limit' | 'timeout' | 'auth_failed' | 'not_found' | 'server_error'
  error_message TEXT,
  http_status_code INTEGER,

  -- Request context
  request_params JSONB,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Retry info
  retry_count INTEGER DEFAULT 0,
  will_retry BOOLEAN DEFAULT true,
  next_retry_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_errors_provider ON api_error_log(provider, created_at DESC);
CREATE INDEX idx_api_errors_type ON api_error_log(error_type);
CREATE INDEX idx_api_errors_audit ON api_error_log(audit_id);
CREATE INDEX idx_api_errors_created ON api_error_log(created_at DESC);

COMMENT ON TABLE api_error_log IS 'API call failures - debugging and monitoring';

-- =============================================================================
-- 4. DATA FRESHNESS (When should we refresh?)
-- =============================================================================
CREATE TABLE data_freshness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  data_type VARCHAR(50) NOT NULL, -- 'traffic' | 'financials' | 'tech_stack' | 'social' | 'hiring'

  last_fetched_at TIMESTAMP,
  next_refresh_at TIMESTAMP,
  is_stale BOOLEAN DEFAULT false,

  refresh_frequency_days INTEGER DEFAULT 30,

  CONSTRAINT freshness_unique UNIQUE (company_id, data_type)
);

CREATE INDEX idx_freshness_stale ON data_freshness(is_stale, next_refresh_at) WHERE is_stale = true;
CREATE INDEX idx_freshness_company ON data_freshness(company_id);

COMMENT ON TABLE data_freshness IS 'Tracks when data should be refreshed - avoids redundant API calls';
COMMENT ON COLUMN data_freshness.is_stale IS 'Staleness flag: set by application logic when next_refresh_at passes';

-- =============================================================================
-- 5. ENRICHMENT CACHE (7-day cache metadata)
-- =============================================================================
CREATE TABLE enrichment_cache (
  key VARCHAR(255) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,

  -- Cached data
  data JSONB NOT NULL,

  -- Cache metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW(),

  -- Source metadata
  source_url TEXT,
  http_status INTEGER,

  -- Size tracking
  data_size_bytes INTEGER
);

CREATE INDEX idx_cache_provider ON enrichment_cache(provider);
CREATE INDEX idx_cache_expires ON enrichment_cache(expires_at);
CREATE INDEX idx_cache_accessed ON enrichment_cache(last_accessed_at DESC);

COMMENT ON TABLE enrichment_cache IS 'Persistent cache for API responses - 7-day TTL';
COMMENT ON COLUMN enrichment_cache.key IS 'Format: api:{provider}:{endpoint}:{params_hash}';
COMMENT ON COLUMN enrichment_cache.hit_count IS 'Increment on each cache hit - tracks popular data';

-- =============================================================================
-- TRIGGER for cache hit tracking
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_cache_hit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hit_count = OLD.hit_count + 1;
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would be activated by application code when reading from cache

-- =============================================================================
-- END OF MIGRATION 005
-- =============================================================================
-- Migration 006: Create Views for Latest Data
-- Description: Simplify queries for "current state" vs "historical state"
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: All previous migrations

-- =============================================================================
-- VIEWS FOR "LATEST" DATA (Current state per company)
-- =============================================================================

-- =============================================================================
-- 1. LATEST AUDITS (Most recent audit per company)
-- =============================================================================
CREATE VIEW latest_audits AS
SELECT DISTINCT ON (company_id)
  *
FROM audits
WHERE deleted_at IS NULL
ORDER BY company_id, created_at DESC;

COMMENT ON VIEW latest_audits IS 'Most recent audit per company - simplifies "current state" queries';

-- =============================================================================
-- 2. LATEST TRAFFIC DATA
-- =============================================================================
CREATE VIEW company_traffic_latest AS
SELECT DISTINCT ON (t.company_id, t.month)
  t.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY t.company_id, t.month, a.created_at DESC;

COMMENT ON VIEW company_traffic_latest IS 'Latest traffic metrics per company per month';

-- =============================================================================
-- 3. LATEST FINANCIALS
-- =============================================================================
CREATE VIEW company_financials_latest AS
SELECT DISTINCT ON (f.company_id, f.fiscal_year, f.fiscal_quarter)
  f.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_financials f
JOIN audits a ON f.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY f.company_id, f.fiscal_year DESC, f.fiscal_quarter DESC, a.created_at DESC;

COMMENT ON VIEW company_financials_latest IS 'Latest financial data per company per period';

-- =============================================================================
-- 4. LATEST TECH STACK
-- =============================================================================
CREATE VIEW company_technologies_latest AS
SELECT DISTINCT ON (t.company_id, t.technology_name)
  t.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_technologies t
JOIN audits a ON t.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY t.company_id, t.technology_name, a.created_at DESC;

COMMENT ON VIEW company_technologies_latest IS 'Latest tech stack per company';

-- =============================================================================
-- 5. LATEST COMPETITORS
-- =============================================================================
CREATE VIEW company_competitors_latest AS
SELECT DISTINCT ON (c.company_id, c.competitor_domain)
  c.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_competitors c
JOIN audits a ON c.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY c.company_id, c.competitor_domain, a.created_at DESC;

COMMENT ON VIEW company_competitors_latest IS 'Latest competitor list per company';

-- =============================================================================
-- 6. LATEST EXECUTIVES
-- =============================================================================
CREATE VIEW company_executives_latest AS
SELECT DISTINCT ON (e.company_id, e.full_name)
  e.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_executives e
JOIN audits a ON e.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY e.company_id, e.full_name, a.created_at DESC;

COMMENT ON VIEW company_executives_latest IS 'Latest executive team per company';

-- =============================================================================
-- 7. LATEST SOCIAL PROFILES
-- =============================================================================
CREATE VIEW company_social_profiles_latest AS
SELECT DISTINCT ON (s.company_id, s.platform)
  s.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_social_profiles s
JOIN audits a ON s.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY s.company_id, s.platform, a.created_at DESC;

COMMENT ON VIEW company_social_profiles_latest IS 'Latest social media profiles per company';

-- =============================================================================
-- 8. LATEST BUYING COMMITTEE
-- =============================================================================
CREATE VIEW buying_committee_latest AS
SELECT DISTINCT ON (b.company_id, b.full_name)
  b.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM buying_committee b
JOIN audits a ON b.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY b.company_id, b.full_name, a.created_at DESC;

COMMENT ON VIEW buying_committee_latest IS 'Latest buying committee per company';

-- =============================================================================
-- 9. LATEST HIRING DATA
-- =============================================================================
CREATE VIEW company_hiring_latest AS
SELECT DISTINCT ON (h.company_id, h.job_title, h.posted_date)
  h.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_hiring h
JOIN audits a ON h.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY h.company_id, h.job_title, h.posted_date, a.created_at DESC;

COMMENT ON VIEW company_hiring_latest IS 'Latest hiring data per company';

-- =============================================================================
-- 10. DISPLACEMENT OPPORTUNITIES (Latest + Enriched)
-- =============================================================================
CREATE VIEW displacement_opportunities_latest AS
SELECT DISTINCT ON (d.company_id, d.partner_tech_id)
  d.*,
  c.name as company_name,
  c.domain as company_domain,
  c.industry,
  c.annual_revenue,
  pt.name as partner_tech_name,
  pt.category as partner_tech_category,
  pt.vendor as partner_tech_vendor,
  a.created_at as audit_date,
  a.audit_type,
  a.status as audit_status
FROM displacement_opportunities d
JOIN audits a ON d.audit_id = a.id
JOIN companies c ON d.company_id = c.id
JOIN partner_technologies pt ON d.partner_tech_id = pt.id
WHERE a.deleted_at IS NULL AND c.deleted_at IS NULL
ORDER BY d.company_id, d.partner_tech_id, a.created_at DESC;

COMMENT ON VIEW displacement_opportunities_latest IS 'Latest displacement opportunities with company and partner tech details';

-- NOTE: search_audit_tests_latest view moved to Migration 009 (after table creation)

-- =============================================================================
-- 11. COMPANY OVERVIEW (Dashboard summary)
-- =============================================================================
CREATE VIEW company_overview AS
SELECT
  c.*,
  la.id as latest_audit_id,
  la.audit_type as latest_audit_type,
  la.created_at as latest_audit_date,
  la.overall_score as latest_audit_score,
  la.status as latest_audit_status,

  -- Traffic (latest month)
  (SELECT monthly_visits FROM company_traffic_latest ctl
   WHERE ctl.company_id = c.id
   ORDER BY ctl.month DESC LIMIT 1) as latest_monthly_visits,

  -- Tech stack count
  (SELECT COUNT(*) FROM company_technologies_latest tech
   WHERE tech.company_id = c.id) as tech_stack_count,

  -- Displacement opportunities count
  (SELECT COUNT(*) FROM displacement_opportunities_latest d
   WHERE d.company_id = c.id) as displacement_opportunities_count,

  -- Hot opportunities count (score >= 8.0)
  (SELECT COUNT(*) FROM displacement_opportunities_latest d
   WHERE d.company_id = c.id AND d.overall_score >= 8.0) as hot_opportunities_count

FROM companies c
LEFT JOIN latest_audits la ON la.company_id = c.id
WHERE c.deleted_at IS NULL;

COMMENT ON VIEW company_overview IS 'Dashboard summary view - company with latest audit and key metrics';

-- =============================================================================
-- END OF MIGRATION 006
-- =============================================================================
-- Migration 007: Create Performance Indexes
-- Description: Additional indexes for query optimization
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: All previous migrations

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- =============================================================================
-- COMPOSITE INDEXES for Common Queries
-- =============================================================================

-- Companies: Search by name or domain
CREATE INDEX idx_companies_search ON companies USING gin(to_tsvector('english', name || ' ' || domain))
WHERE deleted_at IS NULL;

-- Audits: Filter by company + type + status
CREATE INDEX idx_audits_company_type_status ON audits(company_id, audit_type, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Displacement Opportunities: Filter by status + score
CREATE INDEX idx_displacement_status_score ON displacement_opportunities(opportunity_status, overall_score DESC);

-- Displacement Opportunities: Filter by assigned user + status
CREATE INDEX idx_displacement_assigned_status ON displacement_opportunities(assigned_to, opportunity_status)
WHERE assigned_to IS NOT NULL;

-- =============================================================================
-- GIN INDEXES for JSONB Columns
-- =============================================================================

-- NOTE: search_audit_tests indexes moved to Migration 009

-- API call request params (for debugging)
CREATE INDEX idx_api_call_params ON api_call_log USING gin(request_params);

-- Audit log old/new values (for auditing)
CREATE INDEX idx_audit_log_old_value ON audit_log USING gin(old_value);
CREATE INDEX idx_audit_log_new_value ON audit_log USING gin(new_value);

-- =============================================================================
-- PARTIAL INDEXES for Common Filters
-- =============================================================================

-- Failed audits only
CREATE INDEX idx_audits_failed ON audits(company_id, created_at DESC)
WHERE status = 'failed' AND deleted_at IS NULL;

-- Running audits only
CREATE INDEX idx_audits_running ON audits(created_at)
WHERE status = 'running' AND deleted_at IS NULL;

-- Hot opportunities only (score >= 8.0)
CREATE INDEX idx_displacement_hot ON displacement_opportunities(company_id, audit_id, overall_score DESC)
WHERE overall_score >= 8.0;

-- Buying committee decision makers only
CREATE INDEX idx_buying_committee_decision_makers ON buying_committee(company_id, audit_id, full_name)
WHERE role_category = 'decision_maker';

-- NOTE: search_audit_tests indexes moved to Migration 009

-- =============================================================================
-- BTREE INDEXES for Sorting and Range Queries
-- =============================================================================

-- Traffic: Sort by visits
CREATE INDEX idx_traffic_visits ON company_traffic(monthly_visits DESC);

-- Financials: Sort by revenue
CREATE INDEX idx_financials_revenue ON company_financials(revenue DESC);

-- API calls: Cost analysis
CREATE INDEX idx_api_calls_cost_provider ON api_call_log(provider, cost_usd DESC)
WHERE cost_usd > 0;

-- Cache: Most accessed data
CREATE INDEX idx_cache_hit_count ON enrichment_cache(hit_count DESC, last_accessed_at DESC);

-- =============================================================================
-- COVERING INDEXES (Include frequently queried columns)
-- =============================================================================

-- Companies with basic info (avoid table lookups)
CREATE INDEX idx_companies_basic_info ON companies(id, domain, name, industry, annual_revenue)
WHERE deleted_at IS NULL;

-- Audits with scores (avoid table lookups)
CREATE INDEX idx_audits_with_scores ON audits(company_id, id, overall_score, status, created_at DESC)
WHERE deleted_at IS NULL;

-- =============================================================================
-- STATISTICS
-- =============================================================================

-- Update statistics for query planner
ANALYZE companies;
ANALYZE audits;
ANALYZE company_traffic;
ANALYZE company_financials;
ANALYZE company_technologies;
ANALYZE displacement_opportunities;
-- NOTE: search_audit_tests ANALYZE moved to Migration 009

-- =============================================================================
-- END OF MIGRATION 007
-- =============================================================================
-- ============================================================================
-- Migration 008: Add Strategic Insights Architecture
-- ============================================================================
-- Purpose: Add strategic insight columns to enrichment tables + company-level
--          synthesis table for Algolia value prop mapping
-- Date: March 7, 2026
-- ============================================================================

-- ============================================================================
-- PART 1: Add Insight Columns to Enrichment Tables (Module-Level Insights)
-- ============================================================================

-- 1. COMPANY TRAFFIC (SimilarWeb insights)
ALTER TABLE company_traffic
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN company_traffic.insight IS 'Strategic insight from traffic data (e.g., "High bounce rate 52% indicates poor search relevance")';
COMMENT ON COLUMN company_traffic.confidence_score IS 'Validation confidence 8.0-10.0 (100% validation requirement)';

-- 2. COMPANY FINANCIALS (Financial insights)
ALTER TABLE company_financials
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN company_financials.insight IS 'Strategic insight from financial data (e.g., "Revenue declining 8% YoY - digital optimization critical")';

-- 3. COMPANY TECHNOLOGIES (Tech stack insights)
ALTER TABLE company_technologies
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN company_technologies.insight IS 'Strategic insight from tech stack (e.g., "Using legacy Elasticsearch - migration opportunity")';

-- 4. COMPANY COMPETITORS (Competitive insights)
ALTER TABLE company_competitors
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN company_competitors.insight IS 'Strategic insight from competitor analysis (e.g., "3 of 5 competitors use Algolia - competitive pressure")';

-- 5. COMPANY EXECUTIVES (Executive insights)
ALTER TABLE company_executives
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN company_executives.insight IS 'Strategic insight from executive background (e.g., "CTO has AI/ML background - tech-forward buyer")';

-- 6. EXECUTIVE QUOTES (Quote-based insights)
ALTER TABLE executive_quotes
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN executive_quotes.insight IS 'Strategic insight from executive quote (e.g., "CEO prioritizing digital transformation")';

-- 7. COMPANY SOCIAL PROFILES (Social insights)
ALTER TABLE company_social_profiles
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

-- 8. COMPANY SOCIAL POSTS (Social content insights)
ALTER TABLE company_social_posts
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

-- 9. BUYING COMMITTEE (Buyer persona insights)
ALTER TABLE buying_committee
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

-- 10. INTENT SIGNALS (Intent-based insights)
ALTER TABLE intent_signals
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

-- 11. COMPANY HIRING (Hiring signal insights)
ALTER TABLE company_hiring
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN company_hiring.insight IS 'Strategic insight from hiring data (e.g., "Hiring 3 search engineers - build vs buy decision point")';

-- NOTE: search_audit_tests insight columns added in Migration 009 when table is created

-- ============================================================================
-- PART 2: Company-Level Strategic Analysis Table (Synthesis)
-- ============================================================================

CREATE TABLE company_strategic_analysis (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,

  -- Algolia Value Prop Mapping
  primary_value_prop VARCHAR(100) NOT NULL,
  secondary_value_props VARCHAR(100)[] NOT NULL DEFAULT '{}',

  -- Sales Intelligence
  sales_pitch TEXT NOT NULL,
  business_impact TEXT NOT NULL,
  strategic_recommendations TEXT NOT NULL,

  -- Timing Intelligence
  trigger_events TEXT[] NOT NULL DEFAULT '{}',
  timing_signals TEXT[] NOT NULL DEFAULT '{}',
  caution_signals TEXT[] NOT NULL DEFAULT '{}',

  -- Metadata
  overall_confidence_score NUMERIC(3,1) NOT NULL CHECK (overall_confidence_score >= 8.0 AND overall_confidence_score <= 10.0),
  insights_synthesized_from TEXT[] NOT NULL,  -- ['traffic', 'financials', 'hiring', 'search_audit']
  analysis_generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite Key Pattern
  PRIMARY KEY (company_id, audit_id),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

-- Comments
COMMENT ON TABLE company_strategic_analysis IS 'Company-level strategic analysis synthesized from ALL module insights';
COMMENT ON COLUMN company_strategic_analysis.primary_value_prop IS 'Primary Algolia value prop: search_relevance, scale_performance, mobile_experience, conversion_optimization, personalization, time_to_market, operational_efficiency';
COMMENT ON COLUMN company_strategic_analysis.sales_pitch IS 'Synthesized sales narrative with quantified business impact and Algolia solution';
COMMENT ON COLUMN company_strategic_analysis.business_impact IS 'Quantified business impact (e.g., "$2.3M monthly revenue at risk from poor search relevance")';
COMMENT ON COLUMN company_strategic_analysis.strategic_recommendations IS 'Complete strategic recommendations section (How Algolia Can Help)';
COMMENT ON COLUMN company_strategic_analysis.trigger_events IS 'Array of trigger events for sales timing (e.g., "Q4 earnings call - CEO mentioned digital transformation")';
COMMENT ON COLUMN company_strategic_analysis.timing_signals IS 'Why now signals (e.g., "Hiring 3 search engineers", "Revenue declining 8%")';
COMMENT ON COLUMN company_strategic_analysis.caution_signals IS 'Negative signals (e.g., "Recent layoffs", "Hiring freeze")';
COMMENT ON COLUMN company_strategic_analysis.insights_synthesized_from IS 'Which modules contributed insights (for traceability)';

-- ============================================================================
-- PART 3: Indexes for Performance
-- ============================================================================

-- Indexes for filtering by value proposition
CREATE INDEX idx_company_strategic_analysis_primary_value_prop
  ON company_strategic_analysis(primary_value_prop);

CREATE INDEX idx_company_strategic_analysis_confidence
  ON company_strategic_analysis(overall_confidence_score DESC);

-- Indexes for module insights with confidence filtering
CREATE INDEX idx_company_traffic_insight_confidence
  ON company_traffic(confidence_score DESC)
  WHERE insight IS NOT NULL;

CREATE INDEX idx_company_financials_insight_confidence
  ON company_financials(confidence_score DESC)
  WHERE insight IS NOT NULL;

CREATE INDEX idx_company_hiring_insight_confidence
  ON company_hiring(confidence_score DESC)
  WHERE insight IS NOT NULL;

-- NOTE: search_audit_tests insight index moved to Migration 009

-- ============================================================================
-- PART 4: View for Latest Strategic Analysis
-- ============================================================================

CREATE OR REPLACE VIEW latest_strategic_analysis AS
SELECT DISTINCT ON (company_id)
  company_id,
  audit_id,
  primary_value_prop,
  secondary_value_props,
  sales_pitch,
  business_impact,
  strategic_recommendations,
  trigger_events,
  timing_signals,
  caution_signals,
  overall_confidence_score,
  insights_synthesized_from,
  analysis_generated_at
FROM company_strategic_analysis
ORDER BY company_id, analysis_generated_at DESC;

COMMENT ON VIEW latest_strategic_analysis IS 'Latest strategic analysis per company (most recent audit)';

-- ============================================================================
-- End of Migration 008
-- ============================================================================
-- Migration 009: Search Audit Tests & Scoring
-- Created: 2026-03-07
-- Purpose: Add tables for browser test results, test queries, deliverables, and scoring matrix

-- ============================================================================
-- 1. Search Audit Test Results
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_audit_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  test_id VARCHAR(10) NOT NULL, -- '2a', '2b', ..., '2t'
  test_name TEXT NOT NULL,
  query TEXT,
  passed BOOLEAN NOT NULL,
  score NUMERIC(3,1) CHECK (score >= 0 AND score <= 10),
  finding TEXT,
  severity VARCHAR(10) CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  evidence TEXT,
  screenshot_path TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,
  UNIQUE (company_id, audit_id, test_id)
);

CREATE INDEX idx_search_audit_tests_audit ON search_audit_tests(company_id, audit_id);
CREATE INDEX idx_search_audit_tests_severity ON search_audit_tests(severity) WHERE passed = false;
CREATE INDEX idx_search_audit_tests_score ON search_audit_tests(score);

COMMENT ON TABLE search_audit_tests IS 'Stores results of 20 browser-based search tests (2a-2t) for each audit';
COMMENT ON COLUMN search_audit_tests.test_id IS 'Test identifier (2a-2t) from algolia-search-audit skill';
COMMENT ON COLUMN search_audit_tests.severity IS 'Finding severity: CRITICAL (score<3, HIGH test), HIGH (score<5, HIGH test), MEDIUM (score<7), LOW (score>=7)';

-- ============================================================================
-- 2. Test Query Library
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_test_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  query TEXT NOT NULL,
  query_type VARCHAR(20) NOT NULL, -- 'simple', 'multi-word', 'nlp', 'typo', 'synonym', 'zero-results'
  expected_min_results INT,
  expected_contains TEXT[],
  expected_excludes TEXT[],
  vertical VARCHAR(50), -- 'retail', 'marketplace', 'b2b', 'publishing', 'travel', 'default'
  test_id VARCHAR(10), -- Which test uses this query (e.g., '2c', '2i')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_search_test_queries_audit ON search_test_queries(company_id, audit_id);
CREATE INDEX idx_search_test_queries_type ON search_test_queries(query_type);
CREATE INDEX idx_search_test_queries_vertical ON search_test_queries(vertical);

COMMENT ON TABLE search_test_queries IS 'Vertical-calibrated test queries generated for each audit (12-15 queries per vertical)';
COMMENT ON COLUMN search_test_queries.query_type IS 'Query type: simple (product names), multi-word, nlp (natural language), typo, synonym, zero-results';
COMMENT ON COLUMN search_test_queries.vertical IS 'Industry vertical detected from company data: retail, marketplace, b2b, publishing, travel, or default';

-- ============================================================================
-- 3. Audit Deliverables
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_deliverables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  deliverable_type TEXT NOT NULL, -- 'deck', 'ae_brief', 'executive_summary', 'pdf_book', 'landing_page', 'content_spec', 'report'
  file_path TEXT NOT NULL, -- S3/Vercel Blob URL or local path
  file_size_bytes INTEGER,
  file_format VARCHAR(10), -- 'pdf', 'md', 'html'
  metadata JSONB, -- Additional info (page count, slide count, etc.)
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,
  UNIQUE (company_id, audit_id, deliverable_type)
);

CREATE INDEX idx_audit_deliverables_audit ON audit_deliverables(company_id, audit_id);
CREATE INDEX idx_audit_deliverables_type ON audit_deliverables(deliverable_type);

COMMENT ON TABLE audit_deliverables IS 'Stores paths to generated deliverables (deck, brief, PDF book, landing page, etc.)';
COMMENT ON COLUMN audit_deliverables.deliverable_type IS 'Type: deck, ae_brief, executive_summary, pdf_book, landing_page, content_spec, report';

-- ============================================================================
-- 4. Search Audit Scoring Matrix (View)
-- ============================================================================

CREATE OR REPLACE VIEW search_audit_scoring_matrix AS
SELECT
  company_id,
  audit_id,

  -- Overall score (weighted average of 10 dimensions)
  ROUND(
    SUM(
      score *
      CASE
        -- Dimension 1: Relevance (15%) - Tests 2c, 2d, 2e
        WHEN test_id IN ('2c', '2d', '2e') THEN 0.15 / 3

        -- Dimension 2: Typo & Synonym Tolerance (15%) - Tests 2f, 2g
        WHEN test_id IN ('2f', '2g') THEN 0.15 / 2

        -- Dimension 3: Federated Search (10%) - Test 2s
        WHEN test_id = '2s' THEN 0.10

        -- Dimension 4: SAYT / Autocomplete (10%) - Test 2m
        WHEN test_id = '2m' THEN 0.10

        -- Dimension 5: Facets & Filters (10%) - Tests 2h, 2o
        WHEN test_id IN ('2h', '2o') THEN 0.10 / 2

        -- Dimension 6: Empty State Handling (10%) - Test 2k
        WHEN test_id = '2k' THEN 0.10

        -- Dimension 7: Semantic / NLP (10%) - Test 2i
        WHEN test_id = '2i' THEN 0.10

        -- Dimension 8: Dynamic Facets & Personalization (5%) - Tests 2o, 2t
        WHEN test_id IN ('2o', '2t') AND test_id = '2o' THEN 0.025
        WHEN test_id IN ('2o', '2t') AND test_id = '2t' THEN 0.025

        -- Dimension 9: Recommendations & Merchandising (10%) - Test 2q
        WHEN test_id = '2q' THEN 0.10

        -- Dimension 10: Search Intelligence (5%) - Tests 2r, 2t
        WHEN test_id IN ('2r', '2t') AND test_id = '2r' THEN 0.025
        WHEN test_id IN ('2r', '2t') AND test_id = '2t' THEN 0.025

        ELSE 0
      END
    ), 1
  ) AS overall_score,

  -- Test counts
  COUNT(*) AS total_tests,
  COUNT(*) FILTER (WHERE passed = false) AS failed_tests,
  COUNT(*) FILTER (WHERE passed = true) AS passed_tests,

  -- Severity counts
  COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'HIGH') AS high_count,
  COUNT(*) FILTER (WHERE severity = 'MEDIUM') AS medium_count,
  COUNT(*) FILTER (WHERE severity = 'LOW') AS low_count,

  -- Dimension scores (for detailed breakdown)
  ROUND(AVG(score) FILTER (WHERE test_id IN ('2c', '2d', '2e')), 1) AS relevance_score,
  ROUND(AVG(score) FILTER (WHERE test_id IN ('2f', '2g')), 1) AS typo_synonym_score,
  ROUND(AVG(score) FILTER (WHERE test_id = '2s'), 1) AS federated_search_score,
  ROUND(AVG(score) FILTER (WHERE test_id = '2m'), 1) AS sayt_score,
  ROUND(AVG(score) FILTER (WHERE test_id IN ('2h', '2o')), 1) AS facets_filters_score,
  ROUND(AVG(score) FILTER (WHERE test_id = '2k'), 1) AS empty_state_score,
  ROUND(AVG(score) FILTER (WHERE test_id = '2i'), 1) AS semantic_nlp_score,
  ROUND(AVG(score) FILTER (WHERE test_id IN ('2o', '2t')), 1) AS dynamic_facets_score,
  ROUND(AVG(score) FILTER (WHERE test_id = '2q'), 1) AS recommendations_score,
  ROUND(AVG(score) FILTER (WHERE test_id IN ('2r', '2t')), 1) AS intelligence_score,

  -- Metadata
  MAX(created_at) AS last_test_at

FROM search_audit_tests
GROUP BY company_id, audit_id;

COMMENT ON VIEW search_audit_scoring_matrix IS '10-dimension search audit scoring with weighted average (Relevance 15%, Typo 15%, etc.)';

-- ============================================================================
-- 5. Latest Scoring (View for easy access)
-- ============================================================================

CREATE OR REPLACE VIEW latest_search_audit_scores AS
SELECT
  sm.*,
  c.name AS company_name,
  a.status AS audit_status,
  a.started_at AS audit_started_at,
  a.completed_at AS audit_completed_at
FROM search_audit_scoring_matrix sm
JOIN companies c ON sm.company_id = c.id
JOIN audits a ON sm.company_id = a.company_id AND sm.audit_id = a.id
WHERE a.completed_at IS NOT NULL
ORDER BY a.completed_at DESC;

COMMENT ON VIEW latest_search_audit_scores IS 'Latest search audit scores with company and audit metadata for easy dashboard access';

-- ============================================================================
-- 6. Update audits table to include overall score
-- ============================================================================

-- Add overall_score column to audits table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audits' AND column_name = 'overall_search_score'
  ) THEN
    ALTER TABLE audits ADD COLUMN overall_search_score NUMERIC(3,1) CHECK (overall_search_score >= 0 AND overall_search_score <= 10);
    COMMENT ON COLUMN audits.overall_search_score IS 'Overall search experience score (0-10) calculated from 10-dimension scoring matrix';
  END IF;
END $$;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Verify tables created
SELECT 'Migration 009 complete. Created tables:' AS status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('search_audit_tests', 'search_test_queries', 'audit_deliverables');

SELECT 'Created views:' AS status;
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('search_audit_scoring_matrix', 'latest_search_audit_scores');
