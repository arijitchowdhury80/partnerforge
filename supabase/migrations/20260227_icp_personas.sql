-- ============================================================================
-- ICP Personas Table - Buyer personas derived from customer quotes
-- ============================================================================

-- 1. Buyer Personas
CREATE TABLE IF NOT EXISTS icp_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_key TEXT UNIQUE NOT NULL,        -- e.g., 'technical-leader'
  name TEXT NOT NULL,                       -- e.g., 'Technical Decision Maker'
  percentage INTEGER NOT NULL,              -- e.g., 30 (percentage of quotes)
  color TEXT DEFAULT '#64748b',
  sample_quote TEXT,
  sample_speaker TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Persona Titles (many titles per persona)
CREATE TABLE IF NOT EXISTS icp_persona_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES icp_personas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  UNIQUE(persona_id, title)
);

-- 3. Persona Themes (what they care about)
CREATE TABLE IF NOT EXISTS icp_persona_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES icp_personas(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  priority INTEGER DEFAULT 1,              -- 1 = highest priority
  UNIQUE(persona_id, theme)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_persona_titles_persona ON icp_persona_titles(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_themes_persona ON icp_persona_themes(persona_id);

-- RLS Policies
ALTER TABLE icp_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_persona_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_persona_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read icp_personas" ON icp_personas FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_persona_titles" ON icp_persona_titles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read icp_persona_themes" ON icp_persona_themes FOR SELECT TO anon USING (true);

-- ============================================================================
-- Seed Persona Data (from icpData.ts)
-- ============================================================================

-- Technical Decision Maker (30%)
INSERT INTO icp_personas (persona_key, name, percentage, color, sample_quote, sample_speaker)
VALUES ('technical-leader', 'Technical Decision Maker', 30, '#003DFF',
        'Speed of search request, speed of execution. This is why our attention turned to Algolia.',
        'Pascal Sardella, TAG Heuer')
ON CONFLICT (persona_key) DO UPDATE SET
  name = EXCLUDED.name,
  percentage = EXCLUDED.percentage,
  color = EXCLUDED.color,
  sample_quote = EXCLUDED.sample_quote,
  sample_speaker = EXCLUDED.sample_speaker;

-- Digital Experience Owner (26%)
INSERT INTO icp_personas (persona_key, name, percentage, color, sample_quote, sample_speaker)
VALUES ('digital-experience', 'Digital Experience Owner', 26, '#5468FF',
        'Delivering a fast, relevant experience to our online customers is a top priority.',
        'Under Armour')
ON CONFLICT (persona_key) DO UPDATE SET
  name = EXCLUDED.name,
  percentage = EXCLUDED.percentage,
  color = EXCLUDED.color,
  sample_quote = EXCLUDED.sample_quote,
  sample_speaker = EXCLUDED.sample_speaker;

-- Merchandising Champion (14%)
INSERT INTO icp_personas (persona_key, name, percentage, color, sample_quote, sample_speaker)
VALUES ('merchandising', 'Merchandising Champion', 14, '#f59e0b',
        'AI-powered merchandising has driven 5-20% revenue uplift in controlled experiments.',
        'Fashion Retailer')
ON CONFLICT (persona_key) DO UPDATE SET
  name = EXCLUDED.name,
  percentage = EXCLUDED.percentage,
  color = EXCLUDED.color,
  sample_quote = EXCLUDED.sample_quote,
  sample_speaker = EXCLUDED.sample_speaker;

-- Operations Executive (9%)
INSERT INTO icp_personas (persona_key, name, percentage, color, sample_quote, sample_speaker)
VALUES ('operations', 'Operations Executive', 9, '#10b981',
        'With Algolia you don''t need a lot of knowledge or people to use Search in a smart way.',
        'Alex Bloemendal, Zeeman')
ON CONFLICT (persona_key) DO UPDATE SET
  name = EXCLUDED.name,
  percentage = EXCLUDED.percentage,
  color = EXCLUDED.color,
  sample_quote = EXCLUDED.sample_quote,
  sample_speaker = EXCLUDED.sample_speaker;

-- Insert titles for each persona
DO $$
DECLARE
  tech_id UUID;
  digital_id UUID;
  merch_id UUID;
  ops_id UUID;
BEGIN
  SELECT id INTO tech_id FROM icp_personas WHERE persona_key = 'technical-leader';
  SELECT id INTO digital_id FROM icp_personas WHERE persona_key = 'digital-experience';
  SELECT id INTO merch_id FROM icp_personas WHERE persona_key = 'merchandising';
  SELECT id INTO ops_id FROM icp_personas WHERE persona_key = 'operations';

  -- Technical Leader titles
  INSERT INTO icp_persona_titles (persona_id, title) VALUES
    (tech_id, 'CTO'),
    (tech_id, 'VP Engineering'),
    (tech_id, 'Head of Engineering')
  ON CONFLICT DO NOTHING;

  -- Digital Experience titles
  INSERT INTO icp_persona_titles (persona_id, title) VALUES
    (digital_id, 'Director E-Commerce'),
    (digital_id, 'VP Digital'),
    (digital_id, 'Director of Digital Experience')
  ON CONFLICT DO NOTHING;

  -- Merchandising titles
  INSERT INTO icp_persona_titles (persona_id, title) VALUES
    (merch_id, 'Sr Manager Digital Merchandising'),
    (merch_id, 'Director Customer Experience')
  ON CONFLICT DO NOTHING;

  -- Operations titles
  INSERT INTO icp_persona_titles (persona_id, title) VALUES
    (ops_id, 'COO'),
    (ops_id, 'VP Operations')
  ON CONFLICT DO NOTHING;

  -- Technical Leader themes
  INSERT INTO icp_persona_themes (persona_id, theme, priority) VALUES
    (tech_id, 'Performance', 1),
    (tech_id, 'Scale', 2),
    (tech_id, 'Speed of implementation', 3),
    (tech_id, 'Integration ease', 4)
  ON CONFLICT DO NOTHING;

  -- Digital Experience themes
  INSERT INTO icp_persona_themes (persona_id, theme, priority) VALUES
    (digital_id, 'Conversion', 1),
    (digital_id, 'Relevance', 2),
    (digital_id, 'User experience', 3),
    (digital_id, 'Mobile', 4)
  ON CONFLICT DO NOTHING;

  -- Merchandising themes
  INSERT INTO icp_persona_themes (persona_id, theme, priority) VALUES
    (merch_id, 'A/B testing', 1),
    (merch_id, 'Revenue optimization', 2),
    (merch_id, 'AI-powered ranking', 3)
  ON CONFLICT DO NOTHING;

  -- Operations themes
  INSERT INTO icp_persona_themes (persona_id, theme, priority) VALUES
    (ops_id, 'Efficiency', 1),
    (ops_id, 'Reduced manual work', 2),
    (ops_id, 'Stability', 3)
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- Updated ICP Summary View (include personas)
-- ============================================================================

DROP VIEW IF EXISTS icp_summary;
CREATE VIEW icp_summary AS
SELECT
  (SELECT COUNT(*) FROM icp_companies) as total_companies,
  (SELECT COUNT(*) FROM icp_companies WHERE story_url IS NOT NULL) as with_stories,
  (SELECT COUNT(*) FROM icp_quotes) as total_quotes,
  (SELECT COUNT(DISTINCT company_id) FROM icp_quotes) as companies_with_quotes,
  (SELECT COUNT(*) FROM icp_proofpoints) as total_proofpoints,
  (SELECT COUNT(*) FROM icp_metrics) as total_metrics,
  (SELECT COUNT(*) FROM icp_personas) as total_personas,
  (SELECT COUNT(*) FROM icp_companies WHERE evidence_tier = 'GOLD') as gold_tier,
  (SELECT COUNT(*) FROM icp_companies WHERE evidence_tier = 'SILVER') as silver_tier,
  (SELECT COUNT(*) FROM icp_companies WHERE evidence_tier = 'BRONZE') as bronze_tier;

-- ============================================================================
-- Persona with details view (for easy querying)
-- ============================================================================

CREATE OR REPLACE VIEW icp_persona_details AS
SELECT
  p.id,
  p.persona_key,
  p.name,
  p.percentage,
  p.color,
  p.sample_quote,
  p.sample_speaker,
  COALESCE(
    (SELECT json_agg(t.title ORDER BY t.title) FROM icp_persona_titles t WHERE t.persona_id = p.id),
    '[]'::json
  ) as titles,
  COALESCE(
    (SELECT json_agg(th.theme ORDER BY th.priority) FROM icp_persona_themes th WHERE th.persona_id = p.id),
    '[]'::json
  ) as themes
FROM icp_personas p
ORDER BY p.percentage DESC;
