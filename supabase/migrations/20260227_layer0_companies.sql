-- ============================================================================
-- LAYER 0: COMPANIES TABLE (The Galaxy Foundation)
-- ============================================================================
-- A single, simple table that holds all companies with their tech stack.
-- This is the foundation for the 5-layer funnel.
--
-- Data Source: BuiltWith API
-- ============================================================================

-- Drop old tables (starting fresh)
DROP TABLE IF EXISTS partner_tech_accounts CASCADE;
DROP TABLE IF EXISTS partner_technologies CASCADE;
DROP TABLE IF EXISTS algolia_customers CASCADE;

-- Archive old tables (keep data just in case)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies' AND table_schema = 'public') THEN
        ALTER TABLE companies RENAME TO _archive_companies_old;
    END IF;
END $$;

-- ============================================================================
-- THE COMPANIES TABLE
-- ============================================================================
CREATE TABLE companies (
    -- Primary Key
    domain VARCHAR(255) PRIMARY KEY,

    -- Basic Info
    company_name VARCHAR(255),

    -- =========================================================================
    -- THE 4 GALAXIES (Tech Stack)
    -- =========================================================================

    -- CMS Galaxy
    cms_tech VARCHAR(50),
    -- Values: 'AEM', 'Contentful', 'Contentstack', 'Amplience', 'Sitecore', NULL

    -- Commerce Galaxy
    commerce_tech VARCHAR(50),
    -- Values: 'SFCC', 'Shopify+', 'Magento', 'BigCommerce', 'Commercetools', 'Spryker', NULL

    -- MarTech Galaxy
    martech_tech VARCHAR(50),
    -- Values: 'SFMC', 'Marketo', 'HubSpot', 'Klaviyo', NULL

    -- Search Galaxy (competitors + native only - Algolia customers are excluded from this table)
    search_tech VARCHAR(50),
    -- Values: 'Elastic', 'Solr', 'Coveo', 'Bloomreach', 'SearchSpring', 'Lucidworks', 'Klevu', 'Constructor', 'Native', NULL

    -- =========================================================================
    -- COMPUTED CLASSIFICATIONS (for filtering)
    -- =========================================================================

    -- Tech Cohort: Computed from tech stack combination
    tech_cohort VARCHAR(20) GENERATED ALWAYS AS (
        CASE
            -- JACKPOT: CMS + Commerce + (MarTech or Search competitor)
            WHEN cms_tech IS NOT NULL
                 AND commerce_tech IS NOT NULL
                 AND (martech_tech IS NOT NULL OR (search_tech IS NOT NULL AND search_tech != 'Native'))
            THEN 'JACKPOT'

            -- HIGH: CMS + Commerce
            WHEN cms_tech IS NOT NULL AND commerce_tech IS NOT NULL
            THEN 'HIGH'

            -- MEDIUM: Commerce only (premium platforms)
            WHEN commerce_tech IN ('SFCC', 'Shopify+', 'Commercetools')
            THEN 'MEDIUM'

            -- BASE: Any partner tech
            ELSE 'BASE'
        END
    ) STORED,

    -- Sales Play: Computed from search tech (Algolia customers excluded from this table)
    sales_play VARCHAR(20) GENERATED ALWAYS AS (
        CASE
            -- Has competitor search = Displacement opportunity
            WHEN search_tech IN ('Elastic', 'Solr', 'Coveo', 'Bloomreach', 'SearchSpring', 'Lucidworks', 'Klevu', 'Constructor')
            THEN 'DISPLACEMENT'

            -- Has native/basic search OR no search = Greenfield opportunity
            ELSE 'GREENFIELD'
        END
    ) STORED,

    -- =========================================================================
    -- METADATA
    -- =========================================================================
    source VARCHAR(50) DEFAULT 'builtwith',
    source_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_companies_cms ON companies(cms_tech) WHERE cms_tech IS NOT NULL;
CREATE INDEX idx_companies_commerce ON companies(commerce_tech) WHERE commerce_tech IS NOT NULL;
CREATE INDEX idx_companies_martech ON companies(martech_tech) WHERE martech_tech IS NOT NULL;
CREATE INDEX idx_companies_search ON companies(search_tech) WHERE search_tech IS NOT NULL;
CREATE INDEX idx_companies_cohort ON companies(tech_cohort);
CREATE INDEX idx_companies_sales_play ON companies(sales_play);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_read_all" ON companies FOR SELECT USING (true);
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (true);
CREATE POLICY "companies_delete" ON companies FOR DELETE USING (true);

-- ============================================================================
-- REFERENCE TABLE: Valid tech values (for dropdowns)
-- ============================================================================
CREATE TABLE tech_options (
    id SERIAL PRIMARY KEY,
    galaxy VARCHAR(20) NOT NULL,  -- 'cms', 'commerce', 'martech', 'search'
    slug VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    partner_name VARCHAR(100),
    is_competitor BOOLEAN DEFAULT FALSE,  -- For search: is this a competitor?
    display_order INTEGER DEFAULT 0,
    UNIQUE(galaxy, slug)
);

-- Seed tech options
INSERT INTO tech_options (galaxy, slug, display_name, partner_name, is_competitor, display_order) VALUES
    -- CMS Galaxy
    ('cms', 'AEM', 'Adobe Experience Manager', 'Adobe', FALSE, 1),
    ('cms', 'Contentful', 'Contentful', 'Contentful', FALSE, 2),
    ('cms', 'Contentstack', 'Contentstack', 'Contentstack', FALSE, 3),
    ('cms', 'Amplience', 'Amplience', 'Amplience', FALSE, 4),
    ('cms', 'Sitecore', 'Sitecore', 'Sitecore', FALSE, 5),

    -- Commerce Galaxy
    ('commerce', 'SFCC', 'Salesforce Commerce Cloud', 'Salesforce', FALSE, 1),
    ('commerce', 'Shopify+', 'Shopify Plus', 'Shopify', FALSE, 2),
    ('commerce', 'Magento', 'Adobe Commerce (Magento)', 'Adobe', FALSE, 3),
    ('commerce', 'BigCommerce', 'BigCommerce', 'BigCommerce', FALSE, 4),
    ('commerce', 'Commercetools', 'Commercetools', 'Commercetools', FALSE, 5),
    ('commerce', 'Spryker', 'Spryker', 'Spryker', FALSE, 6),

    -- MarTech Galaxy
    ('martech', 'SFMC', 'Salesforce Marketing Cloud', 'Salesforce', FALSE, 1),
    ('martech', 'Marketo', 'Adobe Marketo', 'Adobe', FALSE, 2),
    ('martech', 'HubSpot', 'HubSpot', 'HubSpot', FALSE, 3),
    ('martech', 'Klaviyo', 'Klaviyo', 'Klaviyo', FALSE, 4),

    -- Search Galaxy (Competitors)
    ('search', 'Elastic', 'Elasticsearch', 'Elastic', TRUE, 1),
    ('search', 'Solr', 'Apache Solr', NULL, TRUE, 2),
    ('search', 'Coveo', 'Coveo', 'Coveo', TRUE, 3),
    ('search', 'Bloomreach', 'Bloomreach', 'Bloomreach', TRUE, 4),
    ('search', 'SearchSpring', 'SearchSpring', 'SearchSpring', TRUE, 5),
    ('search', 'Lucidworks', 'Lucidworks', 'Lucidworks', TRUE, 6),
    ('search', 'Klevu', 'Klevu', 'Klevu', TRUE, 7),
    ('search', 'Constructor', 'Constructor.io', 'Constructor', TRUE, 8),

    -- Search Galaxy (Native - basic platform search)
    ('search', 'Native', 'Native Platform Search', NULL, FALSE, 20)
ON CONFLICT (galaxy, slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    partner_name = EXCLUDED.partner_name,
    is_competitor = EXCLUDED.is_competitor,
    display_order = EXCLUDED.display_order;

ALTER TABLE tech_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_options_read" ON tech_options FOR SELECT USING (true);

-- ============================================================================
-- VIEWS FOR UI
-- ============================================================================

-- Galaxy Summary: Counts per tech value
CREATE OR REPLACE VIEW galaxy_summary AS
SELECT
    'cms' as galaxy,
    cms_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE cms_tech IS NOT NULL
GROUP BY cms_tech

UNION ALL

SELECT
    'commerce' as galaxy,
    commerce_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE commerce_tech IS NOT NULL
GROUP BY commerce_tech

UNION ALL

SELECT
    'martech' as galaxy,
    martech_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE martech_tech IS NOT NULL
GROUP BY martech_tech

UNION ALL

SELECT
    'search' as galaxy,
    search_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE search_tech IS NOT NULL
GROUP BY search_tech;

-- Cohort Summary
CREATE OR REPLACE VIEW cohort_summary AS
SELECT
    tech_cohort,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
GROUP BY tech_cohort
ORDER BY
    CASE tech_cohort
        WHEN 'JACKPOT' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        ELSE 4
    END;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================
COMMENT ON TABLE companies IS
'Layer 0: The Partner Tech Galaxy. All NON-Algolia companies with their tech stack from BuiltWith.
Algolia customers are excluded from this table - this is prospects only.
Columns: domain, company_name, cms_tech, commerce_tech, martech_tech, search_tech.
Computed: tech_cohort (JACKPOT/HIGH/MEDIUM/BASE), sales_play (DISPLACEMENT/GREENFIELD).';

COMMENT ON TABLE tech_options IS
'Reference table for valid tech values in each galaxy. Used for UI dropdowns.';

COMMENT ON VIEW galaxy_summary IS
'Counts of companies per technology, grouped by galaxy.';

COMMENT ON VIEW cohort_summary IS
'Counts of companies per tech cohort, with sales play breakdown.';
