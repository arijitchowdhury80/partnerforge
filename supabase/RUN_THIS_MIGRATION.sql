-- ============================================================================
-- ARIAN HIRING SIGNALS MIGRATION
-- Run this entire file in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xbitqeejsgqnwvxlnjra/sql/new
-- ============================================================================

-- ============================================================================
-- PART 1: TARGET JOB PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS target_job_profiles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  normalized_title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
  keywords TEXT[] DEFAULT '{}',
  is_from_customer_evidence BOOLEAN DEFAULT FALSE,
  evidence_count INTEGER DEFAULT 0,
  relevance_score INTEGER DEFAULT 50 CHECK (relevance_score BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(normalized_title)
);

CREATE INDEX IF NOT EXISTS idx_job_profiles_category ON target_job_profiles(category);
CREATE INDEX IF NOT EXISTS idx_job_profiles_tier ON target_job_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_job_profiles_relevance ON target_job_profiles(relevance_score DESC);

ALTER TABLE target_job_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON target_job_profiles;
CREATE POLICY "Allow public read access" ON target_job_profiles FOR SELECT USING (true);

-- ============================================================================
-- PART 2: HIRING SIGNAL COLUMNS ON DISPLACEMENT_TARGETS
-- ============================================================================

ALTER TABLE displacement_targets
ADD COLUMN IF NOT EXISTS hiring_signal_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_signal_strength VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_total_jobs INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_relevant_jobs INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_tier_breakdown JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_category_breakdown JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_top_jobs JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_fetched_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_displacement_hiring_score
ON displacement_targets(hiring_signal_score DESC NULLS LAST);

-- ============================================================================
-- PART 3: SEED DATA - CUSTOMER EVIDENCE (119 roles from 379 quotes)
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, evidence_count, relevance_score, keywords) VALUES
-- C-Suite
('CTO', 'cto', 'c-suite', 1, TRUE, 18, 100, ARRAY['chief technology officer', 'cto']),
('COO', 'coo', 'c-suite', 1, TRUE, 11, 95, ARRAY['chief operating officer', 'coo']),
('CEO', 'ceo', 'c-suite', 1, TRUE, 9, 95, ARRAY['chief executive officer', 'ceo']),
('Co-Founder', 'co-founder', 'c-suite', 1, TRUE, 9, 90, ARRAY['cofounder', 'co founder', 'founder']),
('CMO', 'cmo', 'c-suite', 1, TRUE, 1, 85, ARRAY['chief marketing officer', 'cmo']),
('CCO', 'cco', 'c-suite', 1, TRUE, 1, 85, ARRAY['chief commercial officer', 'cco']),
('Chief Information Officer', 'chief information officer', 'c-suite', 1, TRUE, 1, 90, ARRAY['cio']),
('Global CTO', 'global cto', 'c-suite', 1, TRUE, 5, 100, ARRAY['global chief technology officer']),
-- Product
('Senior Product Manager', 'senior product manager', 'product', 2, TRUE, 16, 95, ARRAY['sr product manager', 'sr pm', 'senior pm']),
('Product Owner', 'product owner', 'product', 2, TRUE, 7, 90, ARRAY['po']),
('Principal Product Manager', 'principal product manager', 'product', 1, TRUE, 1, 95, ARRAY['principal pm']),
('Product Manager', 'product manager', 'product', 2, TRUE, 1, 85, ARRAY['pm']),
('Discovery & Engagement Product Manager', 'discovery & engagement product manager', 'product', 2, TRUE, 1, 100, ARRAY['discovery pm', 'engagement pm']),
-- Engineering Leadership
('Head of Engineering', 'head of engineering', 'engineering', 1, TRUE, 8, 95, ARRAY['engineering head', 'vp engineering']),
('Engineering Manager', 'engineering manager', 'engineering', 2, TRUE, 7, 90, ARRAY['em', 'eng manager']),
('Director of Web Development', 'director of web development', 'engineering', 1, TRUE, 6, 90, ARRAY['web dev director']),
('VP of Engineering', 'vp of engineering', 'engineering', 1, TRUE, 1, 100, ARRAY['vp eng', 'vice president engineering']),
('Engineering Director', 'engineering director', 'engineering', 1, TRUE, 1, 95, ARRAY['director engineering']),
('Software Engineering Manager', 'software engineering manager', 'engineering', 2, TRUE, 4, 85, ARRAY['software em']),
-- Engineering ICs
('Senior Software Engineer', 'senior software engineer', 'engineering', 3, TRUE, 1, 75, ARRAY['sr swe', 'senior swe']),
('Software Engineer', 'software engineer', 'engineering', 3, TRUE, 5, 70, ARRAY['swe', 'dev']),
('Application Developer', 'application developer', 'engineering', 3, TRUE, 10, 75, ARRAY['app dev']),
-- E-Commerce
('Director of E-Commerce', 'director of e-commerce', 'e-commerce', 1, TRUE, 1, 95, ARRAY['ecommerce director', 'director ecom']),
('Head of E-Commerce', 'head of e-commerce', 'e-commerce', 1, TRUE, 5, 95, ARRAY['ecommerce head', 'ecom head']),
('E-Commerce Manager', 'e-commerce manager', 'e-commerce', 2, TRUE, 2, 85, ARRAY['ecommerce manager', 'ecom manager']),
('E-Commerce Development Manager', 'e-commerce development manager', 'e-commerce', 2, TRUE, 4, 85, ARRAY['ecom dev manager']),
-- Merchandising
('Senior Manager, Digital Merchandising', 'senior manager, digital merchandising', 'merchandising', 2, TRUE, 7, 100, ARRAY['digital merch manager', 'sr merchandising manager']),
-- Digital CX
('Director of Digital Experience', 'director of digital experience', 'digital-cx', 1, TRUE, 9, 95, ARRAY['digital exp director', 'dx director']),
('Director, Customer Experience', 'director, customer experience', 'digital-cx', 1, TRUE, 5, 95, ARRAY['cx director', 'customer exp director']),
('Senior Director of Demand & CX', 'senior director of demand & cx', 'digital-cx', 1, TRUE, 6, 95, ARRAY['sr demand director', 'sr cx director']),
('Global Digital Director', 'global digital director', 'digital-cx', 1, TRUE, 5, 90, ARRAY['global digital head']),
('Head of Digital', 'head of digital', 'digital-cx', 1, TRUE, 1, 90, ARRAY['digital head'])
ON CONFLICT (normalized_title) DO UPDATE SET
  evidence_count = EXCLUDED.evidence_count,
  is_from_customer_evidence = TRUE,
  updated_at = NOW();

-- ============================================================================
-- PART 4: SEED DATA - MERCHANDISING TEAM ROLES (inferred)
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, relevance_score, keywords, notes) VALUES
('Chief Merchandising Officer', 'chief merchandising officer', 'merchandising', 1, FALSE, 95, ARRAY['cmo merch'], 'Strategic platform decisions'),
('VP of Merchandising', 'vp of merchandising', 'merchandising', 1, FALSE, 95, ARRAY['vp merch'], 'Budget authority'),
('Director of Merchandising', 'director of merchandising', 'merchandising', 1, FALSE, 90, ARRAY['merch director'], 'Team strategy'),
('Head of Digital Merchandising', 'head of digital merchandising', 'merchandising', 1, FALSE, 95, ARRAY['digital merch head'], 'Owns online merchandising'),
('Merchandising Manager', 'merchandising manager', 'merchandising', 2, FALSE, 85, ARRAY['merch manager'], 'Day-to-day search rules'),
('Site Merchandiser', 'site merchandiser', 'merchandising', 3, FALSE, 80, ARRAY['online merchandiser'], 'Configures search'),
('Category Manager', 'category manager', 'merchandising', 2, FALSE, 85, ARRAY['category mgr'], 'Category browse/search')
ON CONFLICT (normalized_title) DO NOTHING;

-- ============================================================================
-- PART 5: SEED DATA - SEARCH & DISCOVERY TEAM ROLES (inferred)
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, relevance_score, keywords, notes) VALUES
('VP of Search & Discovery', 'vp of search & discovery', 'search', 1, FALSE, 100, ARRAY['vp search', 'vp discovery'], 'Owns search strategy'),
('Director of Search', 'director of search', 'search', 1, FALSE, 95, ARRAY['search director'], 'Technical + business'),
('Head of Search', 'head of search', 'search', 1, FALSE, 95, ARRAY['search head'], 'Vendor decisions'),
('Search Product Manager', 'search product manager', 'search', 2, FALSE, 100, ARRAY['search pm'], 'Roadmap, requirements'),
('Search Engineer', 'search engineer', 'search', 3, FALSE, 90, ARRAY['search eng'], 'Implementation'),
('Search Relevance Engineer', 'search relevance engineer', 'search', 3, FALSE, 95, ARRAY['relevance eng'], 'Tuning, synonyms'),
('Search Architect', 'search architect', 'search', 2, FALSE, 90, ARRAY['search arch'], 'System design'),
('Discovery Engineer', 'discovery engineer', 'search', 3, FALSE, 90, ARRAY['discovery eng'], 'Browse, recommendations'),
('Query Analyst', 'query analyst', 'search', 3, FALSE, 80, ARRAY['query analysis'], 'Search analytics')
ON CONFLICT (normalized_title) DO NOTHING;

-- ============================================================================
-- PART 6: SEED DATA - ADJACENT INFLUENCER ROLES
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, relevance_score, keywords, notes) VALUES
('VP of Personalization', 'vp of personalization', 'data', 1, FALSE, 90, ARRAY['vp personalization'], 'AI search, 1:1 experiences'),
('Personalization Manager', 'personalization manager', 'data', 2, FALSE, 85, ARRAY['personalization mgr'], 'Personalization strategy'),
('ML Engineer', 'ml engineer', 'data', 3, FALSE, 80, ARRAY['machine learning engineer'], 'ML models for search'),
('Data Engineer', 'data engineer', 'data', 3, FALSE, 70, ARRAY['data eng'], 'Data pipelines'),
('Recommendations Engineer', 'recommendations engineer', 'search', 3, FALSE, 90, ARRAY['recs engineer'], 'Product recommendations')
ON CONFLICT (normalized_title) DO NOTHING;

-- ============================================================================
-- PART 7: HELPER FUNCTION TO NORMALIZE JOB TITLES
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_job_title(title TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(title, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 8: SUMMARY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW job_profiles_summary AS
SELECT
  category,
  tier,
  COUNT(*) as count,
  SUM(CASE WHEN is_from_customer_evidence THEN 1 ELSE 0 END) as from_evidence,
  ROUND(AVG(relevance_score)::numeric, 1) as avg_relevance
FROM target_job_profiles
GROUP BY category, tier
ORDER BY category, tier;

-- ============================================================================
-- DONE! Verify with:
-- SELECT * FROM job_profiles_summary;
-- SELECT * FROM target_job_profiles ORDER BY tier, relevance_score DESC LIMIT 20;
-- ============================================================================
