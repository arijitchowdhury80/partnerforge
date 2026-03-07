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
