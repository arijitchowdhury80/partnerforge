-- Update sales_play generated column with expanded search tech list
-- Includes all search competitors from both Lists API and Domain API enrichment

-- Drop existing column
ALTER TABLE companies DROP COLUMN IF EXISTS sales_play;

-- Recreate with expanded search tech list
ALTER TABLE companies ADD COLUMN sales_play VARCHAR(20) GENERATED ALWAYS AS (
    CASE
        WHEN search_tech IN (
            -- Enterprise search (Domain API)
            'Elastic', 'Solr', 'Lucidworks',
            'Coveo', 'Bloomreach', 'SearchSpring', 'Klevu', 'Constructor',
            -- Lists API search competitors
            'Swiftype', 'Doofinder', 'Yext', 'Cludo',
            'Searchanise', 'AddSearch', 'Sooqr'
        )
        THEN 'DISPLACEMENT'
        ELSE 'GREENFIELD'
    END
) STORED;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_companies_sales_play ON companies(sales_play);

-- Verify the update
SELECT
    sales_play,
    COUNT(*) as count
FROM companies
GROUP BY sales_play
ORDER BY count DESC;
