-- ============================================================================
-- TECH STACK SCHEMA
-- ============================================================================
-- Two-phase approach:
--   Phase 1: Add JSONB column to whale_composite for raw BuiltWith data
--   Phase 2: Normalized tables (technologies + account_technologies)
--
-- Created: 2026-02-27
-- ============================================================================

-- ===========================================
-- PHASE 1: DENORMALIZED LANDING ZONE
-- ===========================================
-- Add JSONB column to whale_composite for raw BuiltWith response
ALTER TABLE whale_composite
ADD COLUMN IF NOT EXISTS builtwith_technologies JSONB,
ADD COLUMN IF NOT EXISTS builtwith_fetched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tech_stack_validated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN whale_composite.builtwith_technologies IS
'Raw BuiltWith API response containing full technology stack. Used as landing zone before normalization.';

COMMENT ON COLUMN whale_composite.builtwith_fetched_at IS
'Timestamp when BuiltWith data was last fetched for this domain.';

COMMENT ON COLUMN whale_composite.tech_stack_validated IS
'TRUE if tech stack has been validated against Demandbase flags.';

-- ===========================================
-- PHASE 2: NORMALIZED TABLES
-- ===========================================

-- Technologies reference table (master list of all technologies)
CREATE TABLE IF NOT EXISTS technologies (
    id SERIAL PRIMARY KEY,

    -- Identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,

    -- Classification
    category VARCHAR(50) NOT NULL,  -- CMS, Commerce, Hyperscaler, Search, Marketing, Analytics, etc.
    subcategory VARCHAR(100),       -- e.g., "Headless CMS", "Enterprise Commerce"
    vendor VARCHAR(100),            -- Adobe, Shopify, AWS, Algolia, etc.

    -- Partner relevance
    is_partner_tech BOOLEAN DEFAULT FALSE,  -- Is this an Algolia partner technology?
    partner_tier VARCHAR(20),               -- PLATINUM, GOLD, SILVER (if partner)

    -- BuiltWith mapping
    builtwith_name VARCHAR(255),    -- Exact name as returned by BuiltWith API
    builtwith_tag VARCHAR(100),     -- BuiltWith category tag

    -- Metadata
    description TEXT,
    website_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Account-Technology junction table (many-to-many)
CREATE TABLE IF NOT EXISTS account_technologies (
    id SERIAL PRIMARY KEY,

    -- Links
    domain VARCHAR(255) NOT NULL,           -- Links to whale_composite.domain or any account
    technology_id INTEGER NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,

    -- Source tracking (for validation)
    source VARCHAR(50) NOT NULL,            -- 'demandbase', 'builtwith', 'crossbeam', 'manual'
    confidence INTEGER DEFAULT 50,          -- 0-100, higher = more confident

    -- Temporal
    first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,         -- FALSE if tech was removed

    -- Metadata
    version VARCHAR(50),                    -- Version if detected
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one record per domain + tech + source
    UNIQUE(domain, technology_id, source)
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_technologies_category ON technologies(category);
CREATE INDEX IF NOT EXISTS idx_technologies_vendor ON technologies(vendor);
CREATE INDEX IF NOT EXISTS idx_technologies_is_partner ON technologies(is_partner_tech);
CREATE INDEX IF NOT EXISTS idx_technologies_builtwith_name ON technologies(builtwith_name);

CREATE INDEX IF NOT EXISTS idx_account_technologies_domain ON account_technologies(domain);
CREATE INDEX IF NOT EXISTS idx_account_technologies_tech_id ON account_technologies(technology_id);
CREATE INDEX IF NOT EXISTS idx_account_technologies_source ON account_technologies(source);
CREATE INDEX IF NOT EXISTS idx_account_technologies_active ON account_technologies(is_active);

-- GIN index for JSONB queries on whale_composite
CREATE INDEX IF NOT EXISTS idx_whale_composite_builtwith_tech ON whale_composite USING GIN (builtwith_technologies);

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_technologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "technologies_read_all" ON technologies FOR SELECT USING (true);
CREATE POLICY "technologies_insert" ON technologies FOR INSERT WITH CHECK (true);
CREATE POLICY "technologies_update" ON technologies FOR UPDATE USING (true);

CREATE POLICY "account_technologies_read_all" ON account_technologies FOR SELECT USING (true);
CREATE POLICY "account_technologies_insert" ON account_technologies FOR INSERT WITH CHECK (true);
CREATE POLICY "account_technologies_update" ON account_technologies FOR UPDATE USING (true);

-- ===========================================
-- SEED: CORE TECHNOLOGIES
-- ===========================================
-- Pre-populate with known partner technologies and competitors

INSERT INTO technologies (name, slug, category, vendor, is_partner_tech, partner_tier, builtwith_name) VALUES
-- CMS (Partners)
('Adobe Experience Manager', 'aem', 'CMS', 'Adobe', true, 'PLATINUM', 'Adobe Experience Manager'),
('Contentful', 'contentful', 'CMS', 'Contentful', true, 'GOLD', 'Contentful'),
('Amplience', 'amplience', 'CMS', 'Amplience', true, 'GOLD', 'Amplience'),
('Sitecore', 'sitecore', 'CMS', 'Sitecore', true, 'SILVER', 'Sitecore'),
('Contentstack', 'contentstack', 'CMS', 'Contentstack', true, 'SILVER', 'Contentstack'),

-- Commerce (Partners)
('Salesforce Commerce Cloud', 'sfcc', 'Commerce', 'Salesforce', true, 'PLATINUM', 'Salesforce Commerce Cloud'),
('Shopify Plus', 'shopify-plus', 'Commerce', 'Shopify', true, 'PLATINUM', 'Shopify Plus'),
('Shopify', 'shopify', 'Commerce', 'Shopify', true, 'GOLD', 'Shopify'),
('Magento', 'magento', 'Commerce', 'Adobe', true, 'GOLD', 'Magento'),
('BigCommerce', 'bigcommerce', 'Commerce', 'BigCommerce', true, 'GOLD', 'BigCommerce'),
('Commercetools', 'commercetools', 'Commerce', 'Commercetools', true, 'GOLD', 'commercetools'),
('Spryker', 'spryker', 'Commerce', 'Spryker', true, 'SILVER', 'Spryker'),
('SAP Commerce Cloud', 'sap-commerce', 'Commerce', 'SAP', true, 'SILVER', 'SAP Commerce Cloud'),

-- Hyperscalers (Partners)
('Amazon Web Services', 'aws', 'Hyperscaler', 'Amazon', true, 'PLATINUM', 'Amazon Web Services'),
('Microsoft Azure', 'azure', 'Hyperscaler', 'Microsoft', true, 'GOLD', 'Azure'),

-- Hyperscalers (Competitors - NOT partners)
('Google Cloud Platform', 'gcp', 'Hyperscaler', 'Google', false, NULL, 'Google Cloud'),

-- Search (Algolia + Competitors)
('Algolia', 'algolia', 'Search', 'Algolia', false, NULL, 'Algolia'),
('Elasticsearch', 'elasticsearch', 'Search', 'Elastic', false, NULL, 'Elasticsearch'),
('Solr', 'solr', 'Search', 'Apache', false, NULL, 'Apache Solr'),
('SearchSpring', 'searchspring', 'Search', 'SearchSpring', false, NULL, 'SearchSpring'),
('Klevu', 'klevu', 'Search', 'Klevu', false, NULL, 'Klevu'),
('Constructor.io', 'constructor', 'Search', 'Constructor', false, NULL, 'Constructor.io'),
('Bloomreach', 'bloomreach', 'Search', 'Bloomreach', false, NULL, 'Bloomreach'),
('Coveo', 'coveo', 'Search', 'Coveo', false, NULL, 'Coveo'),

-- Marketing Automation
('Salesforce Marketing Cloud', 'sfmc', 'Marketing', 'Salesforce', false, NULL, 'Salesforce Marketing Cloud'),
('Marketo', 'marketo', 'Marketing', 'Adobe', false, NULL, 'Marketo'),
('HubSpot', 'hubspot', 'Marketing', 'HubSpot', false, NULL, 'HubSpot'),
('Klaviyo', 'klaviyo', 'Marketing', 'Klaviyo', false, NULL, 'Klaviyo')

ON CONFLICT (slug) DO UPDATE SET
    builtwith_name = EXCLUDED.builtwith_name,
    is_partner_tech = EXCLUDED.is_partner_tech,
    partner_tier = EXCLUDED.partner_tier;

-- ===========================================
-- TABLE COMMENTS
-- ===========================================
COMMENT ON TABLE technologies IS
'Master reference table of all technologies. Pre-seeded with Algolia partners and competitors.
Categories: CMS, Commerce, Hyperscaler, Search, Marketing, Analytics, etc.';

COMMENT ON TABLE account_technologies IS
'Junction table linking accounts (by domain) to their detected technologies.
Supports multiple sources per tech for validation (e.g., Demandbase + BuiltWith both detect Shopify = high confidence).';
