-- ============================================================================
-- CLEANUP LEGACY TABLES + SEED TECHNOLOGIES
-- ============================================================================
-- Run this AFTER 20260228_comprehensive_builtwith_schema.sql
--
-- This migration:
-- 1. Drops 8 legacy v1 tables (all empty)
-- 2. Seeds the technologies reference table
-- 3. Keeps ICP tables that have data
-- ============================================================================

-- ============================================================================
-- 1. DROP LEGACY TABLES
-- ============================================================================
-- All these tables are empty (0 rows) and from v1 architecture

DROP TABLE IF EXISTS targets CASCADE;
DROP TABLE IF EXISTS target_technologies CASCADE;
DROP TABLE IF EXISTS enrichment_cache CASCADE;
DROP TABLE IF EXISTS upload_batches CASCADE;
DROP TABLE IF EXISTS partner_targets CASCADE;
DROP TABLE IF EXISTS displacement_targets CASCADE;
DROP TABLE IF EXISTS tech_stack CASCADE;
DROP TABLE IF EXISTS company_intel CASCADE;

-- ============================================================================
-- 2. SEED TECHNOLOGIES REFERENCE TABLE
-- ============================================================================
-- This should have been in the previous migration but may not have run

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
-- 3. VERIFY CLEANUP
-- ============================================================================
-- Run these queries to verify:

-- Check legacy tables are gone:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('targets', 'target_technologies', 'enrichment_cache', 'upload_batches', 'partner_targets', 'displacement_targets', 'tech_stack', 'company_intel');
-- Should return 0 rows

-- Check technologies seeded:
-- SELECT COUNT(*) FROM technologies;
-- Should return 48

-- Check ICP tables preserved:
-- SELECT 'icp_quotes' as table_name, COUNT(*) as rows FROM icp_quotes
-- UNION ALL SELECT 'icp_personas', COUNT(*) FROM icp_personas;
-- Should show icp_quotes: 333, icp_personas: 4

-- ============================================================================
-- 4. FINAL SCHEMA SUMMARY
-- ============================================================================
-- After this migration, your database should have:
--
-- CORE TABLES (9):
--   companies              - Layer 0: All 14,307 companies
--   company_technologies   - All techs per company (to be populated)
--   company_relationships  - Parent/child relationships (to be populated)
--   technologies           - Reference: 48 known tech → galaxy mappings
--   builtwith_raw          - Raw API responses (to be populated)
--   whale_composite        - Layer 2: Demandbase + ZoomInfo
--   crossbeam_overlaps     - Layer 3: Partner CRM overlaps (489 rows)
--   industries             - Industry taxonomy (30 rows)
--   tech_options           - Dropdown values (26 rows)
--
-- ICP TABLES (6):
--   icp_customers          - Customer evidence
--   icp_case_studies       - Case studies
--   icp_quotes             - Customer quotes (333 rows)
--   icp_metrics            - Success metrics
--   icp_advocates          - Customer advocates
--   icp_personas           - Buyer personas (4 rows)
--
-- VIEWS (3):
--   company_tech_summary   - Aggregated tech arrays per galaxy
--   recent_tech_adoptions  - Techs adopted in last 90 days
--   companies_by_spend_tier - Companies grouped by tech spend
--
-- FUNCTIONS (2):
--   recalculate_company_cohort() - Recalculates tech_cohort and sales_play
--   trigger_recalculate_cohort() - Trigger function for auto-update
--
-- TRIGGERS (1):
--   trg_tech_change - Auto-updates cohort when technologies change
