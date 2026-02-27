-- ============================================================================
-- Target Job Profiles Table
-- Stores job titles/roles that are relevant for Algolia sales prospecting
-- ============================================================================

-- Create the table
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

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_job_profiles_category ON target_job_profiles(category);
CREATE INDEX IF NOT EXISTS idx_job_profiles_tier ON target_job_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_job_profiles_relevance ON target_job_profiles(relevance_score DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE target_job_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON target_job_profiles
  FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON target_job_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Categories:
--   c-suite       = C-level executives (CEO, CTO, CIO, CDO, CMO, COO)
--   product       = Product management (PM, PO, Product Director)
--   engineering   = Engineering leadership & ICs
--   e-commerce    = E-commerce specific roles
--   merchandising = Merchandising team roles
--   search        = Search & Discovery team roles
--   digital-cx    = Digital experience & customer experience
--   marketing     = Marketing roles
--   data          = Data science, analytics, ML
--   other         = Other relevant roles
--
-- Tiers:
--   1 = Decision Makers (highest priority - VP+, Directors with budget)
--   2 = Influencers (strong signal - Managers, Leads, Senior ICs)
--   3 = Implementers (confirmation signal - Engineers, Analysts)
-- ============================================================================

-- Function to normalize titles for matching
CREATE OR REPLACE FUNCTION normalize_job_title(title TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(title, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update normalized_title and updated_at
CREATE OR REPLACE FUNCTION update_job_profile_fields() RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_title := normalize_job_title(NEW.title);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_profile_update_trigger
  BEFORE INSERT OR UPDATE ON target_job_profiles
  FOR EACH ROW EXECUTE FUNCTION update_job_profile_fields();

-- ============================================================================
-- SEED DATA: Customer Evidence (from 379 quotes, 119 unique titles)
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, evidence_count, relevance_score, keywords) VALUES
-- C-Suite (47 quotes total)
('CTO', 'cto', 'c-suite', 1, TRUE, 18, 100, ARRAY['chief technology officer', 'cto']),
('COO', 'coo', 'c-suite', 1, TRUE, 11, 95, ARRAY['chief operating officer', 'coo']),
('CEO', 'ceo', 'c-suite', 1, TRUE, 9, 95, ARRAY['chief executive officer', 'ceo']),
('Co-Founder', 'co-founder', 'c-suite', 1, TRUE, 9, 90, ARRAY['cofounder', 'co founder', 'founder']),
('CMO', 'cmo', 'c-suite', 1, TRUE, 1, 85, ARRAY['chief marketing officer', 'cmo']),
('CCO', 'cco', 'c-suite', 1, TRUE, 1, 85, ARRAY['chief commercial officer', 'chief customer officer', 'cco']),
('Chief Information Officer', 'chief information officer', 'c-suite', 1, TRUE, 1, 90, ARRAY['cio']),
('Chief Technology Officer', 'chief technology officer', 'c-suite', 1, TRUE, 1, 100, ARRAY['cto']),
('Global CTO', 'global cto', 'c-suite', 1, TRUE, 5, 100, ARRAY['global chief technology officer']),
('Founder', 'founder', 'c-suite', 1, TRUE, 1, 85, ARRAY['founder', 'co-founder']),

-- Product (30+ quotes)
('Senior Product Manager', 'senior product manager', 'product', 2, TRUE, 16, 95, ARRAY['sr product manager', 'sr pm', 'senior pm']),
('Product Owner', 'product owner', 'product', 2, TRUE, 7, 90, ARRAY['po']),
('Principal Product Manager', 'principal product manager', 'product', 1, TRUE, 1, 95, ARRAY['principal pm']),
('Product Manager', 'product manager', 'product', 2, TRUE, 1, 85, ARRAY['pm']),
('Senior Digital Product Manager', 'senior digital product manager', 'product', 2, TRUE, 1, 90, ARRAY['sr digital pm']),
('Software Product Owner', 'software product owner', 'product', 2, TRUE, 1, 85, ARRAY['software po']),
('IT Product Owner', 'it product owner', 'product', 2, TRUE, 1, 85, ARRAY['it po']),
('Discovery & Engagement Product Manager', 'discovery & engagement product manager', 'product', 2, TRUE, 1, 100, ARRAY['discovery pm', 'engagement pm']),
('Digital Product Leader', 'digital product leader', 'product', 1, TRUE, 1, 90, ARRAY['digital product head']),
('Digital Product Management', 'digital product management', 'product', 2, TRUE, 1, 85, ARRAY['digital pm']),

-- Engineering Leadership (25+ quotes)
('Head of Engineering', 'head of engineering', 'engineering', 1, TRUE, 8, 95, ARRAY['engineering head', 'vp engineering']),
('Engineering Manager', 'engineering manager', 'engineering', 2, TRUE, 7, 90, ARRAY['em', 'eng manager']),
('Director of Web Development', 'director of web development', 'engineering', 1, TRUE, 6, 90, ARRAY['web dev director']),
('Head of Front-end Engineering', 'head of front-end engineering', 'engineering', 1, TRUE, 5, 90, ARRAY['frontend head', 'fe head']),
('VP of Engineering', 'vp of engineering', 'engineering', 1, TRUE, 1, 100, ARRAY['vp eng', 'vice president engineering']),
('VP of Product', 'vp of product', 'engineering', 1, TRUE, 1, 95, ARRAY['vp product']),
('Senior VP of Product and User Experience', 'senior vp of product and user experience', 'engineering', 1, TRUE, 1, 100, ARRAY['svp product', 'svp ux']),
('Software Engineering Manager', 'software engineering manager', 'engineering', 2, TRUE, 4, 85, ARRAY['software em']),
('Engineering Director', 'engineering director', 'engineering', 1, TRUE, 1, 95, ARRAY['director engineering']),
('Director of Software Development', 'director of software development', 'engineering', 1, TRUE, 1, 90, ARRAY['software dev director']),
('Application Architect', 'application architect', 'engineering', 2, TRUE, 1, 85, ARRAY['app architect']),

-- Engineering ICs
('Senior Software Engineer', 'senior software engineer', 'engineering', 3, TRUE, 1, 75, ARRAY['sr swe', 'senior swe']),
('Software Engineer', 'software engineer', 'engineering', 3, TRUE, 5, 70, ARRAY['swe', 'dev']),
('Application Developer', 'application developer', 'engineering', 3, TRUE, 10, 75, ARRAY['app dev']),
('Engineer', 'engineer', 'engineering', 3, TRUE, 10, 70, ARRAY['eng']),
('Web Developer', 'web developer', 'engineering', 3, TRUE, 1, 70, ARRAY['web dev']),
('Senior Web Developer', 'senior web developer', 'engineering', 3, TRUE, 1, 75, ARRAY['sr web dev']),
('Full Stack Web Developer', 'full stack web developer', 'engineering', 3, TRUE, 1, 75, ARRAY['fullstack dev', 'full stack dev']),
('Back End Developer', 'back end developer', 'engineering', 3, TRUE, 1, 70, ARRAY['backend dev', 'be dev']),
('Frontend', 'frontend', 'engineering', 3, TRUE, 1, 65, ARRAY['frontend dev', 'fe dev']),
('Junior Software Engineer', 'junior software engineer', 'engineering', 3, TRUE, 1, 60, ARRAY['jr swe']),
('React Native Developer', 'react native developer', 'engineering', 3, TRUE, 1, 70, ARRAY['rn dev']),
('Senior Digital Developer', 'senior digital developer', 'engineering', 3, TRUE, 1, 75, ARRAY['sr digital dev']),
('QA Engineer', 'qa engineer', 'engineering', 3, TRUE, 1, 60, ARRAY['quality assurance engineer']),

-- E-Commerce (30+ quotes)
('Director of E-Commerce', 'director of e-commerce', 'e-commerce', 1, TRUE, 1, 95, ARRAY['ecommerce director', 'director ecom']),
('Director of E-Commerce & Business Development', 'director of e-commerce & business development', 'e-commerce', 1, TRUE, 5, 95, ARRAY['ecom bd director']),
('Head of E-Commerce', 'head of e-commerce', 'e-commerce', 1, TRUE, 4, 95, ARRAY['ecommerce head', 'ecom head']),
('Head of E-commerce', 'head of e-commerce', 'e-commerce', 1, TRUE, 1, 95, ARRAY['ecommerce head']),
('Head of E-Commerce and Digital Innovation', 'head of e-commerce and digital innovation', 'e-commerce', 1, TRUE, 1, 100, ARRAY['ecom innovation head']),
('Head of Marketing & E-Commerce', 'head of marketing & e-commerce', 'e-commerce', 1, TRUE, 1, 90, ARRAY['marketing ecom head']),
('E-Commerce Manager', 'e-commerce manager', 'e-commerce', 2, TRUE, 1, 85, ARRAY['ecommerce manager', 'ecom manager']),
('E-commerce manager', 'e-commerce manager', 'e-commerce', 2, TRUE, 1, 85, ARRAY['ecommerce manager']),
('ECommerce Manager', 'ecommerce manager', 'e-commerce', 2, TRUE, 1, 85, ARRAY['ecom manager']),
('Manager eCommerce', 'manager ecommerce', 'e-commerce', 2, TRUE, 6, 85, ARRAY['ecom manager']),
('E-Commerce Development Manager', 'e-commerce development manager', 'e-commerce', 2, TRUE, 4, 85, ARRAY['ecom dev manager']),
('E-Business Development', 'e-business development', 'e-commerce', 2, TRUE, 1, 80, ARRAY['ebusiness dev']),
('Online Trading Executive', 'online trading executive', 'e-commerce', 2, TRUE, 1, 75, ARRAY['online trading']),

-- Merchandising
('Senior Manager, Digital Merchandising', 'senior manager, digital merchandising', 'merchandising', 2, TRUE, 7, 100, ARRAY['digital merch manager', 'sr merchandising manager']),
('E-Merchandiser', 'e-merchandiser', 'merchandising', 3, TRUE, 1, 85, ARRAY['digital merchandiser', 'online merchandiser']),

-- Digital Experience & CX (25+ quotes)
('Director of Digital Experience', 'director of digital experience', 'digital-cx', 1, TRUE, 9, 95, ARRAY['digital exp director', 'dx director']),
('Director of Digital Products & Experience', 'director of digital products & experience', 'digital-cx', 1, TRUE, 5, 95, ARRAY['digital products director']),
('Director, Customer Experience', 'director, customer experience', 'digital-cx', 1, TRUE, 5, 95, ARRAY['cx director', 'customer exp director']),
('Senior Director of Demand & CX', 'senior director of demand & cx', 'digital-cx', 1, TRUE, 6, 95, ARRAY['sr demand director', 'sr cx director']),
('Sr Director of Demand & CX', 'sr director of demand & cx', 'digital-cx', 1, TRUE, 1, 95, ARRAY['sr demand director']),
('Global Digital Director', 'global digital director', 'digital-cx', 1, TRUE, 5, 90, ARRAY['global digital head']),
('Head of Digital', 'head of digital', 'digital-cx', 1, TRUE, 1, 90, ARRAY['digital head']),
('Head of Digital Strategy & Portfolio', 'head of digital strategy & portfolio', 'digital-cx', 1, TRUE, 1, 90, ARRAY['digital strategy head']),
('Digital Experience Lead', 'digital experience lead', 'digital-cx', 2, TRUE, 1, 85, ARRAY['dx lead']),
('Digital Experience Solutions Manager', 'digital experience solutions manager', 'digital-cx', 2, TRUE, 1, 85, ARRAY['dx solutions manager']),
('Digital Business Solution Leader', 'digital business solution leader', 'digital-cx', 2, TRUE, 1, 85, ARRAY['digital solutions leader']),
('Delivery Manager, Omnichannel', 'delivery manager, omnichannel', 'digital-cx', 2, TRUE, 1, 80, ARRAY['omnichannel manager']),

-- Marketing
('Vice-President, Product and SEO', 'vice-president, product and seo', 'marketing', 1, TRUE, 5, 90, ARRAY['vp seo', 'vp product seo']),
('Digital Marketing Director', 'digital marketing director', 'marketing', 1, TRUE, 1, 85, ARRAY['digital mktg director']),
('Marketing Manager', 'marketing manager', 'marketing', 2, TRUE, 4, 75, ARRAY['mktg manager']),
('Digital Marketing Manager', 'digital marketing manager', 'marketing', 2, TRUE, 1, 80, ARRAY['digital mktg manager']),
('Digital Marketer', 'digital marketer', 'marketing', 3, TRUE, 1, 65, ARRAY['digital marketing']),
('Marketing Professional', 'marketing professional', 'marketing', 3, TRUE, 4, 60, ARRAY['marketing']),
('Marketing Specialist', 'marketing specialist', 'marketing', 3, TRUE, 1, 65, ARRAY['mktg specialist']),
('Manager of Digital & Marketing Operations', 'manager of digital & marketing operations', 'marketing', 2, TRUE, 1, 80, ARRAY['digital marketing ops']),
('CRO Manager', 'cro manager', 'marketing', 2, TRUE, 1, 85, ARRAY['conversion rate optimization manager']),

-- Data & Analytics
('Insights Analyst', 'insights analyst', 'data', 3, TRUE, 1, 70, ARRAY['analytics analyst']),

-- Other/General
('Director', 'director', 'other', 1, TRUE, 1, 75, ARRAY['dir']),
('General Manager', 'general manager', 'other', 1, TRUE, 1, 80, ARRAY['gm']),
('General Manager & Engineering Manager', 'general manager & engineering manager', 'other', 1, TRUE, 1, 85, ARRAY['gm em']),
('Senior Manager', 'senior manager', 'other', 2, TRUE, 1, 75, ARRAY['sr manager']),
('Senior Executive', 'senior executive', 'other', 1, TRUE, 1, 80, ARRAY['sr exec']),
('Senior IT Director', 'senior it director', 'other', 1, TRUE, 1, 85, ARRAY['sr it director']),
('Assistant Director', 'assistant director', 'other', 2, TRUE, 1, 70, ARRAY['asst director']),
('Planning Director', 'planning director', 'other', 1, TRUE, 1, 75, ARRAY['planning dir']),
('Business Project Manager', 'business project manager', 'other', 2, TRUE, 4, 70, ARRAY['business pm']),
('Project Manager', 'project manager', 'other', 2, TRUE, 1, 65, ARRAY['pm']),
('Consultant', 'consultant', 'other', 2, TRUE, 1, 60, ARRAY['consulting']),
('Senior Consultant / Founder', 'senior consultant / founder', 'other', 2, TRUE, 1, 70, ARRAY['sr consultant']),
('Technical Consultant', 'technical consultant', 'other', 2, TRUE, 1, 65, ARRAY['tech consultant']),
('IT Consultant', 'it consultant', 'other', 2, TRUE, 1, 65, ARRAY['it consulting']),
('IT Specialist', 'it specialist', 'other', 3, TRUE, 1, 60, ARRAY['it spec']),
('Global manager, Retail', 'global manager, retail', 'other', 2, TRUE, 1, 75, ARRAY['global retail manager']),
('Senior Manager, Developer Experience', 'senior manager, developer experience', 'engineering', 2, TRUE, 1, 85, ARRAY['devx manager', 'dx manager']),
('Web Design & Optimisation Manager', 'web design & optimisation manager', 'digital-cx', 2, TRUE, 1, 75, ARRAY['web design manager']),
('Web Designer / UX/UI Developer', 'web designer / ux/ui developer', 'digital-cx', 3, TRUE, 5, 70, ARRAY['ux designer', 'ui developer']),
('Web Development Manager', 'web development manager', 'engineering', 2, TRUE, 1, 85, ARRAY['web dev manager']),
('Head of Web Development', 'head of web development', 'engineering', 1, TRUE, 1, 90, ARRAY['web dev head']),
('Senior Technical Support', 'senior technical support', 'other', 3, TRUE, 1, 55, ARRAY['sr tech support']),
('Network Engineer', 'network engineer', 'other', 3, TRUE, 1, 50, ARRAY['network eng']),
('Linux Administrator', 'linux administrator', 'other', 3, TRUE, 1, 50, ARRAY['linux admin', 'sysadmin']),
('Wordpress Developer', 'wordpress developer', 'engineering', 3, TRUE, 1, 60, ARRAY['wp dev'])

ON CONFLICT (normalized_title) DO UPDATE SET
  evidence_count = EXCLUDED.evidence_count,
  is_from_customer_evidence = TRUE,
  updated_at = NOW();

-- ============================================================================
-- SEED DATA: Merchandising Team Roles (inferred)
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, relevance_score, keywords, notes) VALUES
('Chief Merchandising Officer', 'chief merchandising officer', 'merchandising', 1, FALSE, 95, ARRAY['cmo merch', 'chief merch officer'], 'Strategic platform decisions'),
('VP of Merchandising', 'vp of merchandising', 'merchandising', 1, FALSE, 95, ARRAY['vp merch', 'vice president merchandising'], 'Budget authority, roadmap'),
('Director of Merchandising', 'director of merchandising', 'merchandising', 1, FALSE, 90, ARRAY['merch director', 'merchandising director'], 'Team strategy, vendor selection'),
('Head of Digital Merchandising', 'head of digital merchandising', 'merchandising', 1, FALSE, 95, ARRAY['digital merch head'], 'Owns online merchandising tools'),
('Merchandising Manager', 'merchandising manager', 'merchandising', 2, FALSE, 85, ARRAY['merch manager'], 'Day-to-day search rules, rankings'),
('Site Merchandiser', 'site merchandiser', 'merchandising', 3, FALSE, 80, ARRAY['online merchandiser', 'web merchandiser'], 'Configures search, boosts products'),
('Category Manager', 'category manager', 'merchandising', 2, FALSE, 85, ARRAY['category mgr'], 'Owns category browse/search'),
('Assortment Planner', 'assortment planner', 'merchandising', 3, FALSE, 70, ARRAY['assortment planning'], 'Product catalog, findability'),
('Merchandising Analyst', 'merchandising analyst', 'merchandising', 3, FALSE, 75, ARRAY['merch analyst'], 'Measures search/browse performance'),
('Visual Merchandiser', 'visual merchandiser', 'merchandising', 3, FALSE, 70, ARRAY['visual merch', 'digital visual merchandiser'], 'Product presentation, landing pages'),
('Pricing Manager', 'pricing manager', 'merchandising', 2, FALSE, 75, ARRAY['pricing mgr'], 'Dynamic pricing, promotions in search'),
('Merchandising Operations Manager', 'merchandising operations manager', 'merchandising', 2, FALSE, 80, ARRAY['merch ops manager'], 'Process, tools, training')

ON CONFLICT (normalized_title) DO NOTHING;

-- ============================================================================
-- SEED DATA: Search & Discovery Team Roles (inferred)
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, relevance_score, keywords, notes) VALUES
('VP of Search & Discovery', 'vp of search & discovery', 'search', 1, FALSE, 100, ARRAY['vp search', 'vp discovery'], 'Owns search strategy'),
('Director of Search', 'director of search', 'search', 1, FALSE, 95, ARRAY['search director'], 'Technical + business ownership'),
('Head of Search', 'head of search', 'search', 1, FALSE, 95, ARRAY['search head'], 'Team lead, vendor decisions'),
('Search Product Manager', 'search product manager', 'search', 2, FALSE, 100, ARRAY['search pm'], 'Roadmap, requirements, success metrics'),
('Search Engineer', 'search engineer', 'search', 3, FALSE, 90, ARRAY['search eng', 'search developer'], 'Implementation, integration'),
('Search Relevance Engineer', 'search relevance engineer', 'search', 3, FALSE, 95, ARRAY['relevance eng', 'relevance engineer'], 'Tuning, synonyms, ranking'),
('Search Architect', 'search architect', 'search', 2, FALSE, 90, ARRAY['search arch'], 'System design, scalability'),
('Search Data Scientist', 'search data scientist', 'search', 3, FALSE, 85, ARRAY['search ds'], 'ML models, personalization'),
('NLP Engineer', 'nlp engineer', 'search', 3, FALSE, 85, ARRAY['natural language processing engineer'], 'Query understanding, semantic search'),
('Relevance Engineer', 'relevance engineer', 'search', 3, FALSE, 95, ARRAY['relevance eng'], 'Result quality, A/B testing'),
('Discovery Engineer', 'discovery engineer', 'search', 3, FALSE, 90, ARRAY['discovery eng'], 'Browse, recommendations'),
('Search Quality Analyst', 'search quality analyst', 'search', 3, FALSE, 80, ARRAY['search qa'], 'QA, monitoring, edge cases'),
('Search Operations', 'search operations', 'search', 3, FALSE, 75, ARRAY['search ops'], 'Indexing, monitoring, alerts'),
('Query Analyst', 'query analyst', 'search', 3, FALSE, 80, ARRAY['query analysis'], 'Search analytics, zero-results'),
('Head of Discovery', 'head of discovery', 'search', 1, FALSE, 95, ARRAY['discovery head'], 'Owns product discovery'),
('Discovery Product Manager', 'discovery product manager', 'search', 2, FALSE, 95, ARRAY['discovery pm'], 'Browse + recommendations roadmap')

ON CONFLICT (normalized_title) DO NOTHING;

-- ============================================================================
-- SEED DATA: Adjacent/Influencer Roles (inferred)
-- ============================================================================

INSERT INTO target_job_profiles (title, normalized_title, category, tier, is_from_customer_evidence, relevance_score, keywords, notes) VALUES
-- Personalization Team
('VP of Personalization', 'vp of personalization', 'data', 1, FALSE, 90, ARRAY['vp personalization'], '1:1 experiences, AI search'),
('Personalization Manager', 'personalization manager', 'data', 2, FALSE, 85, ARRAY['personalization mgr'], 'Personalization strategy'),
('Personalization Engineer', 'personalization engineer', 'data', 3, FALSE, 80, ARRAY['personalization eng'], 'ML for personalization'),

-- Conversion/CRO Team
('Director of Conversion', 'director of conversion', 'digital-cx', 1, FALSE, 85, ARRAY['conversion director', 'cro director'], 'Search → conversion metrics'),
('Conversion Analyst', 'conversion analyst', 'data', 3, FALSE, 75, ARRAY['cro analyst'], 'A/B testing, funnel analysis'),

-- Content/Taxonomy
('Content Manager', 'content manager', 'digital-cx', 2, FALSE, 70, ARRAY['content mgr'], 'Product content quality'),
('Taxonomy Manager', 'taxonomy manager', 'data', 2, FALSE, 80, ARRAY['taxonomy mgr', 'ontology manager'], 'Product categorization'),

-- Analytics
('Digital Analytics Manager', 'digital analytics manager', 'data', 2, FALSE, 80, ARRAY['digital analytics mgr'], 'Search analytics, reporting'),
('Search Analyst', 'search analyst', 'data', 3, FALSE, 85, ARRAY['search analytics analyst'], 'Measures search success'),

-- UX
('UX Lead', 'ux lead', 'digital-cx', 2, FALSE, 75, ARRAY['ux lead', 'user experience lead'], 'Search UI/UX'),
('Frontend Lead', 'frontend lead', 'engineering', 2, FALSE, 80, ARRAY['fe lead', 'frontend lead'], 'Search UI implementation'),

-- Data Engineering
('Data Engineer', 'data engineer', 'data', 3, FALSE, 70, ARRAY['data eng'], 'Data pipelines for search'),
('ML Engineer', 'ml engineer', 'data', 3, FALSE, 80, ARRAY['machine learning engineer'], 'ML models for search/recs'),

-- Recommendations
('Recommendations Engineer', 'recommendations engineer', 'search', 3, FALSE, 90, ARRAY['recs engineer', 'recommendation engineer'], 'Product recommendations'),
('Recommendations Product Manager', 'recommendations product manager', 'search', 2, FALSE, 90, ARRAY['recs pm'], 'Recommendations roadmap')

ON CONFLICT (normalized_title) DO NOTHING;

-- ============================================================================
-- Create view for easy querying by tier
-- ============================================================================

CREATE OR REPLACE VIEW job_profiles_by_tier AS
SELECT
  tier,
  category,
  title,
  relevance_score,
  is_from_customer_evidence,
  evidence_count,
  keywords
FROM target_job_profiles
ORDER BY tier ASC, relevance_score DESC, category;

-- ============================================================================
-- Helper function to match job titles
-- ============================================================================

CREATE OR REPLACE FUNCTION match_job_title(input_title TEXT)
RETURNS TABLE (
  id INTEGER,
  title VARCHAR(255),
  category VARCHAR(50),
  tier INTEGER,
  relevance_score INTEGER,
  match_type TEXT
) AS $$
DECLARE
  normalized_input TEXT;
BEGIN
  normalized_input := normalize_job_title(input_title);

  -- First try exact match
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.category,
    t.tier,
    t.relevance_score,
    'exact'::TEXT as match_type
  FROM target_job_profiles t
  WHERE t.normalized_title = normalized_input;

  -- If no exact match, try keyword match
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      t.id,
      t.title,
      t.category,
      t.tier,
      t.relevance_score,
      'keyword'::TEXT as match_type
    FROM target_job_profiles t
    WHERE normalized_input ILIKE ANY(t.keywords)
       OR EXISTS (
         SELECT 1 FROM UNNEST(t.keywords) k
         WHERE normalized_input ILIKE '%' || k || '%'
       )
    ORDER BY t.relevance_score DESC
    LIMIT 5;
  END IF;

  -- If still no match, try fuzzy match on title
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      t.id,
      t.title,
      t.category,
      t.tier,
      t.relevance_score,
      'fuzzy'::TEXT as match_type
    FROM target_job_profiles t
    WHERE t.normalized_title ILIKE '%' || normalized_input || '%'
       OR normalized_input ILIKE '%' || t.normalized_title || '%'
    ORDER BY t.relevance_score DESC
    LIMIT 5;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Summary stats
-- ============================================================================

-- View showing category and tier distribution
CREATE OR REPLACE VIEW job_profiles_summary AS
SELECT
  category,
  tier,
  COUNT(*) as count,
  SUM(CASE WHEN is_from_customer_evidence THEN 1 ELSE 0 END) as from_evidence,
  ROUND(AVG(relevance_score), 1) as avg_relevance
FROM target_job_profiles
GROUP BY category, tier
ORDER BY category, tier;

COMMENT ON TABLE target_job_profiles IS 'Target job profiles for Algolia sales prospecting. Contains roles from customer evidence and inferred team structures.';
