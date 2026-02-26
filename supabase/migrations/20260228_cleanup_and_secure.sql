-- PartnerForge: Cleanup Unused Tables + Enable Security
-- =============================================================================
-- SECURITY PRINCIPLE: RLS enabled on ALL tables. Only service_role can write.
-- Anon key gets read-only access for frontend queries.
-- =============================================================================

-- 1. DROP UNUSED LEGACY TABLES (from 001_initial_schema)
-- =============================================================================
DROP TABLE IF EXISTS lead_list_members CASCADE;
DROP TABLE IF EXISTS lead_lists CASCADE;
DROP TABLE IF EXISTS sync_jobs CASCADE;
DROP TABLE IF EXISTS customer_logos CASCADE;
DROP TABLE IF EXISTS proof_points CASCADE;
DROP TABLE IF EXISTS customer_quotes CASCADE;
DROP TABLE IF EXISTS case_studies CASCADE;
DROP TABLE IF EXISTS competitors CASCADE;
DROP TABLE IF EXISTS company_technologies CASCADE;
DROP TABLE IF EXISTS technologies CASCADE;

-- 2. ENABLE RLS ON ALL ACTIVE TABLES
-- =============================================================================
ALTER TABLE displacement_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_partners ENABLE ROW LEVEL SECURITY;

-- 3. DROP ANY EXISTING PERMISSIVE POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "Allow public read" ON displacement_targets;
DROP POLICY IF EXISTS "Allow public read" ON companies;
DROP POLICY IF EXISTS "Allow public read" ON partners;
DROP POLICY IF EXISTS "Allow public read" ON verticals;
DROP POLICY IF EXISTS "Allow public read" ON company_partners;
DROP POLICY IF EXISTS "Allow authenticated read" ON displacement_targets;
DROP POLICY IF EXISTS "Allow authenticated read" ON companies;
DROP POLICY IF EXISTS "Allow authenticated read" ON partners;
DROP POLICY IF EXISTS "Allow authenticated read" ON verticals;
DROP POLICY IF EXISTS "Allow authenticated read" ON company_partners;

-- 4. CREATE SECURE POLICIES
-- =============================================================================
-- Anon: Read-only access (for frontend queries until we have proper backend)
-- Service role bypasses RLS automatically

-- displacement_targets (main data table)
CREATE POLICY "anon_read_displacement_targets" ON displacement_targets
  FOR SELECT TO anon USING (true);

-- companies (normalized)
CREATE POLICY "anon_read_companies" ON companies
  FOR SELECT TO anon USING (true);

-- partners
CREATE POLICY "anon_read_partners" ON partners
  FOR SELECT TO anon USING (true);

-- verticals
CREATE POLICY "anon_read_verticals" ON verticals
  FOR SELECT TO anon USING (true);

-- company_partners
CREATE POLICY "anon_read_company_partners" ON company_partners
  FOR SELECT TO anon USING (true);

-- 5. VERIFY CLEANUP
-- =============================================================================
-- This should only show our 5 active tables + the view
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type IN ('BASE TABLE', 'VIEW')
ORDER BY table_type, table_name;
