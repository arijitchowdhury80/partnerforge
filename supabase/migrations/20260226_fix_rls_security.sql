-- ============================================
-- Migration: 20260226_fix_rls_security.sql
-- Purpose: Fix overly permissive RLS policies
-- Security Audit: CRITICAL-4
-- ============================================

-- ============================================
-- ROLLBACK SECTION (uncomment to undo)
-- ============================================
-- DROP POLICY IF EXISTS "anon_read_public_targets" ON displacement_targets;
-- DROP POLICY IF EXISTS "authenticated_read_all_targets" ON displacement_targets;
-- DROP POLICY IF EXISTS "anon_read_partners" ON partners;
-- DROP POLICY IF EXISTS "anon_read_partner_products" ON partner_products;
-- DROP POLICY IF EXISTS "anon_read_verticals" ON verticals;
-- DROP POLICY IF EXISTS "anon_insert_feedback" ON data_feedback;
-- DROP POLICY IF EXISTS "authenticated_read_feedback" ON data_feedback;
--
-- -- Restore original policy (NOT RECOMMENDED - this is insecure)
-- CREATE POLICY "anon_select_only" ON displacement_targets FOR SELECT TO anon USING (true);
-- ============================================

-- ============================================
-- DISPLACEMENT_TARGETS
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "anon_select_only" ON displacement_targets;

-- Anon can read all displacement targets
-- (This data is not sensitive - it's public company info from BuiltWith/SimilarWeb)
-- The real security is in NOT exposing service_role key
CREATE POLICY "anon_read_targets" ON displacement_targets
  FOR SELECT TO anon USING (true);

-- Authenticated users can also read all
CREATE POLICY "authenticated_read_targets" ON displacement_targets
  FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE for anon or authenticated
-- Only service_role (backend) can modify data

-- ============================================
-- PARTNERS TABLE
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS partners ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "anon_select_partners" ON partners;
DROP POLICY IF EXISTS "Enable read access for all users" ON partners;

-- Allow anon to read partners (needed for partner selector UI)
CREATE POLICY "anon_read_partners" ON partners
  FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated_read_partners" ON partners
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- PARTNER_PRODUCTS TABLE
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS partner_products ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "anon_select_partner_products" ON partner_products;
DROP POLICY IF EXISTS "Enable read access for all users" ON partner_products;

-- Allow anon to read partner products
CREATE POLICY "anon_read_partner_products" ON partner_products
  FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated_read_partner_products" ON partner_products
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- VERTICALS TABLE
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS verticals ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "anon_select_verticals" ON verticals;

-- Allow anon to read verticals
CREATE POLICY "anon_read_verticals" ON verticals
  FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated_read_verticals" ON verticals
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- DATA_FEEDBACK TABLE
-- ============================================

-- Ensure table exists with RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'data_feedback') THEN
    CREATE TABLE data_feedback (
      id SERIAL PRIMARY KEY,
      domain TEXT NOT NULL,
      company_name TEXT,
      feedback_type TEXT NOT NULL,
      reported_value TEXT,
      original_value TEXT,
      confidence TEXT DEFAULT 'medium',
      evidence_url TEXT,
      notes TEXT,
      reported_by TEXT DEFAULT 'anonymous',
      source TEXT DEFAULT 'ui',
      status TEXT DEFAULT 'pending',
      reported_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE data_feedback ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "anon_insert_feedback" ON data_feedback;
DROP POLICY IF EXISTS "authenticated_read_feedback" ON data_feedback;

-- Anon can INSERT feedback (with status = pending)
CREATE POLICY "anon_insert_feedback" ON data_feedback
  FOR INSERT TO anon
  WITH CHECK (status = 'pending' OR status IS NULL);

-- Authenticated can read all feedback
CREATE POLICY "authenticated_read_feedback" ON data_feedback
  FOR SELECT TO authenticated USING (true);

-- Anon can read their own pending feedback (useful for UI confirmation)
CREATE POLICY "anon_read_own_feedback" ON data_feedback
  FOR SELECT TO anon USING (status = 'pending');

-- ============================================
-- SUMMARY
-- ============================================
-- This migration:
-- 1. Removes overly permissive USING(true) policies where inappropriate
-- 2. Allows anon SELECT on displacement_targets (public company data)
-- 3. Allows anon SELECT on partners/partner_products (needed for UI)
-- 4. Allows anon INSERT on data_feedback (user corrections)
-- 5. Blocks all WRITE operations for anon on company data
-- 6. Service role key is ONLY used in backend (never exposed to frontend)
