-- =====================================================================
-- ADD INDUSTRY CLASSIFICATION FIELDS (Phase 3)
-- =====================================================================
-- These fields store Yahoo Finance industry/sector classification
-- for ICP filtering in Phase 4.
--
-- Run in Supabase Dashboard SQL Editor
-- =====================================================================

-- Add industry classification columns
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS ticker TEXT,
ADD COLUMN IF NOT EXISTS yf_industry TEXT,
ADD COLUMN IF NOT EXISTS yf_sector TEXT,
ADD COLUMN IF NOT EXISTS industry_updated_at TIMESTAMPTZ;

-- Add index for querying by industry
CREATE INDEX IF NOT EXISTS idx_companies_yf_industry ON companies(yf_industry);
CREATE INDEX IF NOT EXISTS idx_companies_yf_sector ON companies(yf_sector);
CREATE INDEX IF NOT EXISTS idx_companies_ticker ON companies(ticker);

-- Add comment
COMMENT ON COLUMN companies.ticker IS 'Stock ticker symbol from Yahoo Finance (e.g., NKE for nike.com)';
COMMENT ON COLUMN companies.yf_industry IS 'Industry classification from Yahoo Finance (e.g., Footwear & Accessories)';
COMMENT ON COLUMN companies.yf_sector IS 'Broader sector from Yahoo Finance (e.g., Consumer Cyclical)';
COMMENT ON COLUMN companies.industry_updated_at IS 'Timestamp when industry data was last fetched';

-- Verify columns were added
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('ticker', 'yf_industry', 'yf_sector', 'industry_updated_at')
ORDER BY ordinal_position;
