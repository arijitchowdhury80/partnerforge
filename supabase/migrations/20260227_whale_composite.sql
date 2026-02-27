-- ============================================================================
-- WHALE COMPOSITE TABLE
-- ============================================================================
-- Description: Composite dataset of ZoomInfo and Demandbase layers for the
--              refined whale accounts list. Contains 777 high-value target
--              accounts from FY27 Q1 campaign.
--
-- Data Sources:
--   - Demandbase: ABX journey stage, engagement, GTM tags, technology flags
--   - ZoomInfo: Company firmographics, funding, employees, social profiles
--
-- Created: 2026-02-27
-- Source File: 2026-02-27_FY27-Q1-Whale_Demandbase+ZoomInfo.csv
-- ============================================================================

CREATE TABLE IF NOT EXISTS whale_composite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ===========================================
    -- CORE IDENTIFIERS
    -- ===========================================
    domain VARCHAR(255) UNIQUE NOT NULL,
    account_name VARCHAR(255),
    salesforce_account_id VARCHAR(18),      -- "18 digit Account ID"
    abm_id VARCHAR(50),                      -- Demandbase ABM ID
    acc_id INTEGER,                          -- Internal account ID
    zoominfo_company_id BIGINT,              -- ZoomInfo Company ID

    -- ===========================================
    -- DEMANDBASE ABX DATA
    -- ===========================================
    journey_stage VARCHAR(50),               -- Awareness, Engagement, Qualified, etc.
    days_in_journey_stage INTEGER,
    date_of_last_web_activity TIMESTAMP WITH TIME ZONE,
    engaged_known_people INTEGER,
    engagement_points_3mo DECIMAL(10,5),     -- "Engagement Points (3 mo.)"
    target_account VARCHAR(100),
    abx_status VARCHAR(100),
    abx_status_reason VARCHAR(255),
    abx_status_reason_description TEXT,
    gtm_tag TEXT,                            -- Semicolon-separated tags

    -- ===========================================
    -- DEMANDBASE FIRMOGRAPHICS
    -- ===========================================
    billing_country VARCHAR(100),
    naics_code VARCHAR(20),
    naics_code_priority_1 VARCHAR(20),
    naics_description_priority_1 VARCHAR(255),
    industry VARCHAR(100),
    demandbase_industry VARCHAR(100),
    demandbase_sub_industry VARCHAR(100),
    revenue BIGINT,                          -- Raw revenue value
    revenue_range VARCHAR(50),               -- "$1B - $2.5B" etc.
    expected_revenue DECIMAL(15,2),
    arr DECIMAL(15,2),
    traffic BIGINT,                          -- Monthly traffic estimate

    -- ===========================================
    -- SALES ASSIGNMENT
    -- ===========================================
    local_segment VARCHAR(50),               -- Enterprise, Commercial, SMB
    account_region VARCHAR(50),              -- AMER, EMEA, etc.
    demandbase_account_owner VARCHAR(255),   -- "Demandbase - Account Owner Name"
    sales_region VARCHAR(100),
    sales_sub_region VARCHAR(100),
    sales_segment VARCHAR(50),               -- ENT, STRAT, COM

    -- ===========================================
    -- TECHNOLOGY FLAGS (Demandbase)
    -- ===========================================
    has_bigcommerce BOOLEAN DEFAULT FALSE,
    has_commercetools BOOLEAN DEFAULT FALSE,
    has_magento BOOLEAN DEFAULT FALSE,
    has_magento_open_source BOOLEAN DEFAULT FALSE,
    has_salesforce_b2b_commerce BOOLEAN DEFAULT FALSE,
    has_salesforce_commerce_cloud BOOLEAN DEFAULT FALSE,
    has_shopify_hosted BOOLEAN DEFAULT FALSE,
    has_shopify_plus BOOLEAN DEFAULT FALSE,
    has_shopify BOOLEAN DEFAULT FALSE,
    has_spryker BOOLEAN DEFAULT FALSE,

    -- ===========================================
    -- ZOOMINFO COMPANY DATA
    -- ===========================================
    zi_company_name VARCHAR(255),
    zi_company_description TEXT,
    zi_website VARCHAR(255),
    zi_founded_year INTEGER,
    zi_company_hq_phone VARCHAR(50),
    zi_fax VARCHAR(50),
    zi_ticker VARCHAR(20),

    -- ===========================================
    -- ZOOMINFO FINANCIALS
    -- ===========================================
    zi_revenue_thousands BIGINT,             -- "Revenue (in 000s USD)"
    zi_revenue_range VARCHAR(50),            -- "Revenue Range (in USD)"
    zi_est_marketing_budget_thousands BIGINT,
    zi_est_finance_budget_thousands BIGINT,
    zi_est_it_budget_thousands BIGINT,
    zi_est_hr_budget_thousands BIGINT,

    -- ===========================================
    -- ZOOMINFO EMPLOYEES
    -- ===========================================
    zi_employees INTEGER,
    zi_employee_range VARCHAR(50),
    zi_employee_growth_1yr DECIMAL(8,4),
    zi_employee_growth_2yr DECIMAL(8,4),

    -- ===========================================
    -- ZOOMINFO INDUSTRY CLASSIFICATION
    -- ===========================================
    zi_sic_code_1 VARCHAR(20),
    zi_sic_code_2 VARCHAR(20),
    zi_sic_codes TEXT,
    zi_naics_code_1 VARCHAR(20),
    zi_naics_code_2 VARCHAR(20),
    zi_naics_codes TEXT,
    zi_primary_industry VARCHAR(100),
    zi_primary_sub_industry VARCHAR(100),
    zi_all_industries TEXT,
    zi_all_sub_industries TEXT,
    zi_industry_hierarchical_category VARCHAR(100),
    zi_secondary_industry_hierarchical_category VARCHAR(100),

    -- ===========================================
    -- ZOOMINFO DIGITAL PRESENCE
    -- ===========================================
    zi_alexa_rank INTEGER,
    zi_profile_url VARCHAR(500),             -- ZoomInfo profile
    zi_linkedin_url VARCHAR(500),
    zi_facebook_url VARCHAR(500),
    zi_twitter_url VARCHAR(500),

    -- ===========================================
    -- ZOOMINFO CORPORATE INFO
    -- ===========================================
    zi_ownership_type VARCHAR(50),           -- Private, Public
    zi_business_model VARCHAR(50),           -- B2B, B2C
    zi_certified_active VARCHAR(10),
    zi_certification_date VARCHAR(50),
    zi_defunct_company VARCHAR(10),
    zi_company_is_acquired VARCHAR(10),
    zi_number_of_locations INTEGER,

    -- ===========================================
    -- ZOOMINFO FUNDING
    -- ===========================================
    zi_total_funding_thousands BIGINT,
    zi_recent_funding_thousands BIGINT,
    zi_recent_funding_round VARCHAR(50),
    zi_recent_funding_date VARCHAR(50),
    zi_recent_investors TEXT,
    zi_all_investors TEXT,

    -- ===========================================
    -- ZOOMINFO ADDRESS
    -- ===========================================
    zi_street_address VARCHAR(255),
    zi_city VARCHAR(100),
    zi_state VARCHAR(100),
    zi_zip_code VARCHAR(20),
    zi_country VARCHAR(100),
    zi_full_address TEXT,

    -- ===========================================
    -- ZOOMINFO CORPORATE HIERARCHY
    -- ===========================================
    zi_ultimate_parent_id VARCHAR(50),
    zi_ultimate_parent_name VARCHAR(255),
    zi_immediate_parent_id VARCHAR(50),
    zi_immediate_parent_name VARCHAR(255),
    zi_immediate_parent_relationship VARCHAR(100),

    -- ===========================================
    -- ZOOMINFO MATCH QUALITY
    -- ===========================================
    zi_match_status VARCHAR(50),             -- "Company Match", "No Company Match"
    zi_match_insight_name VARCHAR(50),
    zi_match_insight_domain VARCHAR(50),
    zi_match_insight_address VARCHAR(50),
    zi_match_insight_phone VARCHAR(50),
    zi_match_insight_id VARCHAR(50),
    zi_match_insight_social VARCHAR(50),

    -- ===========================================
    -- METADATA
    -- ===========================================
    source_file VARCHAR(255),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_whale_composite_domain ON whale_composite(domain);
CREATE INDEX idx_whale_composite_journey_stage ON whale_composite(journey_stage);
CREATE INDEX idx_whale_composite_abx_status ON whale_composite(abx_status);
CREATE INDEX idx_whale_composite_sales_segment ON whale_composite(sales_segment);
CREATE INDEX idx_whale_composite_zi_ownership ON whale_composite(zi_ownership_type);
CREATE INDEX idx_whale_composite_zi_employees ON whale_composite(zi_employees);
CREATE INDEX idx_whale_composite_revenue ON whale_composite(revenue);

-- ===========================================
-- TABLE COMMENT
-- ===========================================
COMMENT ON TABLE whale_composite IS
'Composite dataset of ZoomInfo and Demandbase data for 777 refined whale accounts (FY27 Q1).
Contains ABX journey tracking, engagement scores, technology flags from Demandbase,
plus firmographics, funding, employee data, and social profiles from ZoomInfo.
Source: 2026-02-27_FY27-Q1-Whale_Demandbase+ZoomInfo.csv';

-- ===========================================
-- RLS POLICY (read-only for anon)
-- ===========================================
ALTER TABLE whale_composite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whale_composite_read_all" ON whale_composite
    FOR SELECT USING (true);

CREATE POLICY "whale_composite_insert_service" ON whale_composite
    FOR INSERT WITH CHECK (true);

CREATE POLICY "whale_composite_update_service" ON whale_composite
    FOR UPDATE USING (true);
