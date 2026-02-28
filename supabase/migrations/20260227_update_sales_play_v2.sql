-- ============================================================================
-- UPDATE SALES_PLAY COMPUTED COLUMN
-- ============================================================================
-- Adds new search competitors discovered in BuiltWith Lists API:
-- - Swiftype (Elastic's hosted search)
-- - Doofinder (E-commerce search)
-- - Yext (Local/answers search)
-- - Cludo (Site search)
-- - Searchanise (E-commerce search)
-- - AddSearch (Site search)
-- - Sooqr (E-commerce search)
-- ============================================================================

-- Drop the old computed column
ALTER TABLE companies DROP COLUMN IF EXISTS sales_play;

-- Recreate with expanded search tech list
ALTER TABLE companies ADD COLUMN sales_play VARCHAR(20) GENERATED ALWAYS AS (
    CASE
        -- Has competitor search = Displacement opportunity
        WHEN search_tech IN (
            -- Original competitors
            'Elastic', 'Solr', 'Coveo', 'Bloomreach', 'SearchSpring',
            'Lucidworks', 'Klevu', 'Constructor',
            -- New competitors from BuiltWith Lists API (2026-02-27)
            'Swiftype', 'Doofinder', 'Yext', 'Cludo',
            'Searchanise', 'AddSearch', 'Sooqr'
        )
        THEN 'DISPLACEMENT'

        -- Has native/basic search OR no search = Greenfield opportunity
        ELSE 'GREENFIELD'
    END
) STORED;

-- Recreate index
DROP INDEX IF EXISTS idx_companies_sales_play;
CREATE INDEX idx_companies_sales_play ON companies(sales_play);

-- Comment
COMMENT ON COLUMN companies.sales_play IS
'Computed sales play based on search_tech. DISPLACEMENT = has competitor search. GREENFIELD = no search or native. Updated 2026-02-27 to include Swiftype, Doofinder, Yext, Cludo, Searchanise, AddSearch, Sooqr.';
