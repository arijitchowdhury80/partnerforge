-- ============================================================================
-- UPDATE SALES_PLAY GENERATED COLUMN
-- ============================================================================
-- Adds new search competitor technologies to the DISPLACEMENT classification
-- ============================================================================

-- Drop and recreate the column with expanded tech list
ALTER TABLE companies DROP COLUMN sales_play;

ALTER TABLE companies ADD COLUMN sales_play VARCHAR(20) GENERATED ALWAYS AS (
    CASE
        -- Has competitor search = Displacement opportunity
        -- Includes both enterprise search and e-commerce site search competitors
        WHEN search_tech IN (
            -- Enterprise/Open Source (from Domain API enrichment)
            'Elastic', 'Solr', 'Lucidworks',
            -- Enterprise Commercial
            'Coveo', 'Bloomreach', 'SearchSpring', 'Klevu', 'Constructor',
            -- Site/E-commerce Search (from Lists API)
            'Swiftype', 'Doofinder', 'Yext', 'Cludo', 'Searchanise', 'AddSearch', 'Sooqr',
            -- Additional competitors
            'Attraqt', 'Hawksearch', 'Sajari', 'Typesense', 'Meilisearch'
        )
        THEN 'DISPLACEMENT'

        -- Has native/basic search OR no search = Greenfield opportunity
        ELSE 'GREENFIELD'
    END
) STORED;

-- Verify the update
SELECT
    sales_play,
    COUNT(*) as count
FROM companies
GROUP BY sales_play;
