-- =============================================================================
-- Partners and Products Tables
-- =============================================================================
-- These tables should be the SINGLE SOURCE OF TRUTH for partner data.
-- The frontend should fetch from these tables, not use hardcoded values.

-- Partners table
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,        -- e.g., 'adobe', 'salesforce'
  name VARCHAR(100) NOT NULL,              -- e.g., 'Adobe', 'Salesforce'
  short_name VARCHAR(50) NOT NULL,         -- e.g., 'Adobe', 'SFDC'
  logo_url TEXT,                           -- Optional logo URL
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner products table
CREATE TABLE IF NOT EXISTS partner_products (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
  key VARCHAR(50) NOT NULL,                -- e.g., 'aem', 'commerce-cloud'
  name VARCHAR(100) NOT NULL,              -- e.g., 'Experience Manager (AEM)'
  short_name VARCHAR(50) NOT NULL,         -- e.g., 'AEM', 'SFCC'
  builtwith_tech_name VARCHAR(100),        -- BuiltWith detection name
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(partner_id, key)
);

-- =============================================================================
-- Seed Data
-- =============================================================================

-- Insert partners
INSERT INTO partners (key, name, short_name, sort_order) VALUES
  ('adobe', 'Adobe', 'Adobe', 1),
  ('salesforce', 'Salesforce', 'Salesforce', 2),
  ('shopify', 'Shopify', 'Shopify', 3),
  ('commercetools', 'commercetools', 'CT', 4),
  ('bigcommerce', 'BigCommerce', 'BigCommerce', 5),
  ('vtex', 'VTEX', 'VTEX', 6),
  ('amplience', 'Amplience', 'Amplience', 7),
  ('spryker', 'Spryker', 'Spryker', 8)
ON CONFLICT (key) DO NOTHING;

-- Insert products for Adobe
INSERT INTO partner_products (partner_id, key, name, short_name, builtwith_tech_name, sort_order)
SELECT p.id, v.key, v.name, v.short_name, v.builtwith_tech_name, v.sort_order
FROM partners p
CROSS JOIN (VALUES
  ('aem', 'Experience Manager (AEM)', 'AEM', 'Adobe Experience Manager', 1),
  ('commerce', 'Commerce (Magento)', 'Commerce', 'Adobe Commerce', 2),
  ('campaign', 'Campaign', 'Campaign', 'Adobe Campaign', 3),
  ('analytics', 'Analytics', 'Analytics', 'Adobe Analytics', 4),
  ('target', 'Target', 'Target', 'Adobe Target', 5)
) AS v(key, name, short_name, builtwith_tech_name, sort_order)
WHERE p.key = 'adobe'
ON CONFLICT (partner_id, key) DO NOTHING;

-- Insert products for Salesforce
INSERT INTO partner_products (partner_id, key, name, short_name, builtwith_tech_name, sort_order)
SELECT p.id, v.key, v.name, v.short_name, v.builtwith_tech_name, v.sort_order
FROM partners p
CROSS JOIN (VALUES
  ('commerce-cloud', 'Commerce Cloud (SFCC)', 'SFCC', 'Salesforce Commerce Cloud', 1),
  ('marketing-cloud', 'Marketing Cloud', 'Marketing', 'Salesforce Marketing Cloud', 2),
  ('service-cloud', 'Service Cloud', 'Service', 'Salesforce Service Cloud', 3),
  ('experience-cloud', 'Experience Cloud', 'Experience', 'Salesforce Experience Cloud', 4)
) AS v(key, name, short_name, builtwith_tech_name, sort_order)
WHERE p.key = 'salesforce'
ON CONFLICT (partner_id, key) DO NOTHING;

-- Insert products for Shopify
INSERT INTO partner_products (partner_id, key, name, short_name, builtwith_tech_name, sort_order)
SELECT p.id, v.key, v.name, v.short_name, v.builtwith_tech_name, v.sort_order
FROM partners p
CROSS JOIN (VALUES
  ('shopify-plus', 'Shopify Plus', 'Plus', 'Shopify Plus', 1),
  ('shopify', 'Shopify', 'Shopify', 'Shopify', 2)
) AS v(key, name, short_name, builtwith_tech_name, sort_order)
WHERE p.key = 'shopify'
ON CONFLICT (partner_id, key) DO NOTHING;

-- Insert products for single-product partners
INSERT INTO partner_products (partner_id, key, name, short_name, builtwith_tech_name, sort_order)
SELECT p.id, p.key, p.name, p.short_name, p.name, 1
FROM partners p
WHERE p.key IN ('commercetools', 'bigcommerce', 'vtex', 'amplience', 'spryker')
ON CONFLICT (partner_id, key) DO NOTHING;

-- =============================================================================
-- Indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(is_active);
CREATE INDEX IF NOT EXISTS idx_partner_products_partner_id ON partner_products(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_products_active ON partner_products(is_active);

-- =============================================================================
-- View: Partners with product counts and target counts
-- =============================================================================

CREATE OR REPLACE VIEW partner_summary AS
SELECT
  p.id,
  p.key,
  p.name,
  p.short_name,
  p.is_active,
  p.sort_order,
  COUNT(DISTINCT pp.id) as product_count,
  COALESCE(tc.target_count, 0) as target_count
FROM partners p
LEFT JOIN partner_products pp ON pp.partner_id = p.id AND pp.is_active = true
LEFT JOIN (
  SELECT
    CASE
      WHEN partner_tech ILIKE '%adobe%' THEN 'adobe'
      WHEN partner_tech ILIKE '%salesforce%' THEN 'salesforce'
      WHEN partner_tech ILIKE '%shopify%' THEN 'shopify'
      WHEN partner_tech ILIKE '%commercetools%' THEN 'commercetools'
      WHEN partner_tech ILIKE '%bigcommerce%' THEN 'bigcommerce'
      WHEN partner_tech ILIKE '%vtex%' THEN 'vtex'
      WHEN partner_tech ILIKE '%amplience%' THEN 'amplience'
      WHEN partner_tech ILIKE '%spryker%' THEN 'spryker'
      ELSE 'other'
    END as partner_key,
    COUNT(*) as target_count
  FROM displacement_targets
  WHERE partner_tech IS NOT NULL
  GROUP BY 1
) tc ON tc.partner_key = p.key
WHERE p.is_active = true
GROUP BY p.id, p.key, p.name, p.short_name, p.is_active, p.sort_order, tc.target_count
ORDER BY p.sort_order;
