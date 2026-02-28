-- ============================================================================
-- ADD HYPERSCALER GALAXY (5th Galaxy: Cloud Providers)
-- ============================================================================
-- AWS and Azure cloud provider data for each account.
-- This enables partner co-sell motions with AWS and Microsoft.
-- ============================================================================

-- Add the hyperscaler column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cloud_tech VARCHAR(50);
-- Values: 'AWS', 'Azure', NULL (GCP excluded - Google is a competitor)

-- Comment the column
COMMENT ON COLUMN companies.cloud_tech IS
'Hyperscaler Galaxy: Cloud partner (AWS or Azure only). GCP excluded - Google is a competitor. Source: BuiltWith.';

-- Add index
CREATE INDEX IF NOT EXISTS idx_companies_cloud ON companies(cloud_tech) WHERE cloud_tech IS NOT NULL;

-- ============================================================================
-- Add cloud options to tech_options
-- ============================================================================
-- Only AWS and Azure - GCP is a competitor (Google Cloud Search)
INSERT INTO tech_options (galaxy, slug, display_name, partner_name, is_competitor, display_order) VALUES
    ('cloud', 'AWS', 'Amazon Web Services', 'AWS', FALSE, 1),
    ('cloud', 'Azure', 'Microsoft Azure', 'Microsoft', FALSE, 2)
ON CONFLICT (galaxy, slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    partner_name = EXCLUDED.partner_name,
    display_order = EXCLUDED.display_order;

-- ============================================================================
-- Update galaxy_summary view to include cloud
-- ============================================================================
CREATE OR REPLACE VIEW galaxy_summary AS
SELECT
    'cms' as galaxy,
    cms_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE cms_tech IS NOT NULL
GROUP BY cms_tech

UNION ALL

SELECT
    'commerce' as galaxy,
    commerce_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE commerce_tech IS NOT NULL
GROUP BY commerce_tech

UNION ALL

SELECT
    'martech' as galaxy,
    martech_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE martech_tech IS NOT NULL
GROUP BY martech_tech

UNION ALL

SELECT
    'search' as galaxy,
    search_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE search_tech IS NOT NULL
GROUP BY search_tech

UNION ALL

SELECT
    'cloud' as galaxy,
    cloud_tech as tech,
    COUNT(*) as company_count,
    COUNT(*) FILTER (WHERE sales_play = 'DISPLACEMENT') as displacement_count,
    COUNT(*) FILTER (WHERE sales_play = 'GREENFIELD') as greenfield_count
FROM companies
WHERE cloud_tech IS NOT NULL
GROUP BY cloud_tech;

-- ============================================================================
-- TABLE COMMENTS UPDATE
-- ============================================================================
COMMENT ON TABLE companies IS
'Layer 0: The Partner Tech Galaxy. All NON-Algolia companies with their tech stack from BuiltWith.
Algolia customers are excluded from this table - this is prospects only.
Columns: domain, company_name, cms_tech, commerce_tech, martech_tech, search_tech, cloud_tech.
Computed: tech_cohort (JACKPOT/HIGH/MEDIUM/BASE), sales_play (DISPLACEMENT/GREENFIELD).';
