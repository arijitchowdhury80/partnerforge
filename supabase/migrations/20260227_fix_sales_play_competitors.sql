-- ============================================================================
-- FIX: Add missing search competitors to sales_play classification
-- ============================================================================
-- Issue: The Search galaxy thread found competitors not in the original list:
--   - Doofinder (589 companies)
--   - Cludo (159 companies)
--   - AddSearch (21 companies)
-- These were being classified as GREENFIELD instead of DISPLACEMENT.
-- ============================================================================

-- Step 1: Drop the existing generated column
ALTER TABLE companies DROP COLUMN sales_play;

-- Step 2: Re-add with expanded competitor list
ALTER TABLE companies ADD COLUMN sales_play VARCHAR(20) GENERATED ALWAYS AS (
    CASE
        -- Has competitor search = Displacement opportunity
        -- EXPANDED LIST: Now includes Doofinder, Cludo, AddSearch
        WHEN search_tech IN (
            'Elastic',
            'Solr',
            'Coveo',
            'Bloomreach',
            'SearchSpring',
            'Lucidworks',
            'Klevu',
            'Constructor',
            -- Additional competitors found by Search thread
            'Doofinder',
            'Cludo',
            'AddSearch'
        )
        THEN 'DISPLACEMENT'

        -- Has native/basic search OR no search = Greenfield opportunity
        ELSE 'GREENFIELD'
    END
) STORED;

-- Step 3: Recreate the index
DROP INDEX IF EXISTS idx_companies_sales_play;
CREATE INDEX idx_companies_sales_play ON companies(sales_play);

-- Step 4: Add these to tech_options reference table
INSERT INTO tech_options (galaxy, slug, display_name, partner_name, is_competitor, display_order) VALUES
    ('search', 'Doofinder', 'Doofinder', 'Doofinder', TRUE, 9),
    ('search', 'Cludo', 'Cludo', 'Cludo', TRUE, 10),
    ('search', 'AddSearch', 'AddSearch', 'AddSearch', TRUE, 11)
ON CONFLICT (galaxy, slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    partner_name = EXCLUDED.partner_name,
    is_competitor = EXCLUDED.is_competitor,
    display_order = EXCLUDED.display_order;

-- ============================================================================
-- VERIFICATION: After running this migration, check:
--   SELECT sales_play, COUNT(*) FROM companies GROUP BY sales_play;
-- Expected: DISPLACEMENT count should increase significantly
-- ============================================================================
