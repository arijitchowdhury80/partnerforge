-- ============================================
-- Migration: 20260226_allow_upload_inserts.sql
-- Purpose: Allow frontend upload functionality
-- Description: Adds RLS policy to allow controlled INSERTs via anon key
-- ============================================

-- ============================================
-- DISPLACEMENT_TARGETS - Allow INSERT for uploads
-- ============================================

-- Drop any existing insert policy (if any)
DROP POLICY IF EXISTS "anon_insert_targets" ON displacement_targets;

-- Allow anon to INSERT new displacement targets
-- This enables the upload feature while maintaining data integrity:
-- 1. Only INSERT allowed (no UPDATE/DELETE)
-- 2. domain is required (enforced by table constraint)
-- 3. Default values applied by database (enrichment_level, created_at)
-- 4. RLS ensures we can only ADD data, not modify existing
CREATE POLICY "anon_insert_targets" ON displacement_targets
  FOR INSERT TO anon
  WITH CHECK (
    -- Require domain to be set
    domain IS NOT NULL AND
    domain <> '' AND
    -- Basic domain validation (contains a dot)
    domain LIKE '%.%'
  );

-- Add upsert support via unique constraint on domain (if not exists)
-- This allows "ON CONFLICT DO NOTHING" for duplicate handling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'displacement_targets_domain_key'
    AND conrelid = 'displacement_targets'::regclass
  ) THEN
    -- Only add if not already present
    ALTER TABLE displacement_targets ADD CONSTRAINT displacement_targets_domain_key UNIQUE (domain);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;

-- ============================================
-- Add upload tracking columns (if not exist)
-- ============================================

-- Add columns to track upload source
DO $$
BEGIN
  -- upload_source: Where the data came from (salesforce, demandbase, 6sense, manual)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'upload_source'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN upload_source TEXT;
  END IF;

  -- upload_list_id: ID of the upload batch
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'upload_list_id'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN upload_list_id TEXT;
  END IF;

  -- upload_list_name: Name given to the upload batch
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'displacement_targets' AND column_name = 'upload_list_name'
  ) THEN
    ALTER TABLE displacement_targets ADD COLUMN upload_list_name TEXT;
  END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
-- This migration:
-- 1. Allows anon INSERT on displacement_targets with domain validation
-- 2. Adds unique constraint on domain for upsert support
-- 3. Adds upload tracking columns (source, list_id, list_name)
--
-- Security Notes:
-- - Only INSERT allowed (no UPDATE/DELETE via anon)
-- - Domain must be set and valid (contains a dot)
-- - Duplicates are handled via "ON CONFLICT DO NOTHING"
-- - All other RLS policies remain unchanged
-- ============================================
