-- ============================================================================
-- Seed ICP Evidence Data (from customerEvidence.json)
-- Run after 20260227_icp_evidence_tables.sql
-- ============================================================================

-- Helper function to normalize industry names
CREATE OR REPLACE FUNCTION normalize_industry(raw_industry TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN LOWER(raw_industry) LIKE '%fashion%' OR LOWER(raw_industry) LIKE '%apparel%' OR LOWER(raw_industry) LIKE '%clothing%' THEN 'fashion-apparel'
    WHEN LOWER(raw_industry) LIKE '%grocery%' OR LOWER(raw_industry) LIKE '%food%' THEN 'grocery-food'
    WHEN LOWER(raw_industry) LIKE '%saas%' OR LOWER(raw_industry) LIKE '%software%' THEN 'saas'
    WHEN LOWER(raw_industry) LIKE '%b2b%' THEN 'b2b-ecommerce'
    WHEN LOWER(raw_industry) LIKE '%media%' OR LOWER(raw_industry) LIKE '%publishing%' THEN 'media-publishing'
    WHEN LOWER(raw_industry) LIKE '%retail%' OR LOWER(raw_industry) LIKE '%e-comm%' OR LOWER(raw_industry) LIKE '%ecomm%' THEN 'retail-ecommerce'
    WHEN LOWER(raw_industry) LIKE '%health%' OR LOWER(raw_industry) LIKE '%pharmacy%' THEN 'healthcare'
    ELSE 'other'
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Insert Companies (sample of key companies with full evidence)
-- Full data will be imported via API script
-- ============================================================================

-- Walgreens - GOLD tier (many quotes, story URL)
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Walgreens', 'https://www.algolia.com/customers/walgreens', 'retail pharmacy / healthcare retail', 'B2C Ecommerce (Buy Online, Pickup in Store)', 'United States', 'North America', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- Everlane - GOLD tier
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Everlane', 'https://www.algolia.com/customers/everlane', 'Fashion', 'E-commerce', 'United States', 'North America', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- Zeeman - GOLD tier (fashion proof point)
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Zeeman', 'https://www.algolia.com/customers/zeeman', 'Fashion/Apparel', 'E-commerce', 'Netherlands', 'Europe', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- Gymshark - GOLD tier
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Gymshark', 'https://www.algolia.com/customers/gymshark', 'Fashion / Fitness', 'E-commerce', 'United Kingdom', 'Europe', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- Under Armour - GOLD tier
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Under Armour', 'https://www.algolia.com/customers/under-armour', 'Fashion/Apparel', 'E-commerce', 'United States', 'North America', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- TAG Heuer - GOLD tier
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('TAG Heuer', 'https://www.algolia.com/customers/tag-heuer', 'Luxury/Retail', 'E-commerce', 'Switzerland', 'Europe', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- Culture Kings - GOLD tier
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Culture Kings', 'https://www.algolia.com/customers/culture-kings', 'Fashion/Streetwear', 'E-commerce', 'Australia', 'Asia Pacific', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- HEB Mexico - GOLD tier (grocery proof point)
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('HEB Mexico', 'https://www.algolia.com/customers/heb', 'Grocery', 'E-commerce', 'Mexico', 'Latin America', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- Lacoste - GOLD tier
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Lacoste', 'https://www.algolia.com/customers/lacoste', 'Fashion/Apparel', 'E-commerce', 'France', 'Europe', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- Staples - GOLD tier (B2B)
INSERT INTO icp_companies (company_name, story_url, industry_raw, use_case, country, region, evidence_tier)
VALUES ('Staples', 'https://www.algolia.com/customers/staples', 'B2B e-commerce', 'B2B Marketplace', 'United States', 'North America', 'GOLD')
ON CONFLICT (company_name) DO NOTHING;

-- ============================================================================
-- Insert Sample Quotes (linked to companies)
-- ============================================================================

-- Walgreens quotes
INSERT INTO icp_quotes (company_id, quote_text, speaker_name, speaker_title, source)
SELECT id, '[Algolia] helps our customers find what they are looking for faster in a catalog of thousands of items, without business team intervention.', 'Shelby Sharp', 'Director of Digital Experience', 'Customer Interview'
FROM icp_companies WHERE company_name = 'Walgreens';

INSERT INTO icp_quotes (company_id, quote_text, speaker_name, speaker_title, source)
SELECT id, 'We knew we had an opportunity to improve conversion as we looked across our competition, but our prior search provider didn''t give us many levers to pull.', 'Shelby Sharp', 'Director of Digital Experience', 'Customer Interview'
FROM icp_companies WHERE company_name = 'Walgreens';

INSERT INTO icp_quotes (company_id, quote_text, speaker_name, speaker_title, source)
SELECT id, 'It really feels like a partnership, especially with the support of our Algolia customer success team.', 'Shelby Sharp', 'Director of Digital Experience', 'Customer Interview'
FROM icp_companies WHERE company_name = 'Walgreens';

-- Everlane quotes
INSERT INTO icp_quotes (company_id, quote_text, speaker_name, speaker_title, source)
SELECT id, 'With Algolia, we now build complex search features in months instead of years.', 'Anton Halim', 'Engineer', 'TechValidate'
FROM icp_companies WHERE company_name = 'Everlane';

INSERT INTO icp_quotes (company_id, quote_text, speaker_name, speaker_title, source)
SELECT id, 'As the digital space shifts, we know customers aren''t spending as much time on the site. Our goal is to remove as much friction as possible in their journey. Algolia is a great partner for us in that endeavor.', 'Rachel Maxwell', 'Senior Manager, Digital Merchandising', 'Customer Interview'
FROM icp_companies WHERE company_name = 'Everlane';

-- Zeeman quotes
INSERT INTO icp_quotes (company_id, quote_text, speaker_name, speaker_title, source)
SELECT id, 'With Algolia you don''t need a lot of knowledge or people to use Search and Discovery.', 'Alex Bloemendal', 'CEO', 'Customer Interview'
FROM icp_companies WHERE company_name = 'Zeeman';

-- ============================================================================
-- Link Companies to Features
-- ============================================================================

-- Walgreens features
INSERT INTO icp_company_features (company_id, feature_id)
SELECT c.id, f.id FROM icp_companies c, icp_features f
WHERE c.company_name = 'Walgreens' AND f.name IN ('personalization', 'drr', 'rules', 'ab-testing', 'browse', 'analytics');

-- Everlane features
INSERT INTO icp_company_features (company_id, feature_id)
SELECT c.id, f.id FROM icp_companies c, icp_features f
WHERE c.company_name = 'Everlane' AND f.name IN ('neuralsearch', 'rules');

-- ============================================================================
-- Update industry references
-- ============================================================================

UPDATE icp_companies SET industry_id = (
  SELECT id FROM icp_industries WHERE name = normalize_industry(icp_companies.industry_raw)
);

-- ============================================================================
-- Summary stats after seeding
-- ============================================================================
-- SELECT * FROM icp_summary;
