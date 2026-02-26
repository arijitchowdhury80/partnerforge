-- PartnerForge Normalized Schema Migration
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. PARTNERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  builtwith_name TEXT,
  category TEXT NOT NULL DEFAULT 'CMS',
  tier INT DEFAULT 1,
  logo_url TEXT,
  our_contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert known partners
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

-- 2. VERTICALS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS verticals (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  icp_weight INT DEFAULT 30,
  case_study_ids INT[]
);

-- Insert verticals from existing data
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

-- 3. COMPANIES TABLE (Normalized from displacement_targets)
-- =============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  vertical_id INT REFERENCES verticals(id),
  vertical_raw TEXT,  -- Keep original vertical for reference
  revenue_band TEXT,
  revenue NUMERIC,
  employee_count INT,
  hq_country TEXT,
  hq_city TEXT,
  hq_state TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  ticker TEXT,
  is_algolia_customer BOOLEAN DEFAULT FALSE,

  -- ICP Scoring
  icp_score INT,
  icp_tier INT,
  icp_tier_name TEXT,

  -- Traffic data
  sw_monthly_visits BIGINT,
  sw_bounce_rate NUMERIC,
  sw_pages_per_visit NUMERIC,
  sw_avg_duration INT,
  sw_rank_global INT,
  traffic_growth NUMERIC,

  -- Tech
  tech_spend INT,
  current_search TEXT,
  tech_stack_json JSONB,

  -- Intelligence
  exec_quote TEXT,
  exec_name TEXT,
  exec_title TEXT,
  quote_source TEXT,
  trigger_events JSONB,
  displacement_angle TEXT,
  competitors_using_algolia TEXT,
  financials_json JSONB,
  hiring_signals JSONB,

  -- Enrichment tracking
  enrichment_level TEXT DEFAULT 'basic',
  last_enriched TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_companies_icp_score ON companies(icp_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_vertical ON companies(vertical_id);

-- 4. COMPANY_PARTNERS (Many-to-Many Junction)
-- =============================================================================
CREATE TABLE IF NOT EXISTS company_partners (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  partner_id INT REFERENCES partners(id) ON DELETE CASCADE,
  first_detected TIMESTAMPTZ DEFAULT NOW(),
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  tenure_months INT,
  confidence NUMERIC(3,2) DEFAULT 0.95,
  source TEXT DEFAULT 'builtwith',
  UNIQUE(company_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_company_partners_company ON company_partners(company_id);
CREATE INDEX IF NOT EXISTS idx_company_partners_partner ON company_partners(partner_id);

-- 5. MIGRATE DATA FROM FLAT TABLE
-- =============================================================================

-- First, insert all companies from displacement_targets
INSERT INTO companies (
  domain, name, vertical_raw, revenue, employee_count,
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
  NULL, -- employee_count not in flat table
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

-- Now create company_partners relationships
INSERT INTO company_partners (company_id, partner_id, source)
SELECT c.id, p.id, 'builtwith'
FROM companies c
JOIN displacement_targets dt ON c.domain = dt.domain
JOIN partners p ON dt.partner_tech = p.name OR dt.partner_tech = p.builtwith_name
ON CONFLICT (company_id, partner_id) DO NOTHING;

-- 6. CREATE VIEW FOR BACKWARD COMPATIBILITY
-- =============================================================================
CREATE OR REPLACE VIEW displacement_targets_v2 AS
SELECT
  c.id,
  c.domain,
  c.name as company_name,
  p.name as partner_tech,
  c.vertical_raw as vertical,
  c.hq_country as country,
  c.hq_city as city,
  c.hq_state as state,
  c.icp_score,
  c.icp_tier,
  c.icp_tier_name,
  c.sw_monthly_visits,
  c.revenue,
  c.is_public,
  c.ticker,
  c.current_search,
  c.enrichment_level,
  c.last_enriched,
  c.exec_quote,
  c.exec_name,
  c.exec_title,
  c.displacement_angle,
  c.competitors_using_algolia,
  c.created_at
FROM companies c
LEFT JOIN company_partners cp ON c.id = cp.company_id
LEFT JOIN partners p ON cp.partner_id = p.id;

-- 7. ENABLE ROW LEVEL SECURITY (Optional)
-- =============================================================================
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE company_partners ENABLE ROW LEVEL SECURITY;

-- Public read access policies
-- CREATE POLICY "Allow public read" ON companies FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON partners FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON company_partners FOR SELECT USING (true);

-- 8. VERIFY MIGRATION
-- =============================================================================
SELECT 'Partners' as table_name, count(*) as row_count FROM partners
UNION ALL
SELECT 'Companies', count(*) FROM companies
UNION ALL
SELECT 'Company_Partners', count(*) FROM company_partners
UNION ALL
SELECT 'Original (displacement_targets)', count(*) FROM displacement_targets;
