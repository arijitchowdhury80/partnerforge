-- =====================================================================
-- CREATE TECHNOLOGIES TABLE - Master List of Partner Technologies
-- =====================================================================
-- This table defines EXACTLY which technologies we track for displacement
-- opportunities. Each technology maps to a BuiltWith technology name for
-- the Lists API query.
--
-- Run in Supabase Dashboard SQL Editor
-- =====================================================================

-- Drop existing if starting fresh
DROP TABLE IF EXISTS technologies CASCADE;

-- Create technologies table
CREATE TABLE technologies (
  id SERIAL PRIMARY KEY,

  -- Technology identification
  slug TEXT NOT NULL UNIQUE,              -- Our internal slug (e.g., 'aem', 'shopify-plus')
  name TEXT NOT NULL,                     -- Display name (e.g., 'Adobe Experience Manager')
  builtwith_name TEXT NOT NULL,           -- Exact BuiltWith technology name for API

  -- Categorization
  category TEXT NOT NULL,                 -- cms, commerce, martech, search, cloud
  subcategory TEXT,                       -- Optional (e.g., 'headless-cms', 'b2b-commerce')

  -- Configuration
  is_active BOOLEAN DEFAULT true,         -- Should we query this tech?
  priority INTEGER DEFAULT 0,             -- Higher = more important (for batching)

  -- API metadata
  last_fetched_at TIMESTAMPTZ,           -- When did we last run Lists API?
  domain_count INTEGER,                   -- How many domains returned?
  api_error TEXT,                         -- Last API error if any

  -- Metadata
  notes TEXT,                            -- Internal notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_technologies_category ON technologies(category);
CREATE INDEX idx_technologies_active ON technologies(is_active);
CREATE INDEX idx_technologies_priority ON technologies(priority DESC);

-- Add comments
COMMENT ON TABLE technologies IS 'Master list of partner technologies tracked for displacement opportunities';
COMMENT ON COLUMN technologies.slug IS 'Internal slug for this technology (lowercase, hyphenated)';
COMMENT ON COLUMN technologies.builtwith_name IS 'Exact technology name to pass to BuiltWith Lists API';
COMMENT ON COLUMN technologies.category IS 'Technology category: cms, commerce, martech, search, cloud';
COMMENT ON COLUMN technologies.is_active IS 'If false, skip this technology in batch queries';
COMMENT ON COLUMN technologies.priority IS 'Higher priority technologies queried first (0-100)';

-- Verify
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'technologies'
ORDER BY ordinal_position;
