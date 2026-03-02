-- =====================================================================
-- SEED TECHNOLOGIES TABLE
-- =====================================================================
-- Initial technology list for partner displacement targeting
--
-- Categories:
--   - cms: Content Management Systems
--   - commerce: E-commerce Platforms
--   - martech: Marketing Automation
--   - search: Search Providers (competitors)
--   - cloud: Cloud Infrastructure
-- =====================================================================

-- Clear existing data
TRUNCATE technologies;

-- =====================================================================
-- CMS TECHNOLOGIES
-- =====================================================================

INSERT INTO technologies (slug, name, builtwith_name, category, priority, notes) VALUES
  ('aem', 'Adobe Experience Manager', 'Adobe-Experience-Manager', 'cms', 90, 'Enterprise CMS - high displacement potential'),
  ('contentful', 'Contentful', 'Contentful', 'cms', 85, 'Headless CMS - growing market'),
  ('contentstack', 'Contentstack', 'Contentstack', 'cms', 80, 'Headless CMS - API-first'),
  ('amplience', 'Amplience', 'Amplience', 'cms', 75, 'Content platform for commerce'),
  ('sitecore', 'Sitecore CMS', 'Sitecore CMS', 'cms', 70, 'Enterprise CMS');

-- =====================================================================
-- COMMERCE TECHNOLOGIES
-- =====================================================================

INSERT INTO technologies (slug, name, builtwith_name, category, priority, notes) VALUES
  ('shopify-plus', 'Shopify Plus', 'Shopify Plus', 'commerce', 95, 'Enterprise Shopify - primary target'),
  ('magento', 'Magento / Adobe Commerce', 'Magento', 'commerce', 90, 'Open source + enterprise'),
  ('sfcc', 'Salesforce Commerce Cloud', 'Salesforce Commerce Cloud', 'commerce', 85, 'Enterprise B2C/B2B commerce'),
  ('bigcommerce', 'BigCommerce', 'BigCommerce', 'commerce', 80, 'Mid-market to enterprise'),
  ('commercetools', 'commercetools', 'Commercetools', 'commerce', 75, 'Headless commerce platform'),
  ('spryker', 'Spryker', 'Spryker', 'commerce', 70, 'B2B/complex commerce');

-- =====================================================================
-- MARTECH TECHNOLOGIES
-- =====================================================================

INSERT INTO technologies (slug, name, builtwith_name, category, priority, notes) VALUES
  ('sfmc', 'Salesforce Marketing Cloud', 'Salesforce Marketing Cloud', 'martech', 85, 'Enterprise marketing automation'),
  ('marketo', 'Marketo', 'Marketo', 'martech', 80, 'Marketing automation platform'),
  ('hubspot', 'HubSpot', 'HubSpot', 'martech', 75, 'Inbound marketing + CRM'),
  ('klaviyo', 'Klaviyo', 'Klaviyo', 'martech', 70, 'E-commerce marketing automation');

-- =====================================================================
-- SEARCH & CLOUD - NOT QUERIED VIA LISTS API
-- =====================================================================
-- Search competitors (Coveo, Bloomreach, etc.) and cloud providers (AWS, Azure)
-- will be detected via Domain API enrichment, NOT via Lists API queries.
-- We do NOT want to find all customers of search competitors or cloud providers.
-- =====================================================================

-- Show what we seeded
SELECT
  category,
  COUNT(*) as count,
  STRING_AGG(name, ', ' ORDER BY priority DESC) as technologies
FROM technologies
WHERE is_active = true
GROUP BY category
ORDER BY
  CASE category
    WHEN 'commerce' THEN 1
    WHEN 'cms' THEN 2
    WHEN 'martech' THEN 3
    WHEN 'search' THEN 4
    WHEN 'cloud' THEN 5
  END;
