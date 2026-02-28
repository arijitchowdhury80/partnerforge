-- ============================================================================
-- COMPREHENSIVE BUILTWITH DATA SCHEMA (Optimized)
-- ============================================================================
-- 4 Tables:
--   1. companies        - All company data including contacts & socials
--   2. company_technologies - Many-to-many tech stack with timeline
--   3. company_relationships - Parent/child/subsidiary relationships
--   4. technologies     - Reference table for tech classification
--   5. builtwith_raw    - Raw API responses for debugging
-- ============================================================================

-- ============================================================================
-- 1. COMPANIES TABLE (Enhanced with all firmographic data)
-- ============================================================================

ALTER TABLE companies
  -- Basic Info
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS website_url VARCHAR(500),

  -- Location (from BuiltWith Meta)
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postcode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vertical VARCHAR(100),

  -- Contact Info (merged - one per company)
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),

  -- Social Links (merged - one per company)
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS twitter_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(500),

  -- Spend & Revenue (CRITICAL for qualification)
  ADD COLUMN IF NOT EXISTS monthly_tech_spend INTEGER,
  ADD COLUMN IF NOT EXISTS sales_revenue_band VARCHAR(50),

  -- Traffic & Ranking
  ADD COLUMN IF NOT EXISTS alexa_rank INTEGER,
  ADD COLUMN IF NOT EXISTS quantcast_rank INTEGER,
  ADD COLUMN IF NOT EXISTS quantcast_reach INTEGER,
  ADD COLUMN IF NOT EXISTS majestic_rank INTEGER,
  ADD COLUMN IF NOT EXISTS referring_subnets INTEGER,

  -- Timeline
  ADD COLUMN IF NOT EXISTS first_indexed TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_indexed TIMESTAMP,

  -- Metadata
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_vertical ON companies(vertical);
CREATE INDEX IF NOT EXISTS idx_companies_spend ON companies(monthly_tech_spend) WHERE monthly_tech_spend IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_revenue ON companies(sales_revenue_band) WHERE sales_revenue_band IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_majestic ON companies(majestic_rank) WHERE majestic_rank IS NOT NULL;

-- Comments
COMMENT ON COLUMN companies.logo_url IS 'Company logo - use Clearbit: https://logo.clearbit.com/{domain}';
COMMENT ON COLUMN companies.monthly_tech_spend IS 'BuiltWith estimated monthly technology spend in USD';
COMMENT ON COLUMN companies.sales_revenue_band IS 'Revenue band: "1M-10M", "10M-50M", "50M-100M", "100M-500M", "500M+"';
COMMENT ON COLUMN companies.vertical IS 'BuiltWith industry vertical';
COMMENT ON COLUMN companies.majestic_rank IS 'Majestic SEO authority score (most useful ranking)';
COMMENT ON COLUMN companies.referring_subnets IS 'Unique networks linking to domain (link quality signal)';

-- ============================================================================
-- 2. COMPANY TECHNOLOGIES TABLE (One company → Many technologies)
-- ============================================================================
-- This MUST be separate because one company has 50-200 technologies
-- and we need to track first_detected/last_detected per technology

CREATE TABLE IF NOT EXISTS company_technologies (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,

  -- Technology Info (from BuiltWith)
  tech_name VARCHAR(255) NOT NULL,
  tech_description TEXT,
  tech_tag VARCHAR(100),
  tech_categories TEXT[],

  -- Our Classification
  galaxy VARCHAR(20),
  our_tech_name VARCHAR(50),

  -- Timeline (CRITICAL for adoption analysis)
  first_detected TIMESTAMP NOT NULL,
  last_detected TIMESTAMP NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_company_tech_domain FOREIGN KEY (domain) REFERENCES companies(domain) ON DELETE CASCADE,
  CONSTRAINT uq_company_tech UNIQUE(domain, tech_name)
);

CREATE INDEX idx_company_tech_domain ON company_technologies(domain);
CREATE INDEX idx_company_tech_name ON company_technologies(tech_name);
CREATE INDEX idx_company_tech_galaxy ON company_technologies(galaxy) WHERE galaxy IS NOT NULL;
CREATE INDEX idx_company_tech_our_name ON company_technologies(our_tech_name) WHERE our_tech_name IS NOT NULL;
CREATE INDEX idx_company_tech_first ON company_technologies(first_detected);
CREATE INDEX idx_company_tech_current ON company_technologies(is_current) WHERE is_current = TRUE;

COMMENT ON TABLE company_technologies IS 'All technologies per company with adoption timeline. One company has 50-200 techs.';

-- ============================================================================
-- 3. COMPANY RELATIONSHIPS TABLE (Parent/Child/Subsidiary)
-- ============================================================================
-- This MUST be separate because one company can have many relationships
-- e.g., LVMH → Louis Vuitton, Dior, Fendi, Sephora, etc.

CREATE TABLE IF NOT EXISTS company_relationships (
  id SERIAL PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  related_domain VARCHAR(255) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL,  -- parent, child, subsidiary, sibling, brand
  confidence_score DECIMAL(3,2),
  source VARCHAR(50) DEFAULT 'builtwith',
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_rel_domain FOREIGN KEY (domain) REFERENCES companies(domain) ON DELETE CASCADE,
  CONSTRAINT uq_relationship UNIQUE(domain, related_domain, relationship_type)
);

CREATE INDEX idx_rel_domain ON company_relationships(domain);
CREATE INDEX idx_rel_related ON company_relationships(related_domain);
CREATE INDEX idx_rel_type ON company_relationships(relationship_type);

COMMENT ON TABLE company_relationships IS 'Parent/child/subsidiary relationships. E.g., Tapestry → Coach, Kate Spade, Stuart Weitzman';

-- ============================================================================
-- 4. TECHNOLOGIES REFERENCE TABLE (Lookup for classification)
-- ============================================================================

CREATE TABLE IF NOT EXISTS technologies (
  id SERIAL PRIMARY KEY,
  builtwith_name VARCHAR(255) UNIQUE NOT NULL,
  our_name VARCHAR(50),
  galaxy VARCHAR(20),
  builtwith_tag VARCHAR(100),
  is_partner BOOLEAN DEFAULT FALSE,
  is_competitor BOOLEAN DEFAULT FALSE,
  partner_name VARCHAR(100),
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tech_galaxy ON technologies(galaxy);
CREATE INDEX idx_tech_partner ON technologies(is_partner) WHERE is_partner = TRUE;
CREATE INDEX idx_tech_competitor ON technologies(is_competitor) WHERE is_competitor = TRUE;

COMMENT ON TABLE technologies IS 'Reference table mapping BuiltWith tech names to our galaxy classification';

-- Seed with known technologies
INSERT INTO technologies (builtwith_name, our_name, galaxy, is_partner, is_competitor, partner_name, priority) VALUES
  -- CMS Galaxy (Partners)
  ('Adobe Experience Manager', 'AEM', 'cms', TRUE, FALSE, 'Adobe', 100),
  ('Adobe-Experience-Manager', 'AEM', 'cms', TRUE, FALSE, 'Adobe', 100),
  ('Contentful', 'Contentful', 'cms', TRUE, FALSE, 'Contentful', 90),
  ('Contentstack', 'Contentstack', 'cms', TRUE, FALSE, 'Contentstack', 85),
  ('Amplience', 'Amplience', 'cms', TRUE, FALSE, 'Amplience', 80),
  ('Sitecore', 'Sitecore', 'cms', TRUE, FALSE, 'Sitecore', 75),

  -- Commerce Galaxy (Partners)
  ('Salesforce Commerce Cloud', 'SFCC', 'commerce', TRUE, FALSE, 'Salesforce', 100),
  ('Salesforce-Commerce-Cloud', 'SFCC', 'commerce', TRUE, FALSE, 'Salesforce', 100),
  ('Demandware', 'SFCC', 'commerce', TRUE, FALSE, 'Salesforce', 100),
  ('Shopify Plus', 'Shopify+', 'commerce', TRUE, FALSE, 'Shopify', 95),
  ('Shopify-Plus', 'Shopify+', 'commerce', TRUE, FALSE, 'Shopify', 95),
  ('Magento', 'Magento', 'commerce', TRUE, FALSE, 'Adobe', 90),
  ('Adobe Commerce', 'Magento', 'commerce', TRUE, FALSE, 'Adobe', 90),
  ('BigCommerce', 'BigCommerce', 'commerce', TRUE, FALSE, 'BigCommerce', 85),
  ('commercetools', 'Commercetools', 'commerce', TRUE, FALSE, 'commercetools', 80),
  ('Commercetools', 'Commercetools', 'commerce', TRUE, FALSE, 'commercetools', 80),
  ('Spryker', 'Spryker', 'commerce', TRUE, FALSE, 'Spryker', 75),

  -- MarTech Galaxy (Partners)
  ('Salesforce Marketing Cloud', 'SFMC', 'martech', TRUE, FALSE, 'Salesforce', 100),
  ('ExactTarget', 'SFMC', 'martech', TRUE, FALSE, 'Salesforce', 100),
  ('Marketo', 'Marketo', 'martech', TRUE, FALSE, 'Adobe', 95),
  ('Adobe Marketo', 'Marketo', 'martech', TRUE, FALSE, 'Adobe', 95),
  ('HubSpot', 'HubSpot', 'martech', TRUE, FALSE, 'HubSpot', 90),
  ('Hubspot', 'HubSpot', 'martech', TRUE, FALSE, 'HubSpot', 90),
  ('Klaviyo', 'Klaviyo', 'martech', TRUE, FALSE, 'Klaviyo', 85),

  -- Search Galaxy (COMPETITORS - displacement targets)
  ('Elasticsearch', 'Elastic', 'search', FALSE, TRUE, NULL, 100),
  ('Elastic', 'Elastic', 'search', FALSE, TRUE, NULL, 100),
  ('ElasticSearch', 'Elastic', 'search', FALSE, TRUE, NULL, 100),
  ('Apache Solr', 'Solr', 'search', FALSE, TRUE, NULL, 95),
  ('Solr', 'Solr', 'search', FALSE, TRUE, NULL, 95),
  ('Coveo', 'Coveo', 'search', FALSE, TRUE, NULL, 90),
  ('Bloomreach', 'Bloomreach', 'search', FALSE, TRUE, NULL, 85),
  ('SearchSpring', 'SearchSpring', 'search', FALSE, TRUE, NULL, 80),
  ('Searchspring', 'SearchSpring', 'search', FALSE, TRUE, NULL, 80),
  ('Lucidworks', 'Lucidworks', 'search', FALSE, TRUE, NULL, 75),
  ('Klevu', 'Klevu', 'search', FALSE, TRUE, NULL, 70),
  ('Constructor', 'Constructor', 'search', FALSE, TRUE, NULL, 65),
  ('Constructor.io', 'Constructor', 'search', FALSE, TRUE, NULL, 65),
  ('Swiftype', 'Swiftype', 'search', FALSE, TRUE, NULL, 60),
  ('Doofinder', 'Doofinder', 'search', FALSE, TRUE, NULL, 55),
  ('Yext', 'Yext', 'search', FALSE, TRUE, NULL, 50),

  -- Cloud Galaxy (Partners - NO GCP, it's a competitor)
  ('Amazon CloudFront', 'AWS', 'cloud', TRUE, FALSE, 'AWS', 100),
  ('Amazon-CloudFront', 'AWS', 'cloud', TRUE, FALSE, 'AWS', 100),
  ('Amazon S3', 'AWS', 'cloud', TRUE, FALSE, 'AWS', 100),
  ('Amazon-S3', 'AWS', 'cloud', TRUE, FALSE, 'AWS', 100),
  ('Amazon Web Services', 'AWS', 'cloud', TRUE, FALSE, 'AWS', 100),
  ('Microsoft Azure', 'Azure', 'cloud', TRUE, FALSE, 'Microsoft', 95),
  ('Microsoft-Azure', 'Azure', 'cloud', TRUE, FALSE, 'Microsoft', 95),
  ('Azure CDN', 'Azure', 'cloud', TRUE, FALSE, 'Microsoft', 95)
ON CONFLICT (builtwith_name) DO UPDATE SET
  our_name = EXCLUDED.our_name,
  galaxy = EXCLUDED.galaxy,
  is_partner = EXCLUDED.is_partner,
  is_competitor = EXCLUDED.is_competitor,
  partner_name = EXCLUDED.partner_name,
  priority = EXCLUDED.priority;

-- ============================================================================
-- 5. RAW API RESPONSES (for debugging/reprocessing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS builtwith_raw (
  domain VARCHAR(255) PRIMARY KEY,
  api_response JSONB NOT NULL,
  api_version VARCHAR(10) DEFAULT 'v21',
  fetched_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE builtwith_raw IS 'Raw BuiltWith API responses for debugging and reprocessing';

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- View: Company with aggregated tech arrays per galaxy
CREATE OR REPLACE VIEW company_tech_summary AS
SELECT
  c.domain,
  c.company_name,
  c.country,
  c.vertical,
  c.monthly_tech_spend,
  c.sales_revenue_band,
  c.linkedin_url,
  c.email,
  ARRAY_AGG(DISTINCT ct.our_tech_name) FILTER (WHERE ct.galaxy = 'cms') AS cms_techs,
  ARRAY_AGG(DISTINCT ct.our_tech_name) FILTER (WHERE ct.galaxy = 'commerce') AS commerce_techs,
  ARRAY_AGG(DISTINCT ct.our_tech_name) FILTER (WHERE ct.galaxy = 'martech') AS martech_techs,
  ARRAY_AGG(DISTINCT ct.our_tech_name) FILTER (WHERE ct.galaxy = 'search') AS search_techs,
  ARRAY_AGG(DISTINCT ct.our_tech_name) FILTER (WHERE ct.galaxy = 'cloud') AS cloud_techs,
  COUNT(DISTINCT ct.tech_name) AS total_techs
FROM companies c
LEFT JOIN company_technologies ct ON c.domain = ct.domain AND ct.is_current = TRUE
GROUP BY c.domain, c.company_name, c.country, c.vertical, c.monthly_tech_spend, c.sales_revenue_band, c.linkedin_url, c.email;

-- View: Recent tech adoptions (last 90 days)
CREATE OR REPLACE VIEW recent_tech_adoptions AS
SELECT
  ct.domain,
  c.company_name,
  ct.tech_name,
  ct.our_tech_name,
  ct.galaxy,
  ct.first_detected,
  c.monthly_tech_spend,
  c.sales_revenue_band
FROM company_technologies ct
JOIN companies c ON ct.domain = c.domain
WHERE ct.first_detected > NOW() - INTERVAL '90 days'
  AND ct.is_current = TRUE
ORDER BY ct.first_detected DESC;

-- View: Companies by spend tier
CREATE OR REPLACE VIEW companies_by_spend_tier AS
SELECT
  domain,
  company_name,
  monthly_tech_spend,
  CASE
    WHEN monthly_tech_spend >= 50000 THEN 'Enterprise ($50K+/mo)'
    WHEN monthly_tech_spend >= 10000 THEN 'Mid-Market ($10K-50K/mo)'
    WHEN monthly_tech_spend >= 1000 THEN 'SMB ($1K-10K/mo)'
    ELSE 'Startup (<$1K/mo)'
  END AS spend_tier,
  sales_revenue_band,
  vertical,
  tech_cohort,
  sales_play
FROM companies
WHERE monthly_tech_spend IS NOT NULL
ORDER BY monthly_tech_spend DESC;

-- ============================================================================
-- 7. FUNCTION: Recalculate tech_cohort and sales_play
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_company_cohort(p_domain VARCHAR)
RETURNS VOID AS $$
DECLARE
  v_has_cms BOOLEAN;
  v_has_commerce BOOLEAN;
  v_has_martech BOOLEAN;
  v_has_search_competitor BOOLEAN;
  v_tech_cohort VARCHAR(20);
  v_sales_play VARCHAR(20);
BEGIN
  SELECT
    EXISTS(SELECT 1 FROM company_technologies WHERE domain = p_domain AND galaxy = 'cms' AND is_current = TRUE),
    EXISTS(SELECT 1 FROM company_technologies WHERE domain = p_domain AND galaxy = 'commerce' AND is_current = TRUE),
    EXISTS(SELECT 1 FROM company_technologies WHERE domain = p_domain AND galaxy = 'martech' AND is_current = TRUE),
    EXISTS(SELECT 1 FROM company_technologies WHERE domain = p_domain AND galaxy = 'search' AND is_current = TRUE)
  INTO v_has_cms, v_has_commerce, v_has_martech, v_has_search_competitor;

  -- Tech Cohort
  IF v_has_cms AND v_has_commerce AND (v_has_martech OR v_has_search_competitor) THEN
    v_tech_cohort := 'JACKPOT';
  ELSIF v_has_cms AND v_has_commerce THEN
    v_tech_cohort := 'HIGH';
  ELSIF v_has_commerce THEN
    v_tech_cohort := 'MEDIUM';
  ELSE
    v_tech_cohort := 'BASE';
  END IF;

  -- Sales Play
  IF v_has_search_competitor THEN
    v_sales_play := 'DISPLACEMENT';
  ELSE
    v_sales_play := 'GREENFIELD';
  END IF;

  UPDATE companies
  SET tech_cohort = v_tech_cohort, sales_play = v_sales_play, updated_at = NOW()
  WHERE domain = p_domain;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. TRIGGER: Auto-update cohort when technologies change
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_recalculate_cohort()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_company_cohort(OLD.domain);
    RETURN OLD;
  ELSE
    PERFORM recalculate_company_cohort(NEW.domain);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tech_change ON company_technologies;
CREATE TRIGGER trg_tech_change
AFTER INSERT OR UPDATE OR DELETE ON company_technologies
FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_cohort();

-- ============================================================================
-- TABLE COMMENTS SUMMARY
-- ============================================================================
COMMENT ON TABLE companies IS 'Layer 0: All company data - firmographics, contacts, socials, spend, rankings';
COMMENT ON TABLE company_technologies IS 'All technologies per company with first/last detected dates (50-200 per company)';
COMMENT ON TABLE company_relationships IS 'Parent/child/subsidiary relationships (LVMH → Louis Vuitton, Dior, etc.)';
COMMENT ON TABLE technologies IS 'Reference table: BuiltWith name → our classification (galaxy, partner, competitor)';
COMMENT ON TABLE builtwith_raw IS 'Raw API responses for debugging and reprocessing';
