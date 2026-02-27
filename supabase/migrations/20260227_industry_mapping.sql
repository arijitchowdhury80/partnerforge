-- ============================================================================
-- INDUSTRY MAPPING TABLE: Crossbeam → Unified Taxonomy
-- ============================================================================
-- Maps external industry names (Crossbeam, Adobe, etc.) to our unified
-- Demandbase-based taxonomy. Enables consistent industry reporting across
-- all data sources.
--
-- Created: 2026-02-27
-- ============================================================================

-- ===========================================
-- CREATE INDUSTRY MAPPING TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS industry_mapping (
    id SERIAL PRIMARY KEY,
    source_system VARCHAR(50) NOT NULL,        -- 'crossbeam', 'adobe', 'zoominfo', etc.
    source_industry VARCHAR(255) NOT NULL,     -- Industry name from source system
    unified_industry VARCHAR(255) NOT NULL,    -- Mapped Demandbase industry name
    match_type VARCHAR(20) NOT NULL DEFAULT 'close',  -- 'exact' or 'close'
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_system, source_industry)
);

COMMENT ON TABLE industry_mapping IS
'Maps external industry taxonomies to unified Demandbase-based industries';

CREATE INDEX IF NOT EXISTS idx_industry_mapping_source ON industry_mapping(source_system, source_industry);
CREATE INDEX IF NOT EXISTS idx_industry_mapping_unified ON industry_mapping(unified_industry);

-- ===========================================
-- SEED CROSSBEAM INDUSTRY MAPPINGS
-- ===========================================
INSERT INTO industry_mapping (source_system, source_industry, unified_industry, match_type) VALUES
-- Exact matches
('crossbeam', 'Retail', 'Retail', 'exact'),
('crossbeam', 'Financial Services', 'Financial Services', 'exact'),
('crossbeam', 'Telecommunications', 'Telecommunications', 'exact'),
('crossbeam', 'Insurance', 'Insurance', 'exact'),
('crossbeam', 'Agriculture & Forestry', 'Agriculture and Forestry', 'exact'),

-- Close matches
('crossbeam', 'Manufacturing - Consumer Goods', 'Consumer Product Manufacturing', 'close'),
('crossbeam', 'Manufacturing - Industrial', 'Industrial Manufacturing and Services', 'close'),
('crossbeam', 'Technology Software & Services', 'Computer Software', 'close'),
('crossbeam', 'Professional & Technical Services', 'Corporate Services', 'close'),
('crossbeam', 'Pharmaceuticals & Biotech', 'Pharmaceuticals and Biotechnology', 'close'),
('crossbeam', 'Manufacturing - Automotive', 'Automotive', 'close'),
('crossbeam', 'Technology Hardware', 'Computer Hardware', 'close'),
('crossbeam', 'Travel, Leisure & Hospitality', 'Leisure, Sports and Recreation', 'close'),
('crossbeam', 'Health Care', 'Hospitals and Healthcare', 'close'),
('crossbeam', 'Government - Federal', 'Government', 'close'),
('crossbeam', 'Media & Entertainment', 'Media', 'close'),
('crossbeam', 'Education - Higher Ed', 'Schools and Education', 'close'),
('crossbeam', 'Government - State', 'Government', 'close'),
('crossbeam', 'Utilities', 'Energy and Environmental', 'close'),
('crossbeam', 'Real Estate, Rental & Leasing', 'Real Estate', 'close'),
('crossbeam', 'Transportation & Warehousing', 'Transportation', 'close'),
('crossbeam', 'Non-Profit', 'Civic, Non-Profit and Membership Groups', 'close'),
('crossbeam', 'Manufacturing - Aerospace', 'Aerospace and Defense', 'close'),
('crossbeam', 'Government - Military', 'Government', 'close'),
('crossbeam', 'Government - Local', 'Government', 'close'),
('crossbeam', 'Energy, Mining, Oil & Gas', 'Energy and Environmental', 'close'),
('crossbeam', 'Construction', 'Construction and Building Materials', 'close'),
('crossbeam', 'Advertising', 'Media', 'close')

ON CONFLICT (source_system, source_industry) DO UPDATE SET
    unified_industry = EXCLUDED.unified_industry,
    match_type = EXCLUDED.match_type;

-- ===========================================
-- VIEW: Crossbeam with Unified Industries
-- ===========================================
CREATE OR REPLACE VIEW crossbeam_unified AS
SELECT
    c.*,
    COALESCE(m.unified_industry, c.industry) as unified_industry,
    m.match_type as industry_match_type
FROM crossbeam_overlaps c
LEFT JOIN industry_mapping m
    ON m.source_system = 'crossbeam'
    AND m.source_industry = c.industry;

COMMENT ON VIEW crossbeam_unified IS
'Crossbeam overlaps with unified industry taxonomy applied';

-- ===========================================
-- VIEW: JACKPOT Accounts (Crossbeam + Whale intersection)
-- ===========================================
CREATE OR REPLACE VIEW jackpot_accounts AS
SELECT
    c.domain,
    c.company_name as crossbeam_company,
    w.account_name as whale_company,
    COALESCE(m.unified_industry, c.industry) as industry,
    c.algolia_status,
    c.partner_status,
    c.partner_name,
    w.zi_revenue_thousands,
    w.zi_employees,
    w.zi_est_it_budget_thousands,
    w.zi_ticker,
    w.journey_stage,
    w.has_shopify_plus,
    w.has_salesforce_commerce_cloud,
    w.has_magento,
    (CASE
        WHEN w.has_shopify_plus OR w.has_salesforce_commerce_cloud OR w.has_magento
        THEN true ELSE false
    END) as has_commerce_platform
FROM crossbeam_overlaps c
INNER JOIN whale_composite w ON c.domain = w.domain
LEFT JOIN industry_mapping m
    ON m.source_system = 'crossbeam'
    AND m.source_industry = c.industry;

COMMENT ON VIEW jackpot_accounts IS
'High-priority accounts that exist in both Crossbeam overlaps AND Whale composite (41 accounts as of 2026-02-27)';
