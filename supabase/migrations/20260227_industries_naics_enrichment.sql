-- ============================================================================
-- INDUSTRIES TABLE: NAICS CODE ENRICHMENT
-- ============================================================================
-- Adds NAICS sector codes for data matching with external systems.
-- Industry names from Demandbase are already descriptive - no descriptions needed.
--
-- Created: 2026-02-27
-- ============================================================================

-- ===========================================
-- ADD NAICS CODE COLUMN
-- ===========================================
ALTER TABLE industries
ADD COLUMN IF NOT EXISTS naics_sector_code VARCHAR(10);

COMMENT ON COLUMN industries.naics_sector_code IS
'NAICS sector code for data matching with Census, government databases, and external systems.';

CREATE INDEX IF NOT EXISTS idx_industries_naics_sector ON industries(naics_sector_code);

-- ===========================================
-- SEED NAICS CODES
-- ===========================================
UPDATE industries SET naics_sector_code = '51' WHERE slug = 'computer-software';
UPDATE industries SET naics_sector_code = '334' WHERE slug = 'computer-hardware';
UPDATE industries SET naics_sector_code = '517' WHERE slug = 'telecommunications';
UPDATE industries SET naics_sector_code = '334' WHERE slug = 'electronics';
UPDATE industries SET naics_sector_code = '44-45' WHERE slug = 'retail';
UPDATE industries SET naics_sector_code = '31-33' WHERE slug = 'consumer-product-manufacturing';
UPDATE industries SET naics_sector_code = '81' WHERE slug = 'consumer-services';
UPDATE industries SET naics_sector_code = '51' WHERE slug = 'media';
UPDATE industries SET naics_sector_code = '71' WHERE slug = 'leisure-sports-recreation';
UPDATE industries SET naics_sector_code = '52' WHERE slug = 'financial-services';
UPDATE industries SET naics_sector_code = '522' WHERE slug = 'banks';
UPDATE industries SET naics_sector_code = '524' WHERE slug = 'insurance';
UPDATE industries SET naics_sector_code = '62' WHERE slug = 'hospitals-healthcare';
UPDATE industries SET naics_sector_code = '325' WHERE slug = 'pharma-biotech';
UPDATE industries SET naics_sector_code = '54' WHERE slug = 'corporate-services';
UPDATE industries SET naics_sector_code = '33' WHERE slug = 'industrial-manufacturing';
UPDATE industries SET naics_sector_code = '23' WHERE slug = 'construction-building';
UPDATE industries SET naics_sector_code = '336' WHERE slug = 'automotive';
UPDATE industries SET naics_sector_code = '336' WHERE slug = 'aerospace-defense';
UPDATE industries SET naics_sector_code = '325' WHERE slug = 'chemicals';
UPDATE industries SET naics_sector_code = '21' WHERE slug = 'mining-metals';
UPDATE industries SET naics_sector_code = '22' WHERE slug = 'energy-environmental';
UPDATE industries SET naics_sector_code = '311' WHERE slug = 'food-beverage';
UPDATE industries SET naics_sector_code = '48-49' WHERE slug = 'transportation';
UPDATE industries SET naics_sector_code = '53' WHERE slug = 'real-estate';
UPDATE industries SET naics_sector_code = '61' WHERE slug = 'schools-education';
UPDATE industries SET naics_sector_code = '92' WHERE slug = 'government';
UPDATE industries SET naics_sector_code = '813' WHERE slug = 'civic-nonprofit';
UPDATE industries SET naics_sector_code = '55' WHERE slug = 'holding-companies';
UPDATE industries SET naics_sector_code = '11' WHERE slug = 'agriculture-forestry';
