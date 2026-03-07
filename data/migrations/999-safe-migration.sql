-- ============================================================================
-- SAFE MIGRATION: Apply New Schema While Preserving Existing Data
-- ============================================================================
-- Created: 2026-03-07
-- Purpose: Safely apply migrations 001-003, 005-009 without data loss
-- Method: IF NOT EXISTS checks, CREATE OR REPLACE for views, DROP/CREATE for indexes
-- SKIP: Migration 004 (conflicts with 009)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MIGRATION 001: Core Tables
-- ============================================================================

-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  sector VARCHAR(100),
  founded_year INTEGER,
  headquarters_city VARCHAR(100),
  headquarters_country VARCHAR(2),
  employee_count INTEGER,
  annual_revenue NUMERIC(15,2),
  revenue_currency VARCHAR(3) DEFAULT 'USD',
  is_public BOOLEAN DEFAULT false,
  stock_ticker VARCHAR(10),
  stock_exchange VARCHAR(20),
  website_url TEXT,
  linkedin_url TEXT,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_companies_domain;
CREATE INDEX idx_companies_domain ON companies(domain) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_companies_name;
CREATE INDEX idx_companies_name ON companies(name) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_companies_industry;
CREATE INDEX idx_companies_industry ON companies(industry) WHERE deleted_at IS NULL;

COMMENT ON TABLE companies IS 'Master company entities - stores only company attributes, not audit data';

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  team VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_users_email;
CREATE INDEX idx_users_email ON users(email) WHERE is_active = true;

DROP INDEX IF EXISTS idx_users_role;
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;

-- 3. PARTNER TECHNOLOGIES TABLE
CREATE TABLE IF NOT EXISTS partner_technologies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL,
  vendor VARCHAR(100),
  is_active_partner BOOLEAN DEFAULT true,
  partnership_tier VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_partner_tech_category;
CREATE INDEX idx_partner_tech_category ON partner_technologies(category) WHERE is_active_partner = true;

-- 4. AUDITS TABLE
CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  audit_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  overall_score NUMERIC(3,1),
  fit_score NUMERIC(3,1),
  intent_score NUMERIC(3,1),
  value_score NUMERIC(3,1),
  displacement_score NUMERIC(3,1),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT audits_company_id_unique UNIQUE (company_id, id),
  CONSTRAINT audits_score_range CHECK (overall_score BETWEEN 0 AND 10),
  CONSTRAINT audits_duration_positive CHECK (duration_seconds >= 0)
);

DROP INDEX IF EXISTS idx_audits_company_id;
CREATE INDEX idx_audits_company_id ON audits(company_id, created_at DESC) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_audits_status;
CREATE INDEX idx_audits_status ON audits(status) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_audits_type;
CREATE INDEX idx_audits_type ON audits(audit_type) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_audits_created_by;
CREATE INDEX idx_audits_created_by ON audits(created_by, created_at DESC);

DROP INDEX IF EXISTS idx_audits_completed;
CREATE INDEX idx_audits_completed ON audits(completed_at DESC) WHERE status = 'completed' AND deleted_at IS NULL;

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_technologies_updated_at ON partner_technologies;
CREATE TRIGGER update_partner_technologies_updated_at BEFORE UPDATE ON partner_technologies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audits_updated_at ON audits;
CREATE TRIGGER update_audits_updated_at BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION 002: Enrichment Tables
-- ============================================================================

-- 1. COMPANY TRAFFIC
CREATE TABLE IF NOT EXISTS company_traffic (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  month DATE NOT NULL,
  monthly_visits BIGINT,
  unique_visitors BIGINT,
  page_views BIGINT,
  bounce_rate NUMERIC(5,2),
  avg_visit_duration INTEGER,
  pages_per_visit NUMERIC(5,2),
  direct_traffic_pct NUMERIC(5,2),
  search_traffic_pct NUMERIC(5,2),
  social_traffic_pct NUMERIC(5,2),
  referral_traffic_pct NUMERIC(5,2),
  paid_traffic_pct NUMERIC(5,2),
  email_traffic_pct NUMERIC(5,2),
  top_country VARCHAR(2),
  top_country_pct NUMERIC(5,2),
  desktop_pct NUMERIC(5,2),
  mobile_pct NUMERIC(5,2),
  tablet_pct NUMERIC(5,2),
  source_provider VARCHAR(50) DEFAULT 'similarweb',
  source_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, month),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,
  CONSTRAINT traffic_bounce_rate_range CHECK (bounce_rate BETWEEN 0 AND 100)
);

DROP INDEX IF EXISTS idx_traffic_fetched;
CREATE INDEX idx_traffic_fetched ON company_traffic(fetched_at DESC);

-- 2. COMPANY FINANCIALS
CREATE TABLE IF NOT EXISTS company_financials (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(15,2),
  gross_profit NUMERIC(15,2),
  operating_income NUMERIC(15,2),
  net_income NUMERIC(15,2),
  total_assets NUMERIC(15,2),
  total_liabilities NUMERIC(15,2),
  shareholders_equity NUMERIC(15,2),
  cash_and_equivalents NUMERIC(15,2),
  operating_cash_flow NUMERIC(15,2),
  investing_cash_flow NUMERIC(15,2),
  financing_cash_flow NUMERIC(15,2),
  free_cash_flow NUMERIC(15,2),
  ebitda NUMERIC(15,2),
  earnings_per_share NUMERIC(8,2),
  price_to_earnings NUMERIC(8,2),
  source_provider VARCHAR(50),
  source_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, fiscal_year, fiscal_quarter),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,
  CONSTRAINT financials_quarter_range CHECK (fiscal_quarter BETWEEN 0 AND 4)
);

DROP INDEX IF EXISTS idx_financials_year;
CREATE INDEX idx_financials_year ON company_financials(fiscal_year DESC);

-- 3. COMPANY TECHNOLOGIES
CREATE TABLE IF NOT EXISTS company_technologies (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  technology_name VARCHAR(100) NOT NULL,
  technology_category VARCHAR(50),
  technology_vendor VARCHAR(100),
  confidence_level VARCHAR(20),
  first_detected DATE,
  last_detected DATE,
  source_provider VARCHAR(50) DEFAULT 'builtwith',
  source_url TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, technology_name),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_tech_category;
CREATE INDEX idx_tech_category ON company_technologies(technology_category);

DROP INDEX IF EXISTS idx_tech_name;
CREATE INDEX idx_tech_name ON company_technologies(technology_name);

-- 4. COMPANY COMPETITORS
CREATE TABLE IF NOT EXISTS company_competitors (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  competitor_domain VARCHAR(255) NOT NULL,
  competitor_name VARCHAR(255),
  similarity_score NUMERIC(5,2),
  competitor_search_provider VARCHAR(100),
  competitor_ecommerce_platform VARCHAR(100),
  competitor_monthly_visits BIGINT,
  traffic_ratio NUMERIC(10,4),
  source_provider VARCHAR(50) DEFAULT 'similarweb',
  source_url TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, competitor_domain),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_competitors_similarity;
CREATE INDEX idx_competitors_similarity ON company_competitors(similarity_score DESC);

-- 5. COMPANY EXECUTIVES
CREATE TABLE IF NOT EXISTS company_executives (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  role_category VARCHAR(50),
  department VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url TEXT,
  start_date DATE,
  is_current BOOLEAN DEFAULT true,
  source_provider VARCHAR(50),
  apollo_person_id VARCHAR(100),
  fetched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, full_name),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_executives_role;
CREATE INDEX idx_executives_role ON company_executives(role_category);

-- 6. EXECUTIVE QUOTES
CREATE TABLE IF NOT EXISTS executive_quotes (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  executive_name VARCHAR(255) NOT NULL,
  quote_text TEXT NOT NULL,
  context TEXT,
  keywords TEXT[],
  source_type VARCHAR(50),
  source_date DATE,
  source_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, executive_name, source_type, source_date),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_quotes_keywords;
CREATE INDEX idx_quotes_keywords ON executive_quotes USING GIN (keywords);

DROP INDEX IF EXISTS idx_quotes_source;
CREATE INDEX idx_quotes_source ON executive_quotes(source_type, source_date DESC);

-- 7. COMPANY SOCIAL PROFILES
CREATE TABLE IF NOT EXISTS company_social_profiles (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL,
  profile_url TEXT NOT NULL,
  follower_count INTEGER,
  following_count INTEGER,
  avg_likes_per_post NUMERIC(10,2),
  avg_comments_per_post NUMERIC(10,2),
  avg_shares_per_post NUMERIC(10,2),
  engagement_rate NUMERIC(5,2),
  post_frequency_per_week NUMERIC(5,2),
  last_post_date DATE,
  source_actor VARCHAR(100),
  fetched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, platform),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

-- 8. COMPANY SOCIAL POSTS
CREATE TABLE IF NOT EXISTS company_social_posts (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL,
  post_url TEXT NOT NULL,
  post_text TEXT,
  post_date TIMESTAMP,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  mentions_search BOOLEAN DEFAULT false,
  sentiment VARCHAR(20),
  scraped_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, platform, post_url),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_posts_date;
CREATE INDEX idx_posts_date ON company_social_posts(post_date DESC);

DROP INDEX IF EXISTS idx_posts_mentions;
CREATE INDEX idx_posts_mentions ON company_social_posts(mentions_search) WHERE mentions_search = true;

-- 9. BUYING COMMITTEE
CREATE TABLE IF NOT EXISTS buying_committee (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  role_category VARCHAR(50),
  department VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url TEXT,
  seniority_level VARCHAR(50),
  apollo_person_id VARCHAR(100),
  source_provider VARCHAR(50) DEFAULT 'apollo',
  fetched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, full_name),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_buying_committee_role;
CREATE INDEX idx_buying_committee_role ON buying_committee(role_category);

DROP INDEX IF EXISTS idx_buying_committee_seniority;
CREATE INDEX idx_buying_committee_seniority ON buying_committee(seniority_level);

-- 10. INTENT SIGNALS
CREATE TABLE IF NOT EXISTS intent_signals (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  signal_type VARCHAR(50) NOT NULL,
  signal_description TEXT NOT NULL,
  signal_category VARCHAR(50),
  confidence_score NUMERIC(5,2),
  detected_at TIMESTAMP DEFAULT NOW(),
  source_provider VARCHAR(50) DEFAULT 'apollo',
  source_url TEXT,
  PRIMARY KEY (company_id, audit_id, signal_type, signal_description),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_intent_category;
CREATE INDEX idx_intent_category ON intent_signals(signal_category);

DROP INDEX IF EXISTS idx_intent_detected;
CREATE INDEX idx_intent_detected ON intent_signals(detected_at DESC);

-- 11. COMPANY HIRING
CREATE TABLE IF NOT EXISTS company_hiring (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  posted_date DATE NOT NULL,
  department VARCHAR(100),
  role_category VARCHAR(50),
  location VARCHAR(255),
  employment_type VARCHAR(50),
  is_buying_committee BOOLEAN DEFAULT false,
  keywords TEXT[],
  source_url TEXT,
  fetched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, job_title, posted_date),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_hiring_buying_committee;
CREATE INDEX idx_hiring_buying_committee ON company_hiring(is_buying_committee) WHERE is_buying_committee = true;

DROP INDEX IF EXISTS idx_hiring_keywords;
CREATE INDEX idx_hiring_keywords ON company_hiring USING GIN (keywords);

DROP INDEX IF EXISTS idx_hiring_posted;
CREATE INDEX idx_hiring_posted ON company_hiring(posted_date DESC);

-- ============================================================================
-- MIGRATION 003: Partner Intelligence Tables
-- ============================================================================

-- 1. DISPLACEMENT OPPORTUNITIES
CREATE TABLE IF NOT EXISTS displacement_opportunities (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  partner_tech_id UUID NOT NULL REFERENCES partner_technologies(id) ON DELETE RESTRICT,
  fit_score NUMERIC(3,1),
  intent_score NUMERIC(3,1),
  value_score NUMERIC(3,1),
  displacement_score NUMERIC(3,1),
  overall_score NUMERIC(3,1),
  opportunity_status VARCHAR(50) DEFAULT 'cold',
  assigned_to UUID REFERENCES users(id),
  current_search_provider VARCHAR(100),
  estimated_annual_value NUMERIC(12,2),
  estimated_deal_size NUMERIC(12,2),
  notes TEXT,
  next_action VARCHAR(255),
  next_action_date DATE,
  detected_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id, partner_tech_id),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,
  CONSTRAINT displacement_scores_range CHECK (
    fit_score BETWEEN 0 AND 10 AND
    intent_score BETWEEN 0 AND 10 AND
    value_score BETWEEN 0 AND 10 AND
    displacement_score BETWEEN 0 AND 10 AND
    overall_score BETWEEN 0 AND 10
  )
);

DROP INDEX IF EXISTS idx_displacement_status;
CREATE INDEX idx_displacement_status ON displacement_opportunities(opportunity_status);

DROP INDEX IF EXISTS idx_displacement_score;
CREATE INDEX idx_displacement_score ON displacement_opportunities(overall_score DESC);

DROP INDEX IF EXISTS idx_displacement_assigned;
CREATE INDEX idx_displacement_assigned ON displacement_opportunities(assigned_to);

DROP INDEX IF EXISTS idx_displacement_detected;
CREATE INDEX idx_displacement_detected ON displacement_opportunities(detected_at DESC);

DROP TRIGGER IF EXISTS update_displacement_last_updated ON displacement_opportunities;
CREATE TRIGGER update_displacement_last_updated BEFORE UPDATE ON displacement_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. PARTNER ENGAGEMENT LOG
CREATE TABLE IF NOT EXISTS partner_engagement_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  partner_tech_id UUID REFERENCES partner_technologies(id) ON DELETE CASCADE,
  engagement_type VARCHAR(50) NOT NULL,
  engagement_date TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  outcome VARCHAR(50),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_engagement_company;
CREATE INDEX idx_engagement_company ON partner_engagement_log(company_id, engagement_date DESC);

DROP INDEX IF EXISTS idx_engagement_type;
CREATE INDEX idx_engagement_type ON partner_engagement_log(engagement_type);

DROP INDEX IF EXISTS idx_engagement_date;
CREATE INDEX idx_engagement_date ON partner_engagement_log(engagement_date DESC);

-- ============================================================================
-- MIGRATION 005: Activity Tables
-- ============================================================================

-- 1. AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id),
  actor_email VARCHAR(255),
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_audit_log_actor;
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);

DROP INDEX IF EXISTS idx_audit_log_resource;
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id, created_at DESC);

DROP INDEX IF EXISTS idx_audit_log_action;
CREATE INDEX idx_audit_log_action ON audit_log(action_type, created_at DESC);

DROP INDEX IF EXISTS idx_audit_log_created;
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- 2. API CALL LOG
CREATE TABLE IF NOT EXISTS api_call_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_params JSONB,
  cache_key VARCHAR(255),
  status_code INTEGER,
  response_time_ms INTEGER,
  was_cached BOOLEAN DEFAULT false,
  cost_usd NUMERIC(10,6),
  api_credits_used INTEGER,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  error_message TEXT,
  retry_attempt INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_api_calls_provider;
CREATE INDEX idx_api_calls_provider ON api_call_log(provider, created_at DESC);

DROP INDEX IF EXISTS idx_api_calls_audit;
CREATE INDEX idx_api_calls_audit ON api_call_log(audit_id);

DROP INDEX IF EXISTS idx_api_calls_company;
CREATE INDEX idx_api_calls_company ON api_call_log(company_id, created_at DESC);

DROP INDEX IF EXISTS idx_api_calls_cached;
CREATE INDEX idx_api_calls_cached ON api_call_log(was_cached, created_at DESC);

DROP INDEX IF EXISTS idx_api_calls_cost;
CREATE INDEX idx_api_calls_cost ON api_call_log(cost_usd DESC) WHERE cost_usd > 0;

-- 3. API ERROR LOG
CREATE TABLE IF NOT EXISTS api_error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  error_type VARCHAR(100),
  error_message TEXT,
  http_status_code INTEGER,
  request_params JSONB,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  retry_count INTEGER DEFAULT 0,
  will_retry BOOLEAN DEFAULT true,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_api_errors_provider;
CREATE INDEX idx_api_errors_provider ON api_error_log(provider, created_at DESC);

DROP INDEX IF EXISTS idx_api_errors_type;
CREATE INDEX idx_api_errors_type ON api_error_log(error_type);

DROP INDEX IF EXISTS idx_api_errors_audit;
CREATE INDEX idx_api_errors_audit ON api_error_log(audit_id);

DROP INDEX IF EXISTS idx_api_errors_created;
CREATE INDEX idx_api_errors_created ON api_error_log(created_at DESC);

-- 4. DATA FRESHNESS
CREATE TABLE IF NOT EXISTS data_freshness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL,
  last_fetched_at TIMESTAMP,
  next_refresh_at TIMESTAMP,
  is_stale BOOLEAN DEFAULT false,
  refresh_frequency_days INTEGER DEFAULT 30,
  CONSTRAINT freshness_unique UNIQUE (company_id, data_type)
);

DROP INDEX IF EXISTS idx_freshness_stale;
CREATE INDEX idx_freshness_stale ON data_freshness(is_stale, next_refresh_at) WHERE is_stale = true;

DROP INDEX IF EXISTS idx_freshness_company;
CREATE INDEX idx_freshness_company ON data_freshness(company_id);

-- 5. ENRICHMENT CACHE
CREATE TABLE IF NOT EXISTS enrichment_cache (
  key VARCHAR(255) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  source_url TEXT,
  http_status INTEGER,
  data_size_bytes INTEGER
);

DROP INDEX IF EXISTS idx_cache_provider;
CREATE INDEX idx_cache_provider ON enrichment_cache(provider);

DROP INDEX IF EXISTS idx_cache_expires;
CREATE INDEX idx_cache_expires ON enrichment_cache(expires_at);

DROP INDEX IF EXISTS idx_cache_accessed;
CREATE INDEX idx_cache_accessed ON enrichment_cache(last_accessed_at DESC);

-- ============================================================================
-- MIGRATION 006: Views
-- ============================================================================

CREATE OR REPLACE VIEW latest_audits AS
SELECT DISTINCT ON (company_id)
  *
FROM audits
WHERE deleted_at IS NULL
ORDER BY company_id, created_at DESC;

CREATE OR REPLACE VIEW company_traffic_latest AS
SELECT DISTINCT ON (t.company_id, t.month)
  t.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY t.company_id, t.month, a.created_at DESC;

CREATE OR REPLACE VIEW company_financials_latest AS
SELECT DISTINCT ON (f.company_id, f.fiscal_year, f.fiscal_quarter)
  f.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_financials f
JOIN audits a ON f.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY f.company_id, f.fiscal_year DESC, f.fiscal_quarter DESC, a.created_at DESC;

CREATE OR REPLACE VIEW company_technologies_latest AS
SELECT DISTINCT ON (t.company_id, t.technology_name)
  t.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_technologies t
JOIN audits a ON t.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY t.company_id, t.technology_name, a.created_at DESC;

CREATE OR REPLACE VIEW company_competitors_latest AS
SELECT DISTINCT ON (c.company_id, c.competitor_domain)
  c.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_competitors c
JOIN audits a ON c.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY c.company_id, c.competitor_domain, a.created_at DESC;

CREATE OR REPLACE VIEW company_executives_latest AS
SELECT DISTINCT ON (e.company_id, e.full_name)
  e.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_executives e
JOIN audits a ON e.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY e.company_id, e.full_name, a.created_at DESC;

CREATE OR REPLACE VIEW company_social_profiles_latest AS
SELECT DISTINCT ON (s.company_id, s.platform)
  s.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_social_profiles s
JOIN audits a ON s.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY s.company_id, s.platform, a.created_at DESC;

CREATE OR REPLACE VIEW buying_committee_latest AS
SELECT DISTINCT ON (b.company_id, b.full_name)
  b.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM buying_committee b
JOIN audits a ON b.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY b.company_id, b.full_name, a.created_at DESC;

CREATE OR REPLACE VIEW company_hiring_latest AS
SELECT DISTINCT ON (h.company_id, h.job_title, h.posted_date)
  h.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_hiring h
JOIN audits a ON h.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY h.company_id, h.job_title, h.posted_date, a.created_at DESC;

CREATE OR REPLACE VIEW displacement_opportunities_latest AS
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

CREATE OR REPLACE VIEW company_overview AS
SELECT
  c.*,
  la.id as latest_audit_id,
  la.audit_type as latest_audit_type,
  la.created_at as latest_audit_date,
  la.overall_score as latest_audit_score,
  la.status as latest_audit_status,
  (SELECT monthly_visits FROM company_traffic_latest ctl
   WHERE ctl.company_id = c.id
   ORDER BY ctl.month DESC LIMIT 1) as latest_monthly_visits,
  (SELECT COUNT(*) FROM company_technologies_latest tech
   WHERE tech.company_id = c.id) as tech_stack_count,
  (SELECT COUNT(*) FROM displacement_opportunities_latest d
   WHERE d.company_id = c.id) as displacement_opportunities_count,
  (SELECT COUNT(*) FROM displacement_opportunities_latest d
   WHERE d.company_id = c.id AND d.overall_score >= 8.0) as hot_opportunities_count
FROM companies c
LEFT JOIN latest_audits la ON la.company_id = c.id
WHERE c.deleted_at IS NULL;

-- ============================================================================
-- MIGRATION 007: Performance Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_companies_search;
CREATE INDEX idx_companies_search ON companies USING gin(to_tsvector('english', name || ' ' || domain))
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_audits_company_type_status;
CREATE INDEX idx_audits_company_type_status ON audits(company_id, audit_type, status, created_at DESC)
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_displacement_status_score;
CREATE INDEX idx_displacement_status_score ON displacement_opportunities(opportunity_status, overall_score DESC);

DROP INDEX IF EXISTS idx_displacement_assigned_status;
CREATE INDEX idx_displacement_assigned_status ON displacement_opportunities(assigned_to, opportunity_status)
WHERE assigned_to IS NOT NULL;

DROP INDEX IF EXISTS idx_api_call_params;
CREATE INDEX idx_api_call_params ON api_call_log USING gin(request_params);

DROP INDEX IF EXISTS idx_audit_log_old_value;
CREATE INDEX idx_audit_log_old_value ON audit_log USING gin(old_value);

DROP INDEX IF EXISTS idx_audit_log_new_value;
CREATE INDEX idx_audit_log_new_value ON audit_log USING gin(new_value);

DROP INDEX IF EXISTS idx_audits_failed;
CREATE INDEX idx_audits_failed ON audits(company_id, created_at DESC)
WHERE status = 'failed' AND deleted_at IS NULL;

DROP INDEX IF EXISTS idx_audits_running;
CREATE INDEX idx_audits_running ON audits(created_at)
WHERE status = 'running' AND deleted_at IS NULL;

DROP INDEX IF EXISTS idx_displacement_hot;
CREATE INDEX idx_displacement_hot ON displacement_opportunities(company_id, audit_id, overall_score DESC)
WHERE overall_score >= 8.0;

DROP INDEX IF EXISTS idx_buying_committee_decision_makers;
CREATE INDEX idx_buying_committee_decision_makers ON buying_committee(company_id, audit_id, full_name)
WHERE role_category = 'decision_maker';

DROP INDEX IF EXISTS idx_traffic_visits;
CREATE INDEX idx_traffic_visits ON company_traffic(monthly_visits DESC);

DROP INDEX IF EXISTS idx_financials_revenue;
CREATE INDEX idx_financials_revenue ON company_financials(revenue DESC);

DROP INDEX IF EXISTS idx_api_calls_cost_provider;
CREATE INDEX idx_api_calls_cost_provider ON api_call_log(provider, cost_usd DESC)
WHERE cost_usd > 0;

DROP INDEX IF EXISTS idx_cache_hit_count;
CREATE INDEX idx_cache_hit_count ON enrichment_cache(hit_count DESC, last_accessed_at DESC);

DROP INDEX IF EXISTS idx_companies_basic_info;
CREATE INDEX idx_companies_basic_info ON companies(id, domain, name, industry, annual_revenue)
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_audits_with_scores;
CREATE INDEX idx_audits_with_scores ON audits(company_id, id, overall_score, status, created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- MIGRATION 008: Strategic Insights
-- ============================================================================

-- Add insight columns to enrichment tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_traffic' AND column_name='insight') THEN
    ALTER TABLE company_traffic
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_financials' AND column_name='insight') THEN
    ALTER TABLE company_financials
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_technologies' AND column_name='insight') THEN
    ALTER TABLE company_technologies
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_competitors' AND column_name='insight') THEN
    ALTER TABLE company_competitors
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_executives' AND column_name='insight') THEN
    ALTER TABLE company_executives
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='executive_quotes' AND column_name='insight') THEN
    ALTER TABLE executive_quotes
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_social_profiles' AND column_name='insight') THEN
    ALTER TABLE company_social_profiles
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_social_posts' AND column_name='insight') THEN
    ALTER TABLE company_social_posts
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='buying_committee' AND column_name='insight') THEN
    ALTER TABLE buying_committee
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intent_signals' AND column_name='insight') THEN
    ALTER TABLE intent_signals
      ADD COLUMN insight TEXT,
      ADD COLUMN evidence_urls TEXT[];
    -- Note: intent_signals already has confidence_score for signal confidence, not adding duplicate
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_hiring' AND column_name='insight') THEN
    ALTER TABLE company_hiring
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;
END $$;

-- Company Strategic Analysis Table
CREATE TABLE IF NOT EXISTS company_strategic_analysis (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  primary_value_prop VARCHAR(100) NOT NULL,
  secondary_value_props VARCHAR(100)[] NOT NULL DEFAULT '{}',
  sales_pitch TEXT NOT NULL,
  business_impact TEXT NOT NULL,
  strategic_recommendations TEXT NOT NULL,
  trigger_events TEXT[] NOT NULL DEFAULT '{}',
  timing_signals TEXT[] NOT NULL DEFAULT '{}',
  caution_signals TEXT[] NOT NULL DEFAULT '{}',
  overall_confidence_score NUMERIC(3,1) NOT NULL CHECK (overall_confidence_score >= 8.0 AND overall_confidence_score <= 10.0),
  insights_synthesized_from TEXT[] NOT NULL,
  analysis_generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, audit_id),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_company_strategic_analysis_primary_value_prop;
CREATE INDEX idx_company_strategic_analysis_primary_value_prop
  ON company_strategic_analysis(primary_value_prop);

DROP INDEX IF EXISTS idx_company_strategic_analysis_confidence;
CREATE INDEX idx_company_strategic_analysis_confidence
  ON company_strategic_analysis(overall_confidence_score DESC);

DROP INDEX IF EXISTS idx_company_traffic_insight_confidence;
CREATE INDEX idx_company_traffic_insight_confidence
  ON company_traffic(confidence_score DESC)
  WHERE insight IS NOT NULL;

DROP INDEX IF EXISTS idx_company_financials_insight_confidence;
CREATE INDEX idx_company_financials_insight_confidence
  ON company_financials(confidence_score DESC)
  WHERE insight IS NOT NULL;

DROP INDEX IF EXISTS idx_company_hiring_insight_confidence;
CREATE INDEX idx_company_hiring_insight_confidence
  ON company_hiring(confidence_score DESC)
  WHERE insight IS NOT NULL;

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

-- ============================================================================
-- MIGRATION 009: Search Audit Tests & Scoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_audit_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  test_id VARCHAR(10) NOT NULL,
  test_name TEXT NOT NULL,
  query TEXT,
  passed BOOLEAN NOT NULL,
  score NUMERIC(3,1) CHECK (score >= 0 AND score <= 10),
  finding TEXT,
  severity VARCHAR(10) CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  evidence TEXT,
  screenshot_path TEXT,
  finding_details JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,
  UNIQUE (company_id, audit_id, test_id)
);

DROP INDEX IF EXISTS idx_search_audit_tests_audit;
CREATE INDEX idx_search_audit_tests_audit ON search_audit_tests(company_id, audit_id);

DROP INDEX IF EXISTS idx_search_audit_tests_severity;
CREATE INDEX idx_search_audit_tests_severity ON search_audit_tests(severity) WHERE passed = false;

DROP INDEX IF EXISTS idx_search_audit_tests_score;
CREATE INDEX idx_search_audit_tests_score ON search_audit_tests(score);

DROP INDEX IF EXISTS idx_tests_finding_details;
CREATE INDEX idx_tests_finding_details ON search_audit_tests USING gin(finding_details);

DROP INDEX IF EXISTS idx_tests_high_severity_failures;
CREATE INDEX idx_tests_high_severity_failures ON search_audit_tests(company_id, audit_id, test_name)
WHERE severity = 'high' AND passed = false;

-- Add insight columns to search_audit_tests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='search_audit_tests' AND column_name='insight') THEN
    ALTER TABLE search_audit_tests
      ADD COLUMN insight TEXT,
      ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
      ADD COLUMN evidence_urls TEXT[];
  END IF;
END $$;

DROP INDEX IF EXISTS idx_search_audit_tests_insight_confidence;
CREATE INDEX idx_search_audit_tests_insight_confidence
  ON search_audit_tests(confidence_score DESC)
  WHERE insight IS NOT NULL;

CREATE TABLE IF NOT EXISTS search_test_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  query TEXT NOT NULL,
  query_type VARCHAR(20) NOT NULL,
  expected_min_results INT,
  expected_contains TEXT[],
  expected_excludes TEXT[],
  vertical VARCHAR(50),
  test_id VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS idx_search_test_queries_audit;
CREATE INDEX idx_search_test_queries_audit ON search_test_queries(company_id, audit_id);

DROP INDEX IF EXISTS idx_search_test_queries_type;
CREATE INDEX idx_search_test_queries_type ON search_test_queries(query_type);

DROP INDEX IF EXISTS idx_search_test_queries_vertical;
CREATE INDEX idx_search_test_queries_vertical ON search_test_queries(vertical);

CREATE TABLE IF NOT EXISTS audit_deliverables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  deliverable_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  file_format VARCHAR(10),
  metadata JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,
  UNIQUE (company_id, audit_id, deliverable_type)
);

DROP INDEX IF EXISTS idx_audit_deliverables_audit;
CREATE INDEX idx_audit_deliverables_audit ON audit_deliverables(company_id, audit_id);

DROP INDEX IF EXISTS idx_audit_deliverables_type;
CREATE INDEX idx_audit_deliverables_type ON audit_deliverables(deliverable_type);

CREATE OR REPLACE VIEW search_audit_scoring_matrix AS
SELECT
  company_id,
  audit_id,
  ROUND(
    SUM(
      score *
      CASE
        WHEN test_id IN ('2c', '2d', '2e') THEN 0.15 / 3
        WHEN test_id IN ('2f', '2g') THEN 0.15 / 2
        WHEN test_id = '2s' THEN 0.10
        WHEN test_id = '2m' THEN 0.10
        WHEN test_id IN ('2h', '2o') THEN 0.10 / 2
        WHEN test_id = '2k' THEN 0.10
        WHEN test_id = '2i' THEN 0.10
        WHEN test_id IN ('2o', '2t') AND test_id = '2o' THEN 0.025
        WHEN test_id IN ('2o', '2t') AND test_id = '2t' THEN 0.025
        WHEN test_id = '2q' THEN 0.10
        WHEN test_id IN ('2r', '2t') AND test_id = '2r' THEN 0.025
        WHEN test_id IN ('2r', '2t') AND test_id = '2t' THEN 0.025
        ELSE 0
      END
    ), 1
  ) AS overall_score,
  COUNT(*) AS total_tests,
  COUNT(*) FILTER (WHERE passed = false) AS failed_tests,
  COUNT(*) FILTER (WHERE passed = true) AS passed_tests,
  COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'HIGH') AS high_count,
  COUNT(*) FILTER (WHERE severity = 'MEDIUM') AS medium_count,
  COUNT(*) FILTER (WHERE severity = 'LOW') AS low_count,
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
  MAX(created_at) AS last_test_at
FROM search_audit_tests
GROUP BY company_id, audit_id;

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

CREATE OR REPLACE VIEW search_audit_tests_latest AS
SELECT DISTINCT ON (t.company_id, t.test_name)
  t.*,
  c.name as company_name,
  c.domain as company_domain,
  a.created_at as audit_date,
  a.overall_score as audit_overall_score
FROM search_audit_tests t
JOIN audits a ON t.audit_id = a.id
JOIN companies c ON t.company_id = c.id
WHERE a.deleted_at IS NULL AND c.deleted_at IS NULL
ORDER BY t.company_id, t.test_name, a.created_at DESC;

-- Add overall_search_score to audits table
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
-- Update Statistics
-- ============================================================================

ANALYZE companies;
ANALYZE audits;
ANALYZE company_traffic;
ANALYZE company_financials;
ANALYZE company_technologies;
ANALYZE displacement_opportunities;
ANALYZE search_audit_tests;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables
SELECT 'Migration complete. Total tables:' AS status;
SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';

-- Verify views
SELECT 'Total views:' AS status;
SELECT COUNT(*) AS view_count FROM information_schema.views WHERE table_schema='public';

-- Check company count (existing data preservation)
SELECT 'Companies preserved:' AS status;
SELECT COUNT(*) AS company_count FROM companies;
