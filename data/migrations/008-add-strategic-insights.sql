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

-- 12. SEARCH AUDIT TESTS (Search audit insights)
ALTER TABLE search_audit_tests
  ADD COLUMN insight TEXT,
  ADD COLUMN confidence_score NUMERIC(3,1) CHECK (confidence_score >= 8.0 AND confidence_score <= 10.0),
  ADD COLUMN evidence_urls TEXT[];

COMMENT ON COLUMN search_audit_tests.insight IS 'Strategic insight from search audit test (e.g., "Zero typo tolerance - users hitting dead ends")';

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

CREATE INDEX idx_search_audit_tests_insight_confidence
  ON search_audit_tests(confidence_score DESC)
  WHERE insight IS NOT NULL;

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
