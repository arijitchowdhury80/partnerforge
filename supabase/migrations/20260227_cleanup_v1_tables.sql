-- ============================================================================
-- CLEANUP: Drop v1 Legacy Tables
-- ============================================================================
-- Run this AFTER verifying v2 schema is working correctly.
-- These tables are no longer needed in the 5-layer funnel architecture.
-- ============================================================================

-- Drop archived table from Layer 0 migration
DROP TABLE IF EXISTS _archive_companies_old CASCADE;

-- Drop old tech relationship tables (replaced by companies.xxx_tech columns)
DROP TABLE IF EXISTS account_technologies CASCADE;
DROP TABLE IF EXISTS technologies CASCADE;

-- Drop old partner tables (not used in v2)
DROP TABLE IF EXISTS company_partners CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS partner_products CASCADE;

-- Drop old displacement table (replaced by sales_play computed column)
DROP TABLE IF EXISTS displacement_targets CASCADE;

-- Drop old taxonomy tables (using industries/icp_* for scoring)
DROP TABLE IF EXISTS verticals CASCADE;
DROP TABLE IF EXISTS sub_industries CASCADE;

-- Drop job profiles (not used in current v2 design)
DROP TABLE IF EXISTS target_job_profiles CASCADE;
DROP VIEW IF EXISTS job_profiles_summary CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, these tables should remain:
--
-- LAYER 0 (NEW v2):
--   - companies          (main table with 4 tech columns)
--   - tech_options       (dropdown reference)
--   - galaxy_summary     (view)
--   - cohort_summary     (view)
--
-- LAYER 2 (Whale):
--   - whale_composite    (Demandbase + ZoomInfo data)
--
-- LAYER 3 (Crossbeam):
--   - crossbeam_overlaps (partner CRM overlaps)
--
-- LAYER 4 (ICP):
--   - industries
--   - industries_with_icp (view)
--   - icp_companies
--   - icp_company_features
--   - icp_features
--   - icp_industries
--   - icp_metrics
--   - icp_personas
--   - icp_persona_details
--   - icp_persona_themes
--   - icp_persona_titles
--   - icp_proofpoints
--   - icp_quotes
--   - icp_summary (view)
-- ============================================================================
