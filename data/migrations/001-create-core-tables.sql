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
