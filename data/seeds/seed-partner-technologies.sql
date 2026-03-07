-- Seed: Partner Technologies (PARTNER INTELLIGENCE FEATURE ONLY)
-- Description: 15 partner technologies (Commerce, CMS, MarTech)
-- Purpose: For Partner Intelligence feature (displacement opportunities)
-- NOT used by Search Audit feature (Search Audit gets tech stack from BuiltWith dynamically)
-- Author: Dashboard Builder Team
-- Date: 2026-03-06

-- =============================================================================
-- COMMERCE PLATFORMS (6)
-- =============================================================================
INSERT INTO partner_technologies (name, category, vendor, is_active_partner, partnership_tier, notes) VALUES
  ('Shopify Plus', 'commerce', 'Shopify', true, 'platinum', 'Top enterprise e-commerce platform'),
  ('Adobe Commerce (Magento)', 'commerce', 'Adobe', true, 'platinum', 'Enterprise e-commerce solution'),
  ('Salesforce Commerce Cloud', 'commerce', 'Salesforce', true, 'gold', 'Cloud-based e-commerce platform'),
  ('BigCommerce', 'commerce', 'BigCommerce', true, 'gold', 'SaaS e-commerce platform'),
  ('commercetools', 'commerce', 'commercetools', true, 'silver', 'Headless commerce platform'),
  ('Spryker', 'commerce', 'Spryker Systems', true, 'silver', 'Enterprise commerce OS')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- CMS PLATFORMS (5)
-- =============================================================================
INSERT INTO partner_technologies (name, category, vendor, is_active_partner, partnership_tier, notes) VALUES
  ('Adobe Experience Manager (AEM)', 'cms', 'Adobe', true, 'platinum', 'Enterprise content management'),
  ('Contentful', 'cms', 'Contentful', true, 'gold', 'Headless CMS'),
  ('Contentstack', 'cms', 'Contentstack', true, 'gold', 'Headless CMS platform'),
  ('Amplience', 'cms', 'Amplience', true, 'silver', 'Headless CMS for commerce'),
  ('Sitecore', 'cms', 'Sitecore', true, 'gold', 'Digital experience platform')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- MARTECH PLATFORMS (4)
-- =============================================================================
INSERT INTO partner_technologies (name, category, vendor, is_active_partner, partnership_tier, notes) VALUES
  ('Salesforce Marketing Cloud', 'martech', 'Salesforce', true, 'gold', 'Marketing automation platform'),
  ('Marketo', 'martech', 'Adobe', true, 'gold', 'Marketing automation'),
  ('HubSpot', 'martech', 'HubSpot', true, 'silver', 'Inbound marketing platform'),
  ('Klaviyo', 'martech', 'Klaviyo', true, 'silver', 'E-commerce marketing automation')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Total: 15 partner technologies
-- Commerce: 6 (Shopify Plus, Magento, SFCC, BigCommerce, commercetools, Spryker)
-- CMS: 5 (AEM, Contentful, Contentstack, Amplience, Sitecore)
-- MarTech: 4 (SFMC, Marketo, HubSpot, Klaviyo)
