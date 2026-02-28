-- ============================================================================
-- ICP Evidence Tables - Customer Evidence for Algolia ICP
-- Migrated from Customer Evidence Excel (4 tabs: Logos, Quotes, Stories, Proofpoints)
-- ============================================================================

-- 1. ICP Industries (normalized industry catalog)
CREATE TABLE IF NOT EXISTS icp_industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  color TEXT DEFAULT '#64748b',
  confidence TEXT CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')) DEFAULT 'MEDIUM',
  proof_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ICP Features (Algolia product features)
CREATE TABLE IF NOT EXISTS icp_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ICP Companies (main company records)
CREATE TABLE IF NOT EXISTS icp_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  domain TEXT,
  story_url TEXT,                    -- Link to algolia.com/customers/{slug}
  story_url_fr TEXT,                 -- French version
  story_url_de TEXT,                 -- German version
  industry_id UUID REFERENCES icp_industries(id),
  industry_raw TEXT,                 -- Original industry from Excel
  use_case TEXT,
  country TEXT,
  region TEXT,
  logo_url TEXT,
  is_public_reference BOOLEAN DEFAULT true,
  evidence_tier TEXT CHECK (evidence_tier IN ('GOLD', 'SILVER', 'BRONZE')) DEFAULT 'BRONZE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_name)
);

-- 4. ICP Quotes (customer quotes with attribution)
CREATE TABLE IF NOT EXISTS icp_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES icp_companies(id) ON DELETE CASCADE,
  quote_text TEXT NOT NULL,
  speaker_name TEXT,
  speaker_title TEXT,
  source TEXT,                       -- TechValidate, G2, Customer Interview, etc.
  source_url TEXT,                   -- Link to original source
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ICP Company Features (many-to-many)
CREATE TABLE IF NOT EXISTS icp_company_features (
  company_id UUID REFERENCES icp_companies(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES icp_features(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, feature_id)
);

-- 6. ICP Metrics (case study metrics)
CREATE TABLE IF NOT EXISTS icp_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES icp_companies(id) ON DELETE CASCADE,
  metric_text TEXT NOT NULL,         -- e.g., "26% more time on site"
  metric_value DECIMAL,              -- 26
  metric_unit TEXT,                  -- percent
  metric_category TEXT,              -- conversion, engagement, efficiency
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ICP Proofpoints (additional evidence)
CREATE TABLE IF NOT EXISTS icp_proofpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES icp_companies(id) ON DELETE CASCADE,
  proofpoint_type TEXT NOT NULL,     -- case_study, webinar, video, press
  title TEXT,
  url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_icp_companies_industry ON icp_companies(industry_id);
CREATE INDEX IF NOT EXISTS idx_icp_quotes_company ON icp_quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_icp_metrics_company ON icp_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_icp_proofpoints_company ON icp_proofpoints(company_id);
CREATE INDEX IF NOT EXISTS idx_icp_companies_region ON icp_companies(region);
CREATE INDEX IF NOT EXISTS idx_icp_companies_tier ON icp_companies(evidence_tier);

-- Full-text search on quotes
CREATE INDEX IF NOT EXISTS idx_icp_quotes_text ON icp_quotes USING gin(to_tsvector('english', quote_text));

-- RLS Policies (read-only for anon)
ALTER TABLE icp_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_company_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_proofpoints ENABLE ROW LEVEL SECURITY;

-- Allow anon read access
CREATE POLICY "Allow anon read icp_industries" ON icp_industries FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_features" ON icp_features FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_companies" ON icp_companies FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_quotes" ON icp_quotes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_company_features" ON icp_company_features FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_metrics" ON icp_metrics FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_proofpoints" ON icp_proofpoints FOR SELECT TO anon USING (true);

-- ============================================================================
-- Seed Industry Data (from INDUSTRY_CONFIG)
-- ============================================================================

INSERT INTO icp_industries (name, display_name, color, confidence, proof_points) VALUES
  ('fashion-apparel', 'Fashion/Apparel', '#dc2626', 'HIGH', 53),
  ('grocery-food', 'Grocery/Food', '#16a34a', 'HIGH', 28),
  ('retail-ecommerce', 'Retail E-commerce', '#2563eb', 'HIGH', 41),
  ('b2b-ecommerce', 'B2B E-commerce', '#7c3aed', 'HIGH', 10),
  ('media-publishing', 'Media/Publishing', '#ea580c', 'MEDIUM', 7),
  ('saas', 'SaaS', '#0891b2', 'LOW', 0),
  ('healthcare', 'Healthcare', '#059669', 'MEDIUM', 1),
  ('other', 'Other', '#64748b', 'LOW', 0)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  color = EXCLUDED.color,
  confidence = EXCLUDED.confidence,
  proof_points = EXCLUDED.proof_points;

-- ============================================================================
-- Seed Feature Data
-- ============================================================================

INSERT INTO icp_features (name, display_name, description) VALUES
  ('neuralsearch', 'NeuralSearch', 'AI-powered semantic search'),
  ('personalization', 'Personalization', 'User-based result personalization'),
  ('rules', 'Rules', 'Business rules and merchandising'),
  ('recommend', 'Recommend', 'AI recommendations engine'),
  ('analytics', 'Analytics', 'Search analytics and insights'),
  ('ab-testing', 'A/B Testing', 'Search experiment framework'),
  ('browse', 'Browse', 'Category browsing and navigation'),
  ('autocomplete', 'Autocomplete', 'Instant search suggestions'),
  ('drr', 'DRR', 'Dynamic Re-Ranking')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Summary View for Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW icp_summary AS
SELECT
  (SELECT COUNT(*) FROM icp_companies) as total_companies,
  (SELECT COUNT(*) FROM icp_companies WHERE story_url IS NOT NULL) as with_stories,
  (SELECT COUNT(*) FROM icp_quotes) as total_quotes,
  (SELECT COUNT(DISTINCT company_id) FROM icp_quotes) as companies_with_quotes,
  (SELECT COUNT(*) FROM icp_proofpoints) as total_proofpoints,
  (SELECT COUNT(*) FROM icp_companies WHERE evidence_tier = 'GOLD') as gold_tier,
  (SELECT COUNT(*) FROM icp_companies WHERE evidence_tier = 'SILVER') as silver_tier,
  (SELECT COUNT(*) FROM icp_companies WHERE evidence_tier = 'BRONZE') as bronze_tier;
