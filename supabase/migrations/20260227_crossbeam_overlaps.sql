-- ============================================================================
-- Crossbeam Overlaps Table
-- Partner ecosystem overlap data from Crossbeam exports
-- ============================================================================

-- Crossbeam overlap records
CREATE TABLE IF NOT EXISTS crossbeam_overlaps (
    id SERIAL PRIMARY KEY,

    -- Core identifiers
    domain VARCHAR(255) NOT NULL,
    company_name VARCHAR(500),
    record_name VARCHAR(500),  -- Original "Record" field from Crossbeam

    -- Population status (the key intersection data)
    algolia_status VARCHAR(50) NOT NULL,  -- 'Prospect', 'Customer', 'Opportunity'
    partner_status VARCHAR(50) NOT NULL,  -- 'Customer', 'Prospect', etc.
    partner_name VARCHAR(100) NOT NULL DEFAULT 'Adobe',  -- Which partner (Adobe, Salesforce, etc.)
    partner_product VARCHAR(100),  -- 'AEM', 'Commerce', 'SFCC', etc.

    -- Ownership
    algolia_owner VARCHAR(255),  -- Algolia AE name
    partner_owner VARCHAR(255),  -- Partner AE name

    -- Firmographics
    industry VARCHAR(255),
    geo VARCHAR(50),
    billing_country VARCHAR(100),

    -- Opportunity data
    opportunities_amount DECIMAL(15,2) DEFAULT 0,
    opportunities_count INTEGER DEFAULT 0,

    -- Metadata
    overlap_detected_at TIMESTAMPTZ,
    partner_close_date TIMESTAMPTZ,
    source_file VARCHAR(255),
    uploaded_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(domain, partner_name, partner_product)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_crossbeam_domain ON crossbeam_overlaps(domain);
CREATE INDEX IF NOT EXISTS idx_crossbeam_algolia_status ON crossbeam_overlaps(algolia_status);
CREATE INDEX IF NOT EXISTS idx_crossbeam_partner ON crossbeam_overlaps(partner_name, partner_product);
CREATE INDEX IF NOT EXISTS idx_crossbeam_industry ON crossbeam_overlaps(industry);
CREATE INDEX IF NOT EXISTS idx_crossbeam_geo ON crossbeam_overlaps(geo);

-- RLS policies
ALTER TABLE crossbeam_overlaps ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access to crossbeam_overlaps"
    ON crossbeam_overlaps
    FOR SELECT
    USING (true);

-- Allow insert/update for authenticated users
CREATE POLICY "Allow insert to crossbeam_overlaps"
    ON crossbeam_overlaps
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update to crossbeam_overlaps"
    ON crossbeam_overlaps
    FOR UPDATE
    USING (true);

-- ============================================================================
-- View: Crossbeam + Displacement Targets Join
-- Combines Crossbeam validation with BuiltWith enrichment
-- ============================================================================

CREATE OR REPLACE VIEW crossbeam_enriched AS
SELECT
    c.id AS crossbeam_id,
    c.domain,
    c.company_name,
    c.algolia_status,
    c.partner_status,
    c.partner_name,
    c.partner_product,
    c.algolia_owner,
    c.partner_owner,
    c.industry AS crossbeam_industry,
    c.geo,
    c.billing_country,
    c.opportunities_amount,
    c.opportunities_count,
    -- Enrichment from displacement_targets
    d.icp_score,
    d.icp_tier_name,
    d.sw_monthly_visits,
    d.revenue,
    d.current_search,
    d.tech_stack_json,
    d.vertical AS builtwith_vertical,
    d.enrichment_level,
    -- Computed priority
    CASE
        WHEN c.algolia_status = 'Prospect' AND c.partner_status = 'Customer' THEN 'HOT'
        WHEN c.algolia_status = 'Opportunity' AND c.partner_status = 'Customer' THEN 'ACTIVE'
        ELSE 'WARM'
    END AS crossbeam_priority
FROM crossbeam_overlaps c
LEFT JOIN displacement_targets d ON LOWER(c.domain) = LOWER(d.domain);

-- ============================================================================
-- Summary stats view
-- ============================================================================

CREATE OR REPLACE VIEW crossbeam_stats AS
SELECT
    partner_name,
    partner_product,
    algolia_status,
    partner_status,
    COUNT(DISTINCT domain) AS unique_domains,
    COUNT(*) AS total_records,
    COUNT(DISTINCT CASE WHEN geo = 'AMERICAS' THEN domain END) AS americas_domains,
    COUNT(DISTINCT CASE WHEN geo = 'EMEA' THEN domain END) AS emea_domains,
    COUNT(DISTINCT CASE WHEN geo = 'APAC' THEN domain END) AS apac_domains
FROM crossbeam_overlaps
GROUP BY partner_name, partner_product, algolia_status, partner_status;

COMMENT ON TABLE crossbeam_overlaps IS 'Partner ecosystem overlap data from Crossbeam. Shows which accounts are shared between Algolia and partners like Adobe.';
COMMENT ON VIEW crossbeam_enriched IS 'Crossbeam data joined with BuiltWith enrichment for full account intelligence.';
