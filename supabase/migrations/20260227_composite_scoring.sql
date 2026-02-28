-- ============================================================================
-- COMPOSITE SCORING VIEW
-- ============================================================================
-- Description: Unified scoring model for whale accounts combining 4 factors:
--   1. INTENT (30%) - Demandbase journey stage + engagement signals
--   2. ICP FIT (25%) - Industry confidence + proof point density
--   3. TECH COHORT (25%) - Partner technology combinations
--   4. VALUE (20%) - Revenue + traffic + public company signals
--
-- Score Range: 0-100 points
-- Tiers: HOT (80+), WARM (50-79), COLD (<50)
--
-- Created: 2026-02-27
-- ============================================================================

-- Drop existing view if exists
DROP VIEW IF EXISTS whale_scored CASCADE;

-- ============================================================================
-- MAIN SCORING VIEW
-- ============================================================================
CREATE VIEW whale_scored AS
WITH

-- Step 1: Calculate Intent Score (0-30 points max)
intent_scores AS (
    SELECT
        w.id,
        w.domain,
        -- Journey Stage: Qualified=25, Engagement=15, Awareness=5
        CASE w.journey_stage
            WHEN 'Qualified' THEN 25
            WHEN 'Engagement' THEN 15
            WHEN 'Awareness' THEN 5
            ELSE 0
        END as journey_score,

        -- Engagement Points (normalized, max 5 points)
        -- Top decile gets 5, bottom gets 0
        LEAST(5, COALESCE(w.engagement_points_3mo / 100.0, 0)::INTEGER) as engagement_score,

        -- Recency bonus: Last activity within 30 days = 5 points
        CASE
            WHEN w.date_of_last_web_activity > NOW() - INTERVAL '30 days' THEN 5
            WHEN w.date_of_last_web_activity > NOW() - INTERVAL '90 days' THEN 3
            WHEN w.date_of_last_web_activity > NOW() - INTERVAL '180 days' THEN 1
            ELSE 0
        END as recency_score
    FROM whale_composite w
),

-- Step 2: Calculate ICP Fit Score (0-25 points max)
icp_scores AS (
    SELECT
        w.id,
        -- Industry ICP confidence (from industries_with_icp view)
        COALESCE(i.icp_score_boost, 0) as icp_industry_score,

        -- Sub-industry keyword match bonus (5 points if keywords match)
        -- This catches Fashion within Retail, Grocery within Food & Beverage
        CASE
            WHEN LOWER(w.demandbase_sub_industry) SIMILAR TO '%(fashion|apparel|clothing)%' THEN 5
            WHEN LOWER(w.demandbase_sub_industry) SIMILAR TO '%(grocery|food|supermarket)%' THEN 5
            WHEN LOWER(w.demandbase_sub_industry) SIMILAR TO '%(e-commerce|ecommerce|retail)%' THEN 3
            ELSE 0
        END as sub_industry_bonus
    FROM whale_composite w
    LEFT JOIN industries i ON LOWER(w.demandbase_industry) LIKE '%' || LOWER(i.name) || '%'
       OR LOWER(w.industry) LIKE '%' || LOWER(i.name) || '%'
),

-- Step 3: Calculate Tech Cohort Score (0-25 points max)
-- Based on partner tech combinations (CMS + Commerce + Hyperscaler)
tech_scores AS (
    SELECT
        w.id,

        -- Count partner tech presence
        (CASE WHEN w.has_magento THEN 1 ELSE 0 END +
         CASE WHEN w.has_magento_open_source THEN 1 ELSE 0 END +
         CASE WHEN w.has_salesforce_commerce_cloud THEN 1 ELSE 0 END +
         CASE WHEN w.has_salesforce_b2b_commerce THEN 1 ELSE 0 END +
         CASE WHEN w.has_shopify THEN 1 ELSE 0 END +
         CASE WHEN w.has_shopify_plus THEN 1 ELSE 0 END +
         CASE WHEN w.has_shopify_hosted THEN 1 ELSE 0 END +
         CASE WHEN w.has_bigcommerce THEN 1 ELSE 0 END +
         CASE WHEN w.has_commercetools THEN 1 ELSE 0 END +
         CASE WHEN w.has_spryker THEN 1 ELSE 0 END) as tech_count,

        -- Tech cohort scoring
        CASE
            -- JACKPOT: Premium commerce platform = 25 points
            WHEN w.has_salesforce_commerce_cloud THEN 25
            WHEN w.has_commercetools THEN 25

            -- HIGH: Established e-commerce = 20 points
            WHEN w.has_shopify_plus THEN 20
            WHEN w.has_magento THEN 20

            -- MEDIUM: Standard commerce = 15 points
            WHEN w.has_bigcommerce THEN 15
            WHEN w.has_shopify THEN 15
            WHEN w.has_shopify_hosted THEN 15

            -- BASE: Any commerce tech = 10 points
            WHEN w.has_spryker THEN 10
            WHEN w.has_magento_open_source THEN 10
            WHEN w.has_salesforce_b2b_commerce THEN 10

            ELSE 0
        END as tech_cohort_score
    FROM whale_composite w
),

-- Step 4: Calculate Value Score (0-20 points max)
value_scores AS (
    SELECT
        w.id,

        -- Revenue tier (max 10 points)
        CASE
            WHEN w.revenue >= 10000000000 THEN 10  -- $10B+
            WHEN w.revenue >= 1000000000 THEN 8   -- $1B+
            WHEN w.revenue >= 500000000 THEN 6    -- $500M+
            WHEN w.revenue >= 100000000 THEN 4    -- $100M+
            WHEN w.revenue >= 50000000 THEN 2     -- $50M+
            ELSE 0
        END as revenue_score,

        -- Traffic tier (max 5 points)
        CASE
            WHEN w.traffic >= 10000000 THEN 5     -- 10M+ monthly
            WHEN w.traffic >= 1000000 THEN 4      -- 1M+
            WHEN w.traffic >= 500000 THEN 3       -- 500K+
            WHEN w.traffic >= 100000 THEN 2       -- 100K+
            WHEN w.traffic >= 50000 THEN 1        -- 50K+
            ELSE 0
        END as traffic_score,

        -- Public company bonus (5 points if ticker exists)
        CASE
            WHEN w.zi_ticker IS NOT NULL AND w.zi_ticker != '' THEN 5
            ELSE 0
        END as public_company_score
    FROM whale_composite w
)

-- FINAL: Combine all scores
SELECT
    w.*,

    -- Individual factor scores
    COALESCE(i.journey_score, 0) + COALESCE(i.engagement_score, 0) + COALESCE(i.recency_score, 0) as intent_score,
    COALESCE(icp.icp_industry_score, 0) + COALESCE(icp.sub_industry_bonus, 0) as icp_fit_score,
    COALESCE(t.tech_cohort_score, 0) as tech_cohort_score,
    COALESCE(v.revenue_score, 0) + COALESCE(v.traffic_score, 0) + COALESCE(v.public_company_score, 0) as value_score,

    -- Raw component scores (for debugging)
    i.journey_score,
    i.engagement_score,
    i.recency_score,
    icp.icp_industry_score,
    icp.sub_industry_bonus,
    t.tech_count,
    v.revenue_score,
    v.traffic_score,
    v.public_company_score,

    -- COMPOSITE SCORE (sum of all factors, max 100)
    (COALESCE(i.journey_score, 0) + COALESCE(i.engagement_score, 0) + COALESCE(i.recency_score, 0)) +
    (COALESCE(icp.icp_industry_score, 0) + COALESCE(icp.sub_industry_bonus, 0)) +
    COALESCE(t.tech_cohort_score, 0) +
    (COALESCE(v.revenue_score, 0) + COALESCE(v.traffic_score, 0) + COALESCE(v.public_company_score, 0))
    as composite_score,

    -- TIER based on composite score
    CASE
        WHEN (COALESCE(i.journey_score, 0) + COALESCE(i.engagement_score, 0) + COALESCE(i.recency_score, 0)) +
             (COALESCE(icp.icp_industry_score, 0) + COALESCE(icp.sub_industry_bonus, 0)) +
             COALESCE(t.tech_cohort_score, 0) +
             (COALESCE(v.revenue_score, 0) + COALESCE(v.traffic_score, 0) + COALESCE(v.public_company_score, 0)) >= 80
        THEN 'HOT'
        WHEN (COALESCE(i.journey_score, 0) + COALESCE(i.engagement_score, 0) + COALESCE(i.recency_score, 0)) +
             (COALESCE(icp.icp_industry_score, 0) + COALESCE(icp.sub_industry_bonus, 0)) +
             COALESCE(t.tech_cohort_score, 0) +
             (COALESCE(v.revenue_score, 0) + COALESCE(v.traffic_score, 0) + COALESCE(v.public_company_score, 0)) >= 50
        THEN 'WARM'
        ELSE 'COLD'
    END as score_tier

FROM whale_composite w
LEFT JOIN intent_scores i ON w.id = i.id
LEFT JOIN icp_scores icp ON w.id = icp.id
LEFT JOIN tech_scores t ON w.id = t.id
LEFT JOIN value_scores v ON w.id = v.id;

-- ============================================================================
-- CONVENIENCE VIEWS
-- ============================================================================

-- Hot targets (score >= 80)
CREATE OR REPLACE VIEW whale_hot_targets AS
SELECT * FROM whale_scored WHERE composite_score >= 80
ORDER BY composite_score DESC, revenue DESC NULLS LAST;

-- Jackpot accounts (high intent + high tech + high value)
CREATE OR REPLACE VIEW whale_jackpot AS
SELECT * FROM whale_scored
WHERE
    journey_stage IN ('Qualified', 'Engagement')  -- Active intent
    AND tech_cohort_score >= 20                   -- Premium tech stack
    AND (revenue >= 500000000 OR traffic >= 1000000)  -- High value
ORDER BY composite_score DESC;

-- Partner-specific views
CREATE OR REPLACE VIEW whale_salesforce_targets AS
SELECT * FROM whale_scored
WHERE has_salesforce_commerce_cloud = TRUE OR has_salesforce_b2b_commerce = TRUE
ORDER BY composite_score DESC;

CREATE OR REPLACE VIEW whale_magento_targets AS
SELECT * FROM whale_scored
WHERE has_magento = TRUE OR has_magento_open_source = TRUE
ORDER BY composite_score DESC;

CREATE OR REPLACE VIEW whale_shopify_targets AS
SELECT * FROM whale_scored
WHERE has_shopify_plus = TRUE OR has_shopify = TRUE OR has_shopify_hosted = TRUE
ORDER BY composite_score DESC;

-- ============================================================================
-- ANALYTICS: Score Distribution
-- ============================================================================

CREATE OR REPLACE VIEW whale_score_distribution AS
SELECT
    score_tier,
    COUNT(*) as account_count,
    ROUND(AVG(composite_score)::numeric, 1) as avg_score,
    ROUND(AVG(intent_score)::numeric, 1) as avg_intent,
    ROUND(AVG(icp_fit_score)::numeric, 1) as avg_icp_fit,
    ROUND(AVG(tech_cohort_score)::numeric, 1) as avg_tech,
    ROUND(AVG(value_score)::numeric, 1) as avg_value,
    SUM(CASE WHEN has_salesforce_commerce_cloud THEN 1 ELSE 0 END) as sfcc_count,
    SUM(CASE WHEN has_magento OR has_magento_open_source THEN 1 ELSE 0 END) as magento_count,
    SUM(CASE WHEN has_shopify_plus THEN 1 ELSE 0 END) as shopify_plus_count
FROM whale_scored
GROUP BY score_tier
ORDER BY
    CASE score_tier WHEN 'HOT' THEN 1 WHEN 'WARM' THEN 2 ELSE 3 END;

-- ============================================================================
-- ANALYTICS: Top Factors by Tier
-- ============================================================================

CREATE OR REPLACE VIEW whale_factor_analysis AS
SELECT
    score_tier,

    -- Intent breakdown
    ROUND(AVG(journey_score)::numeric, 1) as avg_journey_score,
    SUM(CASE WHEN journey_stage = 'Qualified' THEN 1 ELSE 0 END) as qualified_count,
    SUM(CASE WHEN journey_stage = 'Engagement' THEN 1 ELSE 0 END) as engagement_count,

    -- ICP breakdown
    ROUND(AVG(icp_industry_score)::numeric, 1) as avg_icp_industry,
    ROUND(AVG(sub_industry_bonus)::numeric, 1) as avg_sub_industry_bonus,

    -- Value breakdown
    ROUND(AVG(revenue_score)::numeric, 1) as avg_revenue_score,
    ROUND(AVG(traffic_score)::numeric, 1) as avg_traffic_score,
    SUM(CASE WHEN zi_ticker IS NOT NULL THEN 1 ELSE 0 END) as public_company_count

FROM whale_scored
GROUP BY score_tier
ORDER BY
    CASE score_tier WHEN 'HOT' THEN 1 WHEN 'WARM' THEN 2 ELSE 3 END;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON VIEW whale_scored IS
'Composite scoring of whale accounts combining 4 factors:
- Intent (30 pts max): Journey stage + engagement + recency
- ICP Fit (25 pts max): Industry confidence + sub-industry keywords
- Tech Cohort (25 pts max): Partner technology tier
- Value (20 pts max): Revenue + traffic + public company

Tiers: HOT (80+), WARM (50-79), COLD (<50)';

COMMENT ON VIEW whale_hot_targets IS
'Whale accounts with composite score >= 80. Ready for immediate outreach.';

COMMENT ON VIEW whale_jackpot IS
'Triple-play accounts: Active intent + Premium tech + High value.
These are the highest-priority targets for co-sell motions.';
