-- ============================================================================
-- TECH COHORT CLASSIFICATION COLUMNS
-- ============================================================================
-- Adds columns to whale_composite for Layer 1 (Partner Tech Cohort) results.
-- Populated by classify-tech-cohorts.ts script.
--
-- Created: 2026-02-27
-- ============================================================================

-- ===========================================
-- COHORT CLASSIFICATION COLUMNS
-- ===========================================

ALTER TABLE whale_composite
ADD COLUMN IF NOT EXISTS tech_cohort VARCHAR(50),
ADD COLUMN IF NOT EXISTS tech_cohort_score INTEGER,
ADD COLUMN IF NOT EXISTS has_partner_cms BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_partner_commerce BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_partner_hyperscaler BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_search_provider VARCHAR(100);

COMMENT ON COLUMN whale_composite.tech_cohort IS
'Layer 1 cohort: "CMS + Commerce + Hyperscaler", "CMS + Commerce", "Commerce Only", etc.';

COMMENT ON COLUMN whale_composite.tech_cohort_score IS
'Layer 1 score: JACKPOT (100/95), HIGH (85), STANDARD (60/50), NO_PARTNER (0)';

COMMENT ON COLUMN whale_composite.has_partner_cms IS
'TRUE if using partner CMS (AEM, Contentful, Amplience, etc.)';

COMMENT ON COLUMN whale_composite.has_partner_commerce IS
'TRUE if using partner commerce (SFCC, Shopify, Magento, etc.)';

COMMENT ON COLUMN whale_composite.has_partner_hyperscaler IS
'TRUE if using partner hyperscaler (AWS, Azure). GCP is competitor.';

COMMENT ON COLUMN whale_composite.current_search_provider IS
'Current search provider from BuiltWith (Algolia, Elasticsearch, etc.) for displacement analysis';

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_whale_tech_cohort ON whale_composite(tech_cohort);
CREATE INDEX IF NOT EXISTS idx_whale_tech_cohort_score ON whale_composite(tech_cohort_score);
CREATE INDEX IF NOT EXISTS idx_whale_search_provider ON whale_composite(current_search_provider);

-- Composite index for filtering JACKPOT accounts
CREATE INDEX IF NOT EXISTS idx_whale_jackpot ON whale_composite(tech_cohort_score DESC)
WHERE tech_cohort_score >= 95;

-- Composite index for displacement targets (non-Algolia search)
CREATE INDEX IF NOT EXISTS idx_whale_displacement ON whale_composite(current_search_provider)
WHERE current_search_provider IS NOT NULL AND current_search_provider != 'Algolia';
