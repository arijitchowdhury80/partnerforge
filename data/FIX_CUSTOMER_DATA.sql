-- Arian Data Fix: Known Algolia Customers
-- Run these in Supabase SQL Editor
-- Generated: 2026-02-26

-- STEP 1: Mark as Algolia customers in companies table
UPDATE companies
SET is_algolia_customer = true,
    updated_at = NOW()
WHERE domain IN (
    'gap.com',
    'johnlewis.com',
    'underarmour.com',
    'toyota.com',
    'ulta.com',
    'microchip.com'
);

-- STEP 2: Remove from displacement_targets table
DELETE FROM displacement_targets
WHERE domain IN (
    'gap.com',
    'johnlewis.com',
    'underarmour.com',
    'toyota.com',
    'ulta.com',
    'microchip.com'
);

-- STEP 3: Verify the fix
SELECT 'Companies marked as customers:' as info;
SELECT domain, name, is_algolia_customer
FROM companies
WHERE is_algolia_customer = true;

SELECT 'Remaining displacement targets:' as info;
SELECT COUNT(*) as total_targets FROM displacement_targets;

-- STEP 4: Add constraint to prevent future duplicates (optional)
-- ALTER TABLE displacement_targets
-- ADD CONSTRAINT chk_not_algolia_customer
-- CHECK (domain NOT IN (SELECT domain FROM companies WHERE is_algolia_customer = true));
