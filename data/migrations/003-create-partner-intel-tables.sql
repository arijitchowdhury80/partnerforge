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
