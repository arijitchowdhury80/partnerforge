-- PartnerForge: Final Cleanup - Drop v2 View & Ensure Security
-- =============================================================================

-- 1. DROP the displacement_targets_v2 view
DROP VIEW IF EXISTS displacement_targets_v2 CASCADE;

-- 2. Verify RLS is enabled on main table
ALTER TABLE displacement_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE displacement_targets FORCE ROW LEVEL SECURITY;

-- 3. Ensure anon can only SELECT
REVOKE ALL ON displacement_targets FROM anon;
GRANT SELECT ON displacement_targets TO anon;

-- 4. Drop any existing policies and recreate clean ones
DROP POLICY IF EXISTS "anon_read_displacement_targets" ON displacement_targets;
DROP POLICY IF EXISTS "Allow public read" ON displacement_targets;
DROP POLICY IF EXISTS "Allow authenticated read" ON displacement_targets;

-- 5. Create single clean read policy for anon
CREATE POLICY "anon_select_only" ON displacement_targets
  FOR SELECT TO anon USING (true);
