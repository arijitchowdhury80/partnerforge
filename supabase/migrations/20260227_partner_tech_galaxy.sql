-- ============================================================================
-- PARTNER TECH GALAXY - Foundation Tables
-- ============================================================================
-- The data universe: All accounts using partner technologies
-- MINUS current Algolia customers = Displacement/Greenfield opportunities
--
-- Structure:
--   1. partner_technologies - Catalog of tracked technologies
--   2. partner_tech_accounts - Union of all partner customer lists
--   3. algolia_customers - Exclusion list
--   4. partner_tech_galaxy - View that computes the working universe
-- ============================================================================

-- ============================================================================
-- 1. TECHNOLOGY CATALOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    slug VARCHAR(50) UNIQUE NOT NULL,        -- e.g., 'adobe-aem', 'sfcc'
    name VARCHAR(100) NOT NULL,               -- e.g., 'Adobe Experience Manager'
    short_name VARCHAR(30),                   -- e.g., 'AEM'

    -- Classification
    category VARCHAR(30) NOT NULL,            -- 'cms', 'commerce', 'martech', 'hyperscaler'
    tier VARCHAR(20) DEFAULT 'standard',      -- 'premium', 'standard', 'basic'

    -- Partner relationship
    partner_name VARCHAR(100),                -- e.g., 'Adobe', 'Salesforce'
    is_strategic_partner BOOLEAN DEFAULT FALSE,

    -- Scoring weight
    cohort_score INTEGER DEFAULT 10,          -- Points when detected in stack

    -- Metadata
    logo_url VARCHAR(500),
    website_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed technology catalog
INSERT INTO partner_technologies (slug, name, short_name, category, tier, partner_name, is_strategic_partner, cohort_score) VALUES
    -- CMS Partners
    ('adobe-aem', 'Adobe Experience Manager', 'AEM', 'cms', 'premium', 'Adobe', TRUE, 25),
    ('contentful', 'Contentful', 'Contentful', 'cms', 'premium', 'Contentful', TRUE, 20),
    ('contentstack', 'Contentstack', 'Contentstack', 'cms', 'premium', 'Contentstack', TRUE, 20),
    ('amplience', 'Amplience', 'Amplience', 'cms', 'premium', 'Amplience', TRUE, 20),
    ('sitecore', 'Sitecore', 'Sitecore', 'cms', 'premium', 'Sitecore', FALSE, 15),
    ('wordpress', 'WordPress', 'WP', 'cms', 'basic', NULL, FALSE, 5),

    -- Commerce Partners
    ('sfcc', 'Salesforce Commerce Cloud', 'SFCC', 'commerce', 'premium', 'Salesforce', TRUE, 25),
    ('shopify-plus', 'Shopify Plus', 'Shopify+', 'commerce', 'premium', 'Shopify', TRUE, 20),
    ('magento', 'Adobe Commerce (Magento)', 'Magento', 'commerce', 'premium', 'Adobe', TRUE, 20),
    ('bigcommerce', 'BigCommerce', 'BigCommerce', 'commerce', 'standard', 'BigCommerce', FALSE, 15),
    ('commercetools', 'Commercetools', 'CT', 'commerce', 'premium', 'Commercetools', TRUE, 25),
    ('shopify', 'Shopify', 'Shopify', 'commerce', 'standard', 'Shopify', FALSE, 10),
    ('spryker', 'Spryker', 'Spryker', 'commerce', 'premium', 'Spryker', TRUE, 20),
    ('vtex', 'VTEX', 'VTEX', 'commerce', 'standard', 'VTEX', FALSE, 15),

    -- MarTech Partners
    ('sfmc', 'Salesforce Marketing Cloud', 'SFMC', 'martech', 'premium', 'Salesforce', TRUE, 15),
    ('marketo', 'Adobe Marketo', 'Marketo', 'martech', 'premium', 'Adobe', FALSE, 10),
    ('hubspot', 'HubSpot', 'HubSpot', 'martech', 'standard', 'HubSpot', FALSE, 10),
    ('klaviyo', 'Klaviyo', 'Klaviyo', 'martech', 'standard', 'Klaviyo', FALSE, 10),

    -- Hyperscalers
    ('aws', 'Amazon Web Services', 'AWS', 'hyperscaler', 'premium', 'AWS', TRUE, 10),
    ('azure', 'Microsoft Azure', 'Azure', 'hyperscaler', 'premium', 'Microsoft', FALSE, 10),
    ('gcp', 'Google Cloud Platform', 'GCP', 'hyperscaler', 'premium', 'Google', FALSE, 10),

    -- Search Tech: Competitors (for Displacement classification)
    ('elasticsearch', 'Elasticsearch', 'Elastic', 'search', 'competitor', 'Elastic', FALSE, 0),
    ('solr', 'Apache Solr', 'Solr', 'search', 'competitor', NULL, FALSE, 0),
    ('coveo', 'Coveo', 'Coveo', 'search', 'competitor', 'Coveo', FALSE, 0),
    ('lucidworks', 'Lucidworks Fusion', 'Lucidworks', 'search', 'competitor', 'Lucidworks', FALSE, 0),
    ('bloomreach', 'Bloomreach', 'Bloomreach', 'search', 'competitor', 'Bloomreach', FALSE, 0),
    ('searchspring', 'SearchSpring', 'SearchSpring', 'search', 'competitor', 'SearchSpring', FALSE, 0),
    ('constructor', 'Constructor.io', 'Constructor', 'search', 'competitor', 'Constructor', FALSE, 0),
    ('klevu', 'Klevu', 'Klevu', 'search', 'competitor', 'Klevu', FALSE, 0),
    ('searchanise', 'Searchanise', 'Searchanise', 'search', 'competitor', NULL, FALSE, 0),
    ('yext', 'Yext', 'Yext', 'search', 'competitor', 'Yext', FALSE, 0),
    ('swiftype', 'Swiftype', 'Swiftype', 'search', 'competitor', 'Elastic', FALSE, 0),
    ('attraqt', 'Attraqt', 'Attraqt', 'search', 'competitor', 'Attraqt', FALSE, 0),
    ('doofinder', 'Doofinder', 'Doofinder', 'search', 'competitor', NULL, FALSE, 0),
    ('hawksearch', 'HawkSearch', 'HawkSearch', 'search', 'competitor', NULL, FALSE, 0),

    -- Search Tech: Native/Basic (for Greenfield classification)
    ('shopify-native', 'Shopify Native Search', 'Shopify Search', 'search', 'native', 'Shopify', FALSE, 0),
    ('magento-native', 'Magento Native Search', 'Magento Search', 'search', 'native', 'Adobe', FALSE, 0),
    ('sfcc-einstein', 'SFCC Einstein Search', 'Einstein', 'search', 'native', 'Salesforce', FALSE, 0),
    ('bigcommerce-native', 'BigCommerce Native Search', 'BC Search', 'search', 'native', 'BigCommerce', FALSE, 0),
    ('wordpress-native', 'WordPress Search', 'WP Search', 'search', 'native', NULL, FALSE, 0),

    -- Algolia (for exclusion)
    ('algolia', 'Algolia', 'Algolia', 'search', 'algolia', 'Algolia', TRUE, 0)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    tier = EXCLUDED.tier,
    partner_name = EXCLUDED.partner_name,
    is_strategic_partner = EXCLUDED.is_strategic_partner,
    cohort_score = EXCLUDED.cohort_score;

-- ============================================================================
-- 2. PARTNER TECH ACCOUNTS (Union of all partner lists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_tech_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core identity
    domain VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),

    -- Source tracking
    source VARCHAR(50) NOT NULL,              -- 'crossbeam', 'builtwith', 'manual', 'demandbase'
    source_list VARCHAR(100),                 -- e.g., 'AEM-Algolia Crossbeam', 'BuiltWith SFCC'
    source_date DATE,

    -- Technology detected
    technology_slug VARCHAR(50) REFERENCES partner_technologies(slug),
    technology_version VARCHAR(50),           -- If available
    detection_confidence VARCHAR(20),         -- 'high', 'medium', 'low'

    -- Additional context from source
    source_metadata JSONB,                    -- Raw data from source

    -- Dedup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(domain, technology_slug, source)
);

CREATE INDEX idx_partner_tech_accounts_domain ON partner_tech_accounts(domain);
CREATE INDEX idx_partner_tech_accounts_tech ON partner_tech_accounts(technology_slug);
CREATE INDEX idx_partner_tech_accounts_source ON partner_tech_accounts(source);

-- ============================================================================
-- 3. ALGOLIA CUSTOMERS (Exclusion List)
-- ============================================================================
CREATE TABLE IF NOT EXISTS algolia_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    domain VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255),

    -- Customer status
    customer_since DATE,
    arr DECIMAL(15,2),
    tier VARCHAR(30),                         -- 'enterprise', 'growth', 'starter'

    -- Source
    source VARCHAR(50),                       -- 'salesforce', 'manual'
    salesforce_account_id VARCHAR(18),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_algolia_customers_domain ON algolia_customers(domain);

-- ============================================================================
-- 4. PARTNER TECH GALAXY VIEW (The Working Universe)
-- ============================================================================
-- Aggregates all partner tech accounts, excluding Algolia customers
-- Groups by domain to show full tech stack per account

CREATE OR REPLACE VIEW partner_tech_galaxy AS
WITH
-- Aggregate technologies per domain
tech_stacks AS (
    SELECT
        pta.domain,
        MAX(pta.company_name) as company_name,

        -- Technology arrays by category
        ARRAY_AGG(DISTINCT pt.slug) FILTER (WHERE pt.category = 'cms') as cms_technologies,
        ARRAY_AGG(DISTINCT pt.slug) FILTER (WHERE pt.category = 'commerce') as commerce_technologies,
        ARRAY_AGG(DISTINCT pt.slug) FILTER (WHERE pt.category = 'martech') as martech_technologies,
        ARRAY_AGG(DISTINCT pt.slug) FILTER (WHERE pt.category = 'hyperscaler') as hyperscaler_technologies,
        ARRAY_AGG(DISTINCT pt.slug) FILTER (WHERE pt.category = 'search') as search_technologies,

        -- Counts
        COUNT(DISTINCT pt.slug) FILTER (WHERE pt.category = 'cms') as cms_count,
        COUNT(DISTINCT pt.slug) FILTER (WHERE pt.category = 'commerce') as commerce_count,
        COUNT(DISTINCT pt.slug) FILTER (WHERE pt.category = 'martech') as martech_count,
        COUNT(DISTINCT pt.slug) FILTER (WHERE pt.category = 'hyperscaler') as hyperscaler_count,
        COUNT(DISTINCT pt.slug) FILTER (WHERE pt.category = 'search' AND pt.tier = 'competitor') as competitor_search_count,
        COUNT(DISTINCT pt.slug) FILTER (WHERE pt.category = 'search' AND pt.tier = 'native') as native_search_count,
        COUNT(DISTINCT pt.slug) FILTER (WHERE pt.category = 'search' AND pt.tier = 'algolia') as algolia_count,

        -- Total cohort score
        COALESCE(SUM(pt.cohort_score), 0) as total_cohort_score,

        -- Sources
        ARRAY_AGG(DISTINCT pta.source) as sources,
        MAX(pta.updated_at) as last_updated

    FROM partner_tech_accounts pta
    JOIN partner_technologies pt ON pta.technology_slug = pt.slug
    GROUP BY pta.domain
)

SELECT
    ts.*,

    -- Tech Cohort Classification
    CASE
        -- JACKPOT: CMS + Commerce + (Hyperscaler OR MarTech)
        WHEN ts.cms_count > 0 AND ts.commerce_count > 0 AND (ts.hyperscaler_count > 0 OR ts.martech_count > 0)
        THEN 'JACKPOT'

        -- HIGH: CMS + Commerce
        WHEN ts.cms_count > 0 AND ts.commerce_count > 0
        THEN 'HIGH'

        -- MEDIUM: Commerce only (with premium tier)
        WHEN ts.commerce_count > 0 AND EXISTS (
            SELECT 1 FROM partner_tech_accounts pta2
            JOIN partner_technologies pt2 ON pta2.technology_slug = pt2.slug
            WHERE pta2.domain = ts.domain AND pt2.tier = 'premium'
        )
        THEN 'MEDIUM'

        -- BASE: Any partner tech
        ELSE 'BASE'
    END as tech_cohort,

    -- Is Algolia customer?
    CASE WHEN ac.domain IS NOT NULL THEN TRUE ELSE FALSE END as is_algolia_customer,
    ac.arr as algolia_arr,
    ac.tier as algolia_tier,

    -- Sales Play Classification (for Layer 5)
    CASE
        -- Already using Algolia (via tech detection OR customer list)
        WHEN ts.algolia_count > 0 OR ac.domain IS NOT NULL
        THEN 'EXISTING_CUSTOMER'

        -- Has competitor search = Displacement opportunity
        WHEN ts.competitor_search_count > 0
        THEN 'DISPLACEMENT'

        -- Has native/basic search = Greenfield upgrade
        WHEN ts.native_search_count > 0
        THEN 'GREENFIELD_UPGRADE'

        -- No search detected = Greenfield net new
        ELSE 'GREENFIELD_NEW'
    END as sales_play,

    -- Search tech details for sales context
    ts.search_technologies,
    ts.competitor_search_count,
    ts.native_search_count

FROM tech_stacks ts
LEFT JOIN algolia_customers ac ON LOWER(ts.domain) = LOWER(ac.domain);

-- ============================================================================
-- 5. CONVENIENCE VIEWS
-- ============================================================================

-- Non-Algolia accounts only (the displacement/greenfield universe)
CREATE OR REPLACE VIEW partner_tech_opportunities AS
SELECT * FROM partner_tech_galaxy
WHERE is_algolia_customer = FALSE
ORDER BY total_cohort_score DESC, tech_cohort;

-- By tech cohort
CREATE OR REPLACE VIEW partner_tech_by_cohort AS
SELECT
    tech_cohort,
    COUNT(*) as account_count,
    COUNT(*) FILTER (WHERE NOT is_algolia_customer) as opportunity_count,
    ROUND(AVG(total_cohort_score)::numeric, 1) as avg_score
FROM partner_tech_galaxy
GROUP BY tech_cohort
ORDER BY
    CASE tech_cohort
        WHEN 'JACKPOT' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        ELSE 4
    END;

-- By sales play
CREATE OR REPLACE VIEW partner_tech_by_sales_play AS
SELECT
    sales_play,
    COUNT(*) as account_count,
    COUNT(*) FILTER (WHERE tech_cohort = 'JACKPOT') as jackpot_count,
    COUNT(*) FILTER (WHERE tech_cohort = 'HIGH') as high_count,
    COUNT(*) FILTER (WHERE tech_cohort = 'MEDIUM') as medium_count,
    ROUND(AVG(total_cohort_score)::numeric, 1) as avg_score
FROM partner_tech_galaxy
WHERE sales_play != 'EXISTING_CUSTOMER'
GROUP BY sales_play
ORDER BY
    CASE sales_play
        WHEN 'DISPLACEMENT' THEN 1
        WHEN 'GREENFIELD_UPGRADE' THEN 2
        WHEN 'GREENFIELD_NEW' THEN 3
        ELSE 4
    END;

-- By competitor search provider
CREATE OR REPLACE VIEW partner_tech_by_competitor_search AS
SELECT
    UNNEST(search_technologies) as search_tech,
    COUNT(*) as account_count,
    COUNT(*) FILTER (WHERE tech_cohort IN ('JACKPOT', 'HIGH')) as high_value_count
FROM partner_tech_galaxy
WHERE competitor_search_count > 0
  AND sales_play = 'DISPLACEMENT'
GROUP BY UNNEST(search_technologies)
ORDER BY account_count DESC;

-- By technology
CREATE OR REPLACE VIEW partner_tech_by_technology AS
SELECT
    pt.slug,
    pt.name,
    pt.category,
    pt.partner_name,
    COUNT(DISTINCT pta.domain) as total_accounts,
    COUNT(DISTINCT pta.domain) FILTER (WHERE ac.domain IS NULL) as opportunity_accounts
FROM partner_technologies pt
LEFT JOIN partner_tech_accounts pta ON pt.slug = pta.technology_slug
LEFT JOIN algolia_customers ac ON LOWER(pta.domain) = LOWER(ac.domain)
GROUP BY pt.slug, pt.name, pt.category, pt.partner_name
ORDER BY opportunity_accounts DESC;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE partner_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_tech_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE algolia_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_technologies_read" ON partner_technologies FOR SELECT USING (true);
CREATE POLICY "partner_tech_accounts_read" ON partner_tech_accounts FOR SELECT USING (true);
CREATE POLICY "partner_tech_accounts_write" ON partner_tech_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "partner_tech_accounts_update" ON partner_tech_accounts FOR UPDATE USING (true);
CREATE POLICY "algolia_customers_read" ON algolia_customers FOR SELECT USING (true);
CREATE POLICY "algolia_customers_write" ON algolia_customers FOR INSERT WITH CHECK (true);

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================
COMMENT ON TABLE partner_technologies IS
'Catalog of partner technologies tracked for co-sell opportunities.
Categories: cms, commerce, martech, hyperscaler';

COMMENT ON TABLE partner_tech_accounts IS
'Union of all partner technology customer lists from various sources.
Each row = one domain using one technology from one source.
Multiple rows per domain expected (multi-tech stacks).';

COMMENT ON TABLE algolia_customers IS
'Current Algolia customers - used for exclusion from opportunity lists.';

COMMENT ON VIEW partner_tech_galaxy IS
'The working universe: All domains with partner tech, aggregated by tech stack.
Shows tech cohort classification and Algolia customer status.';

COMMENT ON VIEW partner_tech_opportunities IS
'Filtered galaxy: Only non-Algolia customers (displacement/greenfield targets).';
