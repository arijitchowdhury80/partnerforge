-- ============================================
-- Migration: 20260227_play_types.sql
-- Purpose: Add multi-play tagging system (S1: Partner Tech, S2: Target List, S3: SI Connected)
-- ============================================

-- ============================================
-- DISPLACEMENT_TARGETS - Add play type columns
-- ============================================

-- is_s1_tech_partner: Uses partner technology (Adobe, Amplience, Spryker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'is_s1_tech_partner'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN is_s1_tech_partner BOOLEAN DEFAULT false;
    COMMENT ON COLUMN displacement_targets.is_s1_tech_partner IS 'S1: Partner Tech - uses Adobe, Amplience, Spryker, etc.';
  END IF;
END $$;

-- is_s2_target_list: On marketing ABM/named account list
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'is_s2_target_list'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN is_s2_target_list BOOLEAN DEFAULT false;
    COMMENT ON COLUMN displacement_targets.is_s2_target_list IS 'S2: Target List - on marketing ABM/named account list';
  END IF;
END $$;

-- is_s3_si_connected: Has SI partner relationship (EPAM, Isobar, Valtech)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'is_s3_si_connected'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN is_s3_si_connected BOOLEAN DEFAULT false;
    COMMENT ON COLUMN displacement_targets.is_s3_si_connected IS 'S3: SI Connected - has EPAM, Isobar, Valtech relationship';
  END IF;
END $$;

-- play_intersection_count: Auto-calculated count of plays (0-3)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'play_intersection_count'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN play_intersection_count INTEGER GENERATED ALWAYS AS (
      (CASE WHEN is_s1_tech_partner THEN 1 ELSE 0 END) +
      (CASE WHEN is_s2_target_list THEN 1 ELSE 0 END) +
      (CASE WHEN is_s3_si_connected THEN 1 ELSE 0 END)
    ) STORED;
    COMMENT ON COLUMN displacement_targets.play_intersection_count IS 'Auto-calculated intersection count (0, 1, 2, or 3 plays)';
  END IF;
END $$;

-- competitor_tech: What search tech we're displacing (all plays)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'competitor_tech'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN competitor_tech TEXT;
    COMMENT ON COLUMN displacement_targets.competitor_tech IS 'Current search provider to displace (Lucidworks, Elasticsearch, etc.)';
  END IF;
END $$;

-- source_list: For S2 plays - which marketing list this came from
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'source_list'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN source_list TEXT;
    COMMENT ON COLUMN displacement_targets.source_list IS 'Marketing list name for S2 Target List accounts (FY26 ABM Q1, CMO List, etc.)';
  END IF;
END $$;

-- si_partner_name: For S3 plays - which SI partner has the relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'si_partner_name'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN si_partner_name TEXT;
    COMMENT ON COLUMN displacement_targets.si_partner_name IS 'SI partner name for S3 accounts (EPAM, Isobar, Valtech, etc.)';
  END IF;
END $$;

-- scoring_preset: Override scoring weights for this account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'scoring_preset'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN scoring_preset TEXT;
    COMMENT ON COLUMN displacement_targets.scoring_preset IS 'Scoring preset override (tech_partner, si_partner, whale)';
  END IF;
END $$;

-- ============================================
-- CROSSBEAM_OVERLAPS - Partner ecosystem data
-- ============================================

CREATE TABLE IF NOT EXISTS crossbeam_overlaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  partner_type TEXT NOT NULL,  -- 'tech_vendor' or 'si_partner'
  algolia_status TEXT,         -- 'prospect', 'customer', 'churned'
  partner_status TEXT,         -- 'customer', 'prospect', 'churned'
  overlap_confidence FLOAT,
  crossbeam_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key to displacement_targets (if exists)
  CONSTRAINT fk_crossbeam_domain
    FOREIGN KEY (domain)
    REFERENCES displacement_targets(domain)
    ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_crossbeam_domain ON crossbeam_overlaps(domain);
CREATE INDEX IF NOT EXISTS idx_crossbeam_partner ON crossbeam_overlaps(partner_name, partner_type);
CREATE INDEX IF NOT EXISTS idx_crossbeam_partner_status ON crossbeam_overlaps(partner_status);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_crossbeam_unique
  ON crossbeam_overlaps(domain, partner_name, partner_type);

-- RLS for crossbeam_overlaps
ALTER TABLE crossbeam_overlaps ENABLE ROW LEVEL SECURITY;

-- Allow read access
DROP POLICY IF EXISTS "anon_read_crossbeam" ON crossbeam_overlaps;
CREATE POLICY "anon_read_crossbeam" ON crossbeam_overlaps
  FOR SELECT TO anon
  USING (true);

-- ============================================
-- ACCOUNT_SI_PARTNERS - SI partner relationships
-- ============================================

CREATE TABLE IF NOT EXISTS account_si_partners (
  domain TEXT NOT NULL,
  si_partner TEXT NOT NULL,
  relationship_type TEXT,  -- 'customer', 'prospect', 'partner'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (domain, si_partner),

  CONSTRAINT fk_si_domain
    FOREIGN KEY (domain)
    REFERENCES displacement_targets(domain)
    ON DELETE CASCADE
);

-- Index for fast SI partner lookups
CREATE INDEX IF NOT EXISTS idx_si_partner ON account_si_partners(si_partner);

-- RLS for account_si_partners
ALTER TABLE account_si_partners ENABLE ROW LEVEL SECURITY;

-- Allow read access
DROP POLICY IF EXISTS "anon_read_si_partners" ON account_si_partners;
CREATE POLICY "anon_read_si_partners" ON account_si_partners
  FOR SELECT TO anon
  USING (true);

-- ============================================
-- SOURCE_LISTS - Marketing list metadata (for S2: Target List)
-- ============================================

CREATE TABLE IF NOT EXISTS source_lists (
  id TEXT PRIMARY KEY,  -- list_xxxxx_xxxx format
  name TEXT NOT NULL,
  description TEXT,
  source TEXT,          -- 'salesforce', 'demandbase', '6sense', 'manual'
  account_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- RLS for source_lists
ALTER TABLE source_lists ENABLE ROW LEVEL SECURITY;

-- Allow read access
DROP POLICY IF EXISTS "anon_read_source_lists" ON source_lists;
CREATE POLICY "anon_read_source_lists" ON source_lists
  FOR SELECT TO anon
  USING (true);

-- ============================================
-- HELPER VIEW: Play intersection stats
-- ============================================

CREATE OR REPLACE VIEW play_intersection_stats AS
SELECT
  play_intersection_count,
  -- Intersection labels
  CASE
    WHEN is_s1_tech_partner AND is_s2_target_list AND is_s3_si_connected THEN 'jackpot'
    WHEN is_s1_tech_partner AND is_s2_target_list THEN 'partner_match'
    WHEN is_s2_target_list AND is_s3_si_connected THEN 'si_warm_intro'
    WHEN is_s1_tech_partner AND is_s3_si_connected THEN 'co_sell_ready'
    WHEN is_s1_tech_partner THEN 's1_only'
    WHEN is_s2_target_list THEN 's2_only'
    WHEN is_s3_si_connected THEN 's3_only'
    ELSE 'untagged'
  END as intersection_type,
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE icp_score >= 70) as hot_accounts,
  COUNT(*) FILTER (WHERE icp_score >= 40 AND icp_score < 70) as warm_accounts,
  COUNT(*) FILTER (WHERE icp_score < 40) as cold_accounts
FROM displacement_targets
GROUP BY play_intersection_count, is_s1_tech_partner, is_s2_target_list, is_s3_si_connected;

-- ============================================
-- HELPER VIEW: SI partner cohort stats
-- ============================================

CREATE OR REPLACE VIEW si_partner_stats AS
SELECT
  asp.si_partner,
  COUNT(DISTINCT asp.domain) as total_accounts,
  COUNT(DISTINCT asp.domain) FILTER (WHERE dt.icp_score >= 70) as hot_accounts,
  COUNT(DISTINCT asp.domain) FILTER (WHERE dt.icp_score >= 40 AND dt.icp_score < 70) as warm_accounts,
  COUNT(DISTINCT asp.domain) FILTER (WHERE dt.icp_score < 40) as cold_accounts
FROM account_si_partners asp
LEFT JOIN displacement_targets dt ON asp.domain = dt.domain
GROUP BY asp.si_partner;

-- ============================================
-- SUMMARY
-- ============================================
-- This migration adds the multi-play tagging system:
--
-- PLAY COLUMNS (boolean, allowing multi-tagging):
-- 1. is_s1_tech_partner - Uses partner tech (Adobe, Amplience, Spryker)
-- 2. is_s2_target_list - On marketing ABM/named account list
-- 3. is_s3_si_connected - Has SI partner relationship (EPAM, Isobar, Valtech)
-- 4. play_intersection_count - Auto-calculated (0-3)
--
-- SUPPORTING COLUMNS:
-- 5. competitor_tech - Current search provider to displace
-- 6. source_list - Marketing list name for S2 accounts
-- 7. si_partner_name - SI partner name for S3 accounts
--
-- SUPPORTING TABLES:
-- 8. crossbeam_overlaps - Partner ecosystem data from Crossbeam
-- 9. account_si_partners - SI relationship tracking (many-to-many)
-- 10. source_lists - Marketing list metadata
--
-- VIEWS:
-- 11. play_intersection_stats - Stats grouped by intersection type
-- 12. si_partner_stats - Stats grouped by SI partner
--
-- INTERSECTION PRIORITY (highest to lowest):
-- - jackpot (S1+S2+S3): 1.5x multiplier
-- - partner_match (S1+S2): 1.25x multiplier
-- - si_warm_intro (S2+S3): 1.25x multiplier
-- - co_sell_ready (S1+S3): 1.25x multiplier
-- - single play: 1.0x multiplier
-- ============================================
