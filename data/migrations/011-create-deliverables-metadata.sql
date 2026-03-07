-- ============================================================================
-- Migration 011: Create Deliverables Metadata Table
-- ============================================================================
-- Purpose: Track generated audit deliverables (PDF, landing page, deck, briefs)
--          with file paths, generation timestamps, and metadata
-- Date: March 8, 2026
-- ============================================================================

-- ============================================================================
-- TABLE: audit_deliverables_metadata
-- ============================================================================
-- Tracks all deliverables generated for an audit (7 files per audit)
-- Primary key: (company_id, audit_id) - one record per audit
-- ============================================================================

CREATE TABLE audit_deliverables_metadata (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,

  -- Generation metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_files INTEGER NOT NULL CHECK (total_files >= 0 AND total_files <= 7),
  total_size_bytes BIGINT NOT NULL CHECK (total_size_bytes >= 0),
  estimated_read_time_minutes INTEGER CHECK (estimated_read_time_minutes >= 0),

  -- File paths (relative to deliverables base directory)
  pdf_book_path TEXT,
  landing_page_html_path TEXT,
  landing_page_spec_path TEXT,
  deck_markdown_path TEXT,
  ae_brief_path TEXT,
  signal_brief_path TEXT,
  markdown_report_path TEXT,

  -- Status tracking
  generation_status TEXT NOT NULL DEFAULT 'completed' CHECK (generation_status IN ('pending', 'in_progress', 'completed', 'failed', 'partial')),
  generation_error TEXT,
  generation_duration_seconds INTEGER,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE (company_id, audit_id) -- One deliverables record per audit
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_deliverables_metadata_company ON audit_deliverables_metadata(company_id);
CREATE INDEX idx_deliverables_metadata_audit ON audit_deliverables_metadata(audit_id);
CREATE INDEX idx_deliverables_metadata_generated_at ON audit_deliverables_metadata(generated_at DESC);
CREATE INDEX idx_deliverables_metadata_status ON audit_deliverables_metadata(generation_status);

-- Composite index for common queries
CREATE INDEX idx_deliverables_metadata_company_audit ON audit_deliverables_metadata(company_id, audit_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE audit_deliverables_metadata IS 'Tracks generated audit deliverables with file paths and metadata';

COMMENT ON COLUMN audit_deliverables_metadata.company_id IS 'Reference to company';
COMMENT ON COLUMN audit_deliverables_metadata.audit_id IS 'Reference to audit';
COMMENT ON COLUMN audit_deliverables_metadata.generated_at IS 'When deliverables were generated';
COMMENT ON COLUMN audit_deliverables_metadata.total_files IS 'Total number of files generated (0-7)';
COMMENT ON COLUMN audit_deliverables_metadata.total_size_bytes IS 'Total size of all files in bytes';
COMMENT ON COLUMN audit_deliverables_metadata.estimated_read_time_minutes IS 'Estimated time to read all deliverables';

COMMENT ON COLUMN audit_deliverables_metadata.pdf_book_path IS 'Path to PDF book (36-47 pages)';
COMMENT ON COLUMN audit_deliverables_metadata.landing_page_html_path IS 'Path to HTML landing page';
COMMENT ON COLUMN audit_deliverables_metadata.landing_page_spec_path IS 'Path to landing page content spec (markdown)';
COMMENT ON COLUMN audit_deliverables_metadata.deck_markdown_path IS 'Path to presentation deck (30-33 slides, markdown)';
COMMENT ON COLUMN audit_deliverables_metadata.ae_brief_path IS 'Path to AE pre-call brief (5 pages)';
COMMENT ON COLUMN audit_deliverables_metadata.signal_brief_path IS 'Path to strategic signal brief (1 page, LLM-optimized)';
COMMENT ON COLUMN audit_deliverables_metadata.markdown_report_path IS 'Path to markdown report (database-based)';

COMMENT ON COLUMN audit_deliverables_metadata.generation_status IS 'Status: pending, in_progress, completed, failed, partial';
COMMENT ON COLUMN audit_deliverables_metadata.generation_error IS 'Error message if generation failed';
COMMENT ON COLUMN audit_deliverables_metadata.generation_duration_seconds IS 'Time taken to generate all deliverables';

-- ============================================================================
-- FUNCTION: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_audit_deliverables_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_audit_deliverables_metadata_updated_at
  BEFORE UPDATE ON audit_deliverables_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_deliverables_metadata_updated_at();

-- ============================================================================
-- VIEW: Recent Deliverables
-- ============================================================================
-- Shows most recent deliverables with company and audit context
-- ============================================================================

CREATE OR REPLACE VIEW recent_deliverables AS
SELECT
  dm.id,
  dm.company_id,
  dm.audit_id,
  c.name AS company_name,
  c.domain AS company_domain,
  a.audit_type,
  a.status AS audit_status,
  dm.generated_at,
  dm.total_files,
  dm.total_size_bytes,
  ROUND(dm.total_size_bytes / 1024.0 / 1024.0, 2) AS total_size_mb,
  dm.estimated_read_time_minutes,
  dm.generation_status,
  dm.generation_error,
  dm.generation_duration_seconds,
  -- File availability flags
  (dm.pdf_book_path IS NOT NULL) AS has_pdf_book,
  (dm.landing_page_html_path IS NOT NULL) AS has_landing_page,
  (dm.deck_markdown_path IS NOT NULL) AS has_deck,
  (dm.ae_brief_path IS NOT NULL) AS has_ae_brief,
  (dm.signal_brief_path IS NOT NULL) AS has_signal_brief,
  (dm.markdown_report_path IS NOT NULL) AS has_markdown_report,
  dm.created_at,
  dm.updated_at
FROM audit_deliverables_metadata dm
JOIN companies c ON dm.company_id = c.id
JOIN audits a ON dm.audit_id = a.id
ORDER BY dm.generated_at DESC;

COMMENT ON VIEW recent_deliverables IS 'Recent deliverables with company and audit context';

-- ============================================================================
-- VIEW: Deliverables Statistics
-- ============================================================================
-- Aggregate statistics on deliverables generation
-- ============================================================================

CREATE OR REPLACE VIEW deliverables_statistics AS
SELECT
  COUNT(*) AS total_deliverables,
  COUNT(*) FILTER (WHERE generation_status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE generation_status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE generation_status = 'partial') AS partial_count,
  AVG(total_files) AS avg_files_per_audit,
  AVG(total_size_bytes / 1024.0 / 1024.0) AS avg_size_mb,
  AVG(estimated_read_time_minutes) AS avg_read_time_minutes,
  AVG(generation_duration_seconds) AS avg_generation_time_seconds,
  SUM(total_size_bytes) AS total_storage_bytes,
  ROUND(SUM(total_size_bytes) / 1024.0 / 1024.0 / 1024.0, 2) AS total_storage_gb,
  -- File generation success rates
  ROUND(100.0 * COUNT(*) FILTER (WHERE pdf_book_path IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS pdf_success_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE landing_page_html_path IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS landing_page_success_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE deck_markdown_path IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS deck_success_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ae_brief_path IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS ae_brief_success_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE signal_brief_path IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS signal_brief_success_rate,
  -- Time metrics
  MIN(generated_at) AS first_generation,
  MAX(generated_at) AS last_generation
FROM audit_deliverables_metadata;

COMMENT ON VIEW deliverables_statistics IS 'Aggregate statistics on deliverables generation';

-- ============================================================================
-- SAMPLE QUERY: Get deliverables for an audit
-- ============================================================================
/*
SELECT *
FROM audit_deliverables_metadata
WHERE company_id = 'uuid' AND audit_id = 'uuid';
*/

-- ============================================================================
-- SAMPLE QUERY: Get recent failed deliverables
-- ============================================================================
/*
SELECT
  company_name,
  audit_type,
  generated_at,
  generation_error,
  total_files
FROM recent_deliverables
WHERE generation_status = 'failed'
ORDER BY generated_at DESC
LIMIT 10;
*/

-- ============================================================================
-- SAMPLE QUERY: Get storage usage
-- ============================================================================
/*
SELECT
  total_deliverables,
  total_storage_gb,
  avg_size_mb,
  pdf_success_rate,
  landing_page_success_rate,
  deck_success_rate
FROM deliverables_statistics;
*/

-- ============================================================================
-- RLS POLICIES (if needed)
-- ============================================================================
-- Note: Assuming RLS is disabled per PHASE3_COMPLETE.md
-- If RLS is enabled, add policies similar to other tables

-- ALTER TABLE audit_deliverables_metadata ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can read own company deliverables"
--   ON audit_deliverables_metadata
--   FOR SELECT
--   USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- CREATE POLICY "System can insert deliverables"
--   ON audit_deliverables_metadata
--   FOR INSERT
--   WITH CHECK (true);

-- CREATE POLICY "System can update deliverables"
--   ON audit_deliverables_metadata
--   FOR UPDATE
--   USING (true);

-- ============================================================================
-- END OF MIGRATION 011
-- ============================================================================
