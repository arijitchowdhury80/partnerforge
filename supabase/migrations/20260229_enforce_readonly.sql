-- PartnerForge: Enforce Read-Only Access for Anon
-- =============================================================================
-- PROBLEM: RLS with only SELECT policy still allows INSERT/UPDATE/DELETE
-- FIX: Explicitly deny write operations for anon role
-- =============================================================================

-- Drop the test record if it exists
DELETE FROM displacement_targets WHERE domain = 'test-hacker-12345.com';

-- 1. REVOKE direct write permissions from anon role
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE ON displacement_targets FROM anon;
REVOKE INSERT, UPDATE, DELETE ON companies FROM anon;
REVOKE INSERT, UPDATE, DELETE ON partners FROM anon;
REVOKE INSERT, UPDATE, DELETE ON verticals FROM anon;
REVOKE INSERT, UPDATE, DELETE ON company_partners FROM anon;

-- 2. Ensure RLS is enabled (belt and suspenders)
-- =============================================================================
ALTER TABLE displacement_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE partners FORCE ROW LEVEL SECURITY;
ALTER TABLE verticals FORCE ROW LEVEL SECURITY;
ALTER TABLE company_partners FORCE ROW LEVEL SECURITY;

-- 3. GRANT only SELECT to anon
-- =============================================================================
GRANT SELECT ON displacement_targets TO anon;
GRANT SELECT ON companies TO anon;
GRANT SELECT ON partners TO anon;
GRANT SELECT ON verticals TO anon;
GRANT SELECT ON company_partners TO anon;

-- 4. Verify table permissions
-- =============================================================================
SELECT
  tablename,
  has_table_privilege('anon', tablename, 'SELECT') as can_select,
  has_table_privilege('anon', tablename, 'INSERT') as can_insert,
  has_table_privilege('anon', tablename, 'UPDATE') as can_update,
  has_table_privilege('anon', tablename, 'DELETE') as can_delete
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('displacement_targets', 'companies', 'partners', 'verticals', 'company_partners');
