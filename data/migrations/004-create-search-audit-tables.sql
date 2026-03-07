-- Migration 004: Create Search Audit Tables
-- Description: Browser tests, screenshots, and findings
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: 001-create-core-tables.sql

-- =============================================================================
-- SEARCH AUDIT TABLES
-- =============================================================================

-- =============================================================================
-- 1. SEARCH AUDIT TESTS (One row per test)
-- =============================================================================
CREATE TABLE search_audit_tests (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  test_name VARCHAR(100) NOT NULL, -- 'homepage_search' | 'mobile_facets' | 'nlp_query'

  test_category VARCHAR(50), -- 'search_ux' | 'facets' | 'mobile' | 'nlp' | 'personalization'
  test_phase VARCHAR(20), -- 'phase2' | 'phase3' (browser tests vs scoring)

  -- Test execution
  test_query VARCHAR(500),
  executed_at TIMESTAMP DEFAULT NOW(),

  -- Results
  passed BOOLEAN,
  score NUMERIC(3,1), -- 0-10
  severity VARCHAR(20), -- 'high' | 'medium' | 'low'

  -- Findings
  finding_summary TEXT NOT NULL,
  finding_details JSONB, -- Structured finding data (OK to use JSONB here for flexibility)

  -- Screenshots
  screenshot_count INTEGER DEFAULT 0,

  -- Metadata
  duration_ms INTEGER, -- Test execution time

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, test_name),

  -- Composite FK
  FOREIGN KEY (company_id, audit_id) REFERENCES audits(company_id, id) ON DELETE CASCADE,

  -- Validation
  CONSTRAINT test_score_range CHECK (score BETWEEN 0 AND 10)
);

CREATE INDEX idx_tests_category ON search_audit_tests(test_category);
CREATE INDEX idx_tests_severity ON search_audit_tests(severity) WHERE passed = false;
CREATE INDEX idx_tests_executed ON search_audit_tests(executed_at DESC);

COMMENT ON TABLE search_audit_tests IS 'Browser-based search tests - one row per test per audit';
COMMENT ON COLUMN search_audit_tests.finding_details IS 'Structured finding data - JSONB is OK here for flexibility';

-- =============================================================================
-- 2. SEARCH AUDIT SCREENSHOTS (Many per test)
-- =============================================================================
CREATE TABLE search_audit_screenshots (
  company_id UUID NOT NULL,
  audit_id UUID NOT NULL,
  test_name VARCHAR(100) NOT NULL,
  sequence_number INTEGER NOT NULL,

  file_path TEXT NOT NULL, -- e.g., 'screenshots/costco/audit-123/01-homepage-search.png'
  file_size INTEGER, -- bytes
  storage_provider VARCHAR(50) DEFAULT 'local', -- 'local' | 's3' | 'vercel_blob'

  -- Metadata
  caption TEXT,
  width INTEGER,
  height INTEGER,

  captured_at TIMESTAMP DEFAULT NOW(),

  -- Composite PK
  PRIMARY KEY (company_id, audit_id, test_name, sequence_number),

  -- Composite FK to test
  FOREIGN KEY (company_id, audit_id, test_name)
    REFERENCES search_audit_tests(company_id, audit_id, test_name) ON DELETE CASCADE
);

CREATE INDEX idx_screenshots_captured ON search_audit_screenshots(captured_at DESC);

COMMENT ON TABLE search_audit_screenshots IS 'Screenshots captured during browser tests - many per test';
COMMENT ON COLUMN search_audit_screenshots.file_path IS 'Relative or absolute path depending on storage_provider';

-- =============================================================================
-- END OF MIGRATION 004
-- =============================================================================
