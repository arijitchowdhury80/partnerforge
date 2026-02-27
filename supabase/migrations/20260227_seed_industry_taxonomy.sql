-- ============================================================================
-- SEED: UNIFIED INDUSTRY TAXONOMY
-- ============================================================================
-- Populates industries and sub_industries tables with unified taxonomy.
-- Based on Demandbase (primary) with ZoomInfo mappings.
-- ============================================================================

-- ===========================================
-- INDUSTRIES (30 unified industries)
-- ===========================================
INSERT INTO industries (name, slug, demandbase_name, zoominfo_names, display_order) VALUES
-- Technology
('Computer Software', 'computer-software', 'Computer Software', ARRAY['Software'], 1),
('Computer Hardware', 'computer-hardware', 'Computer Hardware', ARRAY['Manufacturing'], 2),
('Telecommunications', 'telecommunications', 'Telecommunications', ARRAY['Telecommunications'], 3),
('Electronics', 'electronics', 'Electronics', ARRAY['Manufacturing'], 4),

-- Retail & Consumer
('Retail', 'retail', 'Retail', ARRAY['Retail'], 10),
('Consumer Product Manufacturing', 'consumer-product-manufacturing', 'Consumer Product Manufacturing', ARRAY['Manufacturing', 'Retail'], 11),
('Consumer Services', 'consumer-services', 'Consumer Services', ARRAY['Consumer Services', 'Hospitality', 'Transportation'], 12),

-- Media & Entertainment
('Media', 'media', 'Media', ARRAY['Media & Internet'], 20),
('Leisure, Sports and Recreation', 'leisure-sports-recreation', 'Leisure, Sports and Recreation', ARRAY['Hospitality'], 21),

-- Financial
('Financial Services', 'financial-services', 'Financial Services', ARRAY['Finance'], 30),
('Banks', 'banks', 'Banks', ARRAY['Finance'], 31),
('Insurance', 'insurance', 'Insurance', ARRAY['Insurance'], 32),

-- Healthcare
('Hospitals and Healthcare', 'hospitals-healthcare', 'Hospitals and Healthcare', ARRAY['Hospitals & Physicians Clinics', 'Healthcare Services'], 40),
('Pharmaceuticals and Biotechnology', 'pharma-biotech', 'Pharmaceuticals and Biotechnology', ARRAY['Manufacturing', 'Business Services'], 41),

-- Professional Services
('Corporate Services', 'corporate-services', 'Corporate Services', ARRAY['Business Services', 'Law Firms & Legal Services'], 50),

-- Industrial
('Industrial Manufacturing and Services', 'industrial-manufacturing', 'Industrial Manufacturing and Services', ARRAY['Manufacturing', 'Construction'], 60),
('Construction and Building Materials', 'construction-building', 'Construction and Building Materials', ARRAY['Manufacturing', 'Construction', 'Retail'], 61),
('Automotive', 'automotive', 'Automotive', ARRAY['Manufacturing', 'Retail'], 62),
('Aerospace and Defense', 'aerospace-defense', 'Aerospace and Defense', ARRAY['Manufacturing'], 63),
('Chemicals', 'chemicals', 'Chemicals', ARRAY['Manufacturing'], 64),
('Mining and Metals', 'mining-metals', 'Mining and Metals', ARRAY['Manufacturing', 'Minerals & Mining'], 65),

-- Energy & Utilities
('Energy and Environmental', 'energy-environmental', 'Energy and Environmental', ARRAY['Energy, Utilities & Waste'], 70),

-- Food & Beverage
('Food and Beverage', 'food-beverage', 'Food and Beverage', ARRAY['Manufacturing', 'Hospitality'], 80),

-- Transportation & Logistics
('Transportation', 'transportation', 'Transportation', ARRAY['Transportation'], 90),

-- Real Estate
('Real Estate', 'real-estate', 'Real Estate', ARRAY['Real Estate'], 100),

-- Education & Government
('Schools and Education', 'schools-education', 'Schools and Education', ARRAY['Education'], 110),
('Government', 'government', 'Government', ARRAY['Government'], 111),
('Civic, Non-Profit and Membership Groups', 'civic-nonprofit', 'Civic, Non-Profit and Membership Groups', ARRAY['Organizations'], 112),

-- Holding Companies
('Holding Companies', 'holding-companies', 'Holding Companies', ARRAY['Holding Companies & Conglomerates'], 120),

-- Agriculture
('Agriculture and Forestry', 'agriculture-forestry', 'Agriculture and Forestry', ARRAY['Manufacturing'], 130)

ON CONFLICT (name) DO UPDATE SET
    demandbase_name = EXCLUDED.demandbase_name,
    zoominfo_names = EXCLUDED.zoominfo_names,
    display_order = EXCLUDED.display_order;

-- ===========================================
-- UPDATE WHALE_COMPOSITE WITH INDUSTRY FKs
-- ===========================================
-- Match by demandbase_industry to unified industry
UPDATE whale_composite wc
SET unified_industry_id = i.id
FROM industries i
WHERE wc.demandbase_industry = i.demandbase_name
  AND wc.unified_industry_id IS NULL;

-- For any remaining nulls, try matching by ZoomInfo
UPDATE whale_composite wc
SET unified_industry_id = i.id
FROM industries i
WHERE wc.unified_industry_id IS NULL
  AND wc.zi_primary_industry = ANY(i.zoominfo_names);
