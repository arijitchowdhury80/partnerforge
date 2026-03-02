-- =====================================================================
-- CLEANUP UNUSED COLUMNS FROM COMPANIES TABLE
-- =====================================================================
-- These columns are empty (0 or null) and not useful
--
-- Run in Supabase Dashboard SQL Editor
-- =====================================================================

-- Drop unused rank columns (all zeros/nulls)
ALTER TABLE companies DROP COLUMN IF EXISTS alexa_rank;
ALTER TABLE companies DROP COLUMN IF EXISTS quantcast_rank;
ALTER TABLE companies DROP COLUMN IF EXISTS quantcast_reach;
ALTER TABLE companies DROP COLUMN IF EXISTS majestic_rank;
ALTER TABLE companies DROP COLUMN IF EXISTS referring_subnets;

-- Verify columns are dropped
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;
