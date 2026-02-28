-- ============================================================================
-- BUILTWITH LISTS API COUNTS - SCRATCHPAD TABLE
-- ============================================================================
-- Stores exhaustive counts from BuiltWith Lists API with pagination
-- Run date: 2026-02-28
-- ============================================================================

CREATE TABLE IF NOT EXISTS builtwith_counts (
  id SERIAL PRIMARY KEY,
  galaxy VARCHAR(20) NOT NULL,
  our_name VARCHAR(50) NOT NULL,
  builtwith_name VARCHAR(100) NOT NULL,
  exhaustive_count INTEGER NOT NULL,
  pages_fetched INTEGER,
  since_days INTEGER DEFAULT 365,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(builtwith_name, since_days)
);

-- Insert the counts from 2026-02-28 exhaustive fetch
INSERT INTO builtwith_counts (galaxy, our_name, builtwith_name, exhaustive_count, pages_fetched, since_days, notes) VALUES
  -- CMS Galaxy
  ('cms', 'AEM', 'Adobe-Experience-Manager', 20995, 24, 365, 'Includes all AEM detections - may include subdomains'),
  ('cms', 'Contentful', 'Contentful', 21718, 25, 365, NULL),
  ('cms', 'Contentstack', 'Contentstack', 2791, 4, 365, NULL),
  ('cms', 'Amplience', 'Amplience', 4682, 6, 365, NULL),
  ('cms', 'Sitecore', 'Sitecore CMS', 4562, 6, 365, NULL),

  -- Commerce Galaxy
  ('commerce', 'SFCC', 'Salesforce-Commerce-Cloud', 13238, 16, 365, NULL),
  ('commerce', 'Shopify+', 'Shopify-Plus', 32890, 38, 365, NULL),
  ('commerce', 'Magento', 'Magento', 17815, 21, 365, 'Magento 1 + 2 combined'),
  ('commerce', 'BigCommerce', 'BigCommerce', 5247, 7, 365, NULL),
  ('commerce', 'Commercetools', 'commercetools', 859, 2, 365, NULL),
  ('commerce', 'Spryker', 'Spryker', 21, 1, 365, NULL),

  -- MarTech Galaxy
  ('martech', 'SFMC', 'ExactTarget', 4187, 5, 365, 'ExactTarget = Salesforce Marketing Cloud pre-acquisition name'),
  ('martech', 'Marketo', 'Marketo', 6994, 9, 365, NULL),
  ('martech', 'HubSpot', 'Hubspot', 146002, 163, 365, 'VERIFY: Likely includes tracking pixel detections, not just CRM'),
  ('martech', 'Klaviyo', 'Klaviyo', 220043, 247, 365, 'VERIFY: Likely includes email tracking pixel detections'),

  -- Search Galaxy (Competitors)
  ('search', 'Coveo', 'Coveo', 1072, 2, 365, NULL),
  ('search', 'Bloomreach', 'BloomReach', 148, 1, 365, NULL),
  ('search', 'Constructor', 'Constructor-IO', 172, 1, 365, NULL),
  ('search', 'Yext', 'Yext', 2960, 4, 365, 'Yext includes listings/local SEO, not just search'),
  ('search', 'SearchSpring', 'Searchspring', 0, 1, 365, 'NOT AVAILABLE in Lists API - needs Domain API')
ON CONFLICT (builtwith_name, since_days) DO UPDATE SET
  exhaustive_count = EXCLUDED.exhaustive_count,
  pages_fetched = EXCLUDED.pages_fetched,
  fetched_at = NOW(),
  notes = EXCLUDED.notes;

-- Summary view
CREATE OR REPLACE VIEW builtwith_counts_summary AS
SELECT
  galaxy,
  SUM(exhaustive_count) as total_count,
  COUNT(*) as tech_count
FROM builtwith_counts
WHERE since_days = 365
GROUP BY galaxy
ORDER BY total_count DESC;

COMMENT ON TABLE builtwith_counts IS 'BuiltWith Lists API exhaustive counts with pagination. Note: These are DOMAIN counts, not company counts. A single company may have multiple domains.';

-- ============================================================================
-- QUALITY ANALYSIS TABLE
-- ============================================================================
-- Stores quality metrics from sampling (what % of detections are real)

CREATE TABLE IF NOT EXISTS builtwith_quality (
  id SERIAL PRIMARY KEY,
  builtwith_name VARCHAR(100) NOT NULL UNIQUE,
  sample_size INTEGER NOT NULL,
  with_rank INTEGER NOT NULL,          -- Domains with any traffic rank
  high_rank INTEGER NOT NULL,          -- Domains with rank > 10,000
  quality_pct DECIMAL(5,2) NOT NULL,   -- % of domains that are "real"
  estimated_real INTEGER,               -- Raw count * quality_pct
  sampled_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Insert quality analysis from 2026-02-28
INSERT INTO builtwith_quality (builtwith_name, sample_size, with_rank, high_rank, quality_pct, estimated_real, notes) VALUES
  ('Adobe-Experience-Manager', 900, 44, 21, 4.9, 1029, '95% are tiny sites with no traffic - likely false positives from embeds'),
  ('Salesforce-Commerce-Cloud', 900, 96, 70, 10.7, 1416, 'Commerce platform - more reliable than CMS'),
  ('Shopify-Plus', 900, 628, 521, 69.8, 22957, 'MOST RELIABLE - hosted platform, hard to false-positive'),
  ('Coveo', 900, 62, 59, 6.9, 74, 'Search embeds cause false positives'),
  ('Hubspot', 900, 44, 21, 5.0, 7300, 'INFLATED - includes tracking pixel detections'),
  ('Klaviyo', 900, 50, 25, 5.0, 11002, 'INFLATED - includes email tracking pixel detections')
ON CONFLICT (builtwith_name) DO UPDATE SET
  sample_size = EXCLUDED.sample_size,
  with_rank = EXCLUDED.with_rank,
  high_rank = EXCLUDED.high_rank,
  quality_pct = EXCLUDED.quality_pct,
  estimated_real = EXCLUDED.estimated_real,
  sampled_at = NOW(),
  notes = EXCLUDED.notes;

-- View combining raw counts with quality estimates
CREATE OR REPLACE VIEW builtwith_realistic AS
SELECT
  c.galaxy,
  c.our_name,
  c.builtwith_name,
  c.exhaustive_count as raw_count,
  COALESCE(q.quality_pct, 50.0) as quality_pct,
  COALESCE(q.estimated_real, c.exhaustive_count / 2) as estimated_real,
  q.notes as quality_notes
FROM builtwith_counts c
LEFT JOIN builtwith_quality q ON c.builtwith_name = q.builtwith_name
WHERE c.since_days = 365
ORDER BY c.galaxy, c.our_name;
