-- ============================================================================
-- SCHEMA CLEANUP & RESTRUCTURE
-- ============================================================================
-- Purpose: Clean up redundant tables and establish the 5-layer funnel schema
--
-- BEFORE running this migration:
--   1. Backup any data you want to preserve
--   2. Review what's being dropped
--
-- This migration:
--   1. Drops unused/empty tables
--   2. Renames tables to match new architecture
--   3. Creates the clean 5-layer structure
-- ============================================================================

-- ============================================================================
-- PHASE 1: DROP UNUSED TABLES
-- ============================================================================

-- Empty tables (0 records) - safe to drop
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS partner_products CASCADE;

-- ============================================================================
-- PHASE 2: ARCHIVE OLD TABLES (rename, don't delete yet)
-- ============================================================================
-- We'll keep the data but rename to _archive so we can reference if needed

-- Old tech tables → archive (will be replaced by partner_tech_*)
ALTER TABLE IF EXISTS technologies RENAME TO _archive_technologies;
ALTER TABLE IF EXISTS account_technologies RENAME TO _archive_account_technologies;

-- Old displacement table → archive (replaced by partner_tech_galaxy view)
ALTER TABLE IF EXISTS displacement_targets RENAME TO _archive_displacement_targets;

-- Old company tables → archive (may have useful data to migrate)
ALTER TABLE IF EXISTS companies RENAME TO _archive_companies;
ALTER TABLE IF EXISTS company_partners RENAME TO _archive_company_partners;

-- ============================================================================
-- PHASE 3: THE CLEAN 5-LAYER SCHEMA
-- ============================================================================

/*
LAYER 0: PARTNER TECH GALAXY (Foundation)
=========================================
Tables:
  - partner_technologies     → Technology catalog (CMS, Commerce, Search, etc.)
  - partner_tech_accounts    → Domain-technology pairs from BuiltWith
  - algolia_customers        → Exclusion list
Views:
  - partner_tech_galaxy      → Aggregated view with cohorts + sales play

LAYER 1: TECH COHORTS (Classification)
======================================
Computed in partner_tech_galaxy view:
  - JACKPOT: CMS + Commerce + (Hyperscaler OR MarTech)
  - HIGH: CMS + Commerce
  - MEDIUM: Commerce only (premium)
  - BASE: Any partner tech

LAYER 2: WHALE COMPOSITE (Intent + Qualification)
=================================================
Tables:
  - whale_composite          → Demandbase journey + ZoomInfo firmographics

LAYER 3: CROSSBEAM (Warm Intros)
================================
Tables:
  - crossbeam_overlaps       → Partner CRM overlaps

LAYER 4: ICP CLASSIFICATION (Industry Scoring)
==============================================
Tables:
  - industries               → Industry taxonomy with ICP columns
  - icp_companies            → Customer evidence
  - icp_quotes               → Customer quotes
  - icp_features             → Algolia features used
  - icp_metrics              → Case study metrics
  - icp_proofpoints          → Additional evidence
  - icp_personas             → Buyer personas
Views:
  - industries_with_icp      → Industries with score boosts

LAYER 5: SALES PLAY (Computed)
==============================
Computed in partner_tech_galaxy view:
  - DISPLACEMENT: Has competitor search
  - GREENFIELD_UPGRADE: Has native search only
  - GREENFIELD_NEW: No search detected
*/

-- ============================================================================
-- PHASE 4: CREATE FUNNEL MASTER VIEW
-- ============================================================================
-- This is the ultimate query that cascades all 5 layers

CREATE OR REPLACE VIEW funnel_master AS
WITH
-- Layer 0+1: Partner Tech Galaxy with Cohorts
galaxy AS (
    SELECT * FROM partner_tech_galaxy
    WHERE is_algolia_customer = FALSE
),

-- Layer 2: Match to Whale Composite
with_whale AS (
    SELECT
        g.*,
        w.journey_stage,
        w.engagement_points_3mo,
        w.date_of_last_web_activity,
        w.revenue,
        w.zi_employees,
        w.zi_ticker,
        w.demandbase_industry,
        w.demandbase_sub_industry,
        CASE WHEN w.domain IS NOT NULL THEN TRUE ELSE FALSE END as in_whale
    FROM galaxy g
    LEFT JOIN whale_composite w ON LOWER(g.domain) = LOWER(w.domain)
),

-- Layer 3: Match to Crossbeam
with_crossbeam AS (
    SELECT
        ww.*,
        c.partner_name as crossbeam_partner,
        c.overlap_type,
        c.partner_account_owner,
        CASE WHEN c.domain IS NOT NULL THEN TRUE ELSE FALSE END as in_crossbeam
    FROM with_whale ww
    LEFT JOIN crossbeam_overlaps c ON LOWER(ww.domain) = LOWER(c.domain)
),

-- Layer 4: ICP Score
with_icp AS (
    SELECT
        wc.*,
        i.icp_confidence,
        i.icp_proof_points,
        COALESCE(i.icp_score_boost, 0) as icp_score_boost
    FROM with_crossbeam wc
    LEFT JOIN industries_with_icp i
        ON LOWER(wc.demandbase_industry) LIKE '%' || LOWER(i.name) || '%'
)

-- Final output with computed scores
SELECT
    wi.*,

    -- Funnel Stage
    CASE
        WHEN wi.in_whale AND wi.in_crossbeam THEN 'CREAM_SET'
        WHEN wi.in_whale THEN 'WHALE_QUALIFIED'
        WHEN wi.in_crossbeam THEN 'CROSSBEAM_ONLY'
        ELSE 'GALAXY_ONLY'
    END as funnel_stage,

    -- Composite Score (simplified)
    (
        -- Tech Cohort Score
        CASE wi.tech_cohort
            WHEN 'JACKPOT' THEN 30
            WHEN 'HIGH' THEN 20
            WHEN 'MEDIUM' THEN 10
            ELSE 5
        END +

        -- Intent Score (if in Whale)
        CASE
            WHEN wi.journey_stage = 'Qualified' THEN 25
            WHEN wi.journey_stage = 'Engagement' THEN 15
            WHEN wi.journey_stage = 'Awareness' THEN 5
            ELSE 0
        END +

        -- Crossbeam Bonus
        CASE WHEN wi.in_crossbeam THEN 20 ELSE 0 END +

        -- ICP Bonus
        COALESCE(wi.icp_score_boost, 0)
    ) as composite_score,

    -- Final Tier
    CASE
        WHEN (
            CASE wi.tech_cohort WHEN 'JACKPOT' THEN 30 WHEN 'HIGH' THEN 20 WHEN 'MEDIUM' THEN 10 ELSE 5 END +
            CASE WHEN wi.journey_stage = 'Qualified' THEN 25 WHEN wi.journey_stage = 'Engagement' THEN 15 WHEN wi.journey_stage = 'Awareness' THEN 5 ELSE 0 END +
            CASE WHEN wi.in_crossbeam THEN 20 ELSE 0 END +
            COALESCE(wi.icp_score_boost, 0)
        ) >= 70 THEN 'HOT'
        WHEN (
            CASE wi.tech_cohort WHEN 'JACKPOT' THEN 30 WHEN 'HIGH' THEN 20 WHEN 'MEDIUM' THEN 10 ELSE 5 END +
            CASE WHEN wi.journey_stage = 'Qualified' THEN 25 WHEN wi.journey_stage = 'Engagement' THEN 15 WHEN wi.journey_stage = 'Awareness' THEN 5 ELSE 0 END +
            CASE WHEN wi.in_crossbeam THEN 20 ELSE 0 END +
            COALESCE(wi.icp_score_boost, 0)
        ) >= 40 THEN 'WARM'
        ELSE 'COLD'
    END as tier

FROM with_icp wi;

-- ============================================================================
-- PHASE 5: CONVENIENCE VIEWS FOR UI
-- ============================================================================

-- Cream Set: Accounts in BOTH Whale AND Crossbeam
CREATE OR REPLACE VIEW cream_set AS
SELECT * FROM funnel_master
WHERE funnel_stage = 'CREAM_SET'
ORDER BY composite_score DESC;

-- Hot Targets: Score >= 70
CREATE OR REPLACE VIEW hot_targets AS
SELECT * FROM funnel_master
WHERE tier = 'HOT'
ORDER BY composite_score DESC;

-- Funnel Summary Stats
CREATE OR REPLACE VIEW funnel_summary AS
SELECT
    funnel_stage,
    tier,
    sales_play,
    COUNT(*) as account_count,
    ROUND(AVG(composite_score)::numeric, 1) as avg_score
FROM funnel_master
GROUP BY funnel_stage, tier, sales_play
ORDER BY
    CASE funnel_stage
        WHEN 'CREAM_SET' THEN 1
        WHEN 'WHALE_QUALIFIED' THEN 2
        WHEN 'CROSSBEAM_ONLY' THEN 3
        ELSE 4
    END,
    CASE tier WHEN 'HOT' THEN 1 WHEN 'WARM' THEN 2 ELSE 3 END;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================
COMMENT ON VIEW funnel_master IS
'The 5-layer funnel: Galaxy → Cohort → Whale → Crossbeam → ICP → Sales Play.
Each row is a potential target with full context from all layers.';

COMMENT ON VIEW cream_set IS
'Triple-validated accounts: In Partner Tech Galaxy + Whale Composite + Crossbeam.
These are the highest-confidence targets for ABM 1:1.';

COMMENT ON VIEW hot_targets IS
'Accounts scoring 70+ across all dimensions. Ready for immediate outreach.';
