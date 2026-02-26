-- PartnerForge: Fix RLS and Seed Data
-- =============================================================================

-- Disable RLS on our new tables (they have it enabled somehow)
ALTER TABLE IF EXISTS partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verticals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_partners DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies on our tables
DROP POLICY IF EXISTS "Allow authenticated read" ON partners;
DROP POLICY IF EXISTS "Allow authenticated read" ON verticals;
DROP POLICY IF EXISTS "Allow authenticated read" ON companies;
DROP POLICY IF EXISTS "Allow authenticated read" ON company_partners;
DROP POLICY IF EXISTS "Allow public read" ON partners;
DROP POLICY IF EXISTS "Allow public read" ON verticals;
DROP POLICY IF EXISTS "Allow public read" ON companies;
DROP POLICY IF EXISTS "Allow public read" ON company_partners;

-- Seed partners data
INSERT INTO partners (name, builtwith_name, category, tier) VALUES
  ('Adobe Experience Manager', 'Adobe Experience Manager', 'CMS', 1),
  ('Adobe Commerce', 'Adobe Commerce', 'Ecommerce', 1),
  ('Amplience', 'Amplience', 'CMS', 1),
  ('Spryker', 'Spryker', 'Ecommerce', 1),
  ('Shopify', 'Shopify', 'Ecommerce', 1),
  ('Salesforce Commerce Cloud', 'Salesforce Commerce Cloud', 'Ecommerce', 1),
  ('SAP Commerce Cloud', 'SAP Commerce Cloud', 'Ecommerce', 1),
  ('Commercetools', 'commercetools', 'Ecommerce', 2),
  ('BigCommerce', 'BigCommerce', 'Ecommerce', 2)
ON CONFLICT (name) DO NOTHING;

-- Seed verticals data
INSERT INTO verticals (name, icp_weight) VALUES
  ('Commerce', 40),
  ('Retail', 40),
  ('Automotive And Vehicles', 35),
  ('Finance', 35),
  ('Media And Entertainment', 30),
  ('Technology', 30),
  ('Healthcare', 25),
  ('Travel And Tourism', 25),
  ('Manufacturing', 20),
  ('Other', 10)
ON CONFLICT (name) DO NOTHING;

-- Migrate data from displacement_targets to companies
INSERT INTO companies (
  domain, name, vertical_raw, revenue,
  hq_country, hq_city, hq_state, is_public, ticker,
  icp_score, icp_tier, icp_tier_name,
  sw_monthly_visits, sw_bounce_rate, sw_pages_per_visit, sw_avg_duration, sw_rank_global,
  traffic_growth, tech_spend, current_search, tech_stack_json,
  exec_quote, exec_name, exec_title, quote_source, trigger_events,
  displacement_angle, competitors_using_algolia, financials_json, hiring_signals,
  enrichment_level, last_enriched, created_at
)
SELECT
  domain,
  company_name,
  vertical,
  revenue,
  country,
  city,
  state,
  is_public,
  ticker,
  icp_score,
  icp_tier,
  icp_tier_name,
  sw_monthly_visits,
  sw_bounce_rate,
  sw_pages_per_visit,
  sw_avg_duration,
  sw_rank_global,
  traffic_growth,
  tech_spend,
  current_search,
  CASE WHEN tech_stack_json IS NOT NULL AND tech_stack_json != ''
       THEN tech_stack_json::jsonb
       ELSE NULL END,
  exec_quote,
  exec_name,
  exec_title,
  quote_source,
  CASE WHEN trigger_events IS NOT NULL AND trigger_events != ''
       THEN trigger_events::jsonb
       ELSE NULL END,
  displacement_angle,
  competitors_using_algolia,
  CASE WHEN financials_json IS NOT NULL AND financials_json != ''
       THEN financials_json::jsonb
       ELSE NULL END,
  CASE WHEN hiring_signals IS NOT NULL AND hiring_signals != ''
       THEN hiring_signals::jsonb
       ELSE NULL END,
  enrichment_level,
  last_enriched,
  created_at
FROM displacement_targets
ON CONFLICT (domain) DO NOTHING;

-- Update vertical_id based on vertical_raw
UPDATE companies c
SET vertical_id = v.id
FROM verticals v
WHERE c.vertical_raw ILIKE '%' || v.name || '%'
   OR c.vertical_raw = v.name;

-- Create company_partners relationships
INSERT INTO company_partners (company_id, partner_id, source)
SELECT c.id, p.id, 'builtwith'
FROM companies c
JOIN displacement_targets dt ON c.domain = dt.domain
JOIN partners p ON dt.partner_tech = p.name OR dt.partner_tech = p.builtwith_name
ON CONFLICT (company_id, partner_id) DO NOTHING;

-- Verify migration
SELECT 'Partners' as table_name, count(*) as row_count FROM partners
UNION ALL
SELECT 'Verticals', count(*) FROM verticals
UNION ALL
SELECT 'Companies', count(*) FROM companies
UNION ALL
SELECT 'Company_Partners', count(*) FROM company_partners
UNION ALL
SELECT 'Original (displacement_targets)', count(*) FROM displacement_targets;
