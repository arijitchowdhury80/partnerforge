-- ============================================================================
-- Enrich Unified Industries Table with ICP Data
--
-- This adds ICP-derived scoring signals to the existing industries table,
-- creating a composite that combines:
-- - Firmographic classification (from Demandbase/ZoomInfo)
-- - ICP evidence strength (from customer evidence)
-- ============================================================================

-- 1. Add ICP columns to industries table
ALTER TABLE industries ADD COLUMN IF NOT EXISTS icp_confidence TEXT DEFAULT 'NEUTRAL';
ALTER TABLE industries ADD COLUMN IF NOT EXISTS icp_proof_points INTEGER DEFAULT 0;
ALTER TABLE industries ADD COLUMN IF NOT EXISTS icp_keywords TEXT[];
ALTER TABLE industries ADD COLUMN IF NOT EXISTS icp_notes TEXT;

-- Add check constraint for confidence values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'industries_icp_confidence_check'
  ) THEN
    ALTER TABLE industries ADD CONSTRAINT industries_icp_confidence_check
      CHECK (icp_confidence IN ('HIGH', 'MEDIUM', 'LOW', 'NEUTRAL'));
  END IF;
END $$;

-- ============================================================================
-- 2. Update industries with ICP data
--
-- Mapping logic:
-- - HIGH: Strong evidence (50+ proof points) - Retail covers Fashion + Grocery + E-commerce
-- - MEDIUM: Some evidence (1-49 proof points)
-- - LOW: Logo-only evidence (0 proof points but customers exist)
-- - NEUTRAL: No ICP data (not penalized, just no boost)
-- ============================================================================

-- RETAIL (#5) - Maps to Fashion (53) + Grocery (28) + Retail E-commerce (41) = 122 proof points
UPDATE industries SET
  icp_confidence = 'HIGH',
  icp_proof_points = 122,
  icp_keywords = ARRAY['fashion', 'apparel', 'clothing', 'streetwear', 'luxury', 'grocery', 'food', 'supermarket', 'ecommerce', 'e-commerce', 'online retail', 'marketplace'],
  icp_notes = 'Aggregates Fashion/Apparel (53), Grocery/Food (28), Retail E-commerce (41). Sub-vertical detection via keywords.'
WHERE slug = 'retail';

-- CONSUMER PRODUCT MANUFACTURING (#6) - Also covers fashion brands
UPDATE industries SET
  icp_confidence = 'HIGH',
  icp_proof_points = 53,
  icp_keywords = ARRAY['fashion', 'apparel', 'clothing', 'footwear', 'accessories', 'sportswear', 'athletic'],
  icp_notes = 'Fashion brands often classified here. Maps to Fashion/Apparel ICP (53 proof points).'
WHERE slug = 'consumer-product-manufacturing';

-- FOOD AND BEVERAGE (#23) - Maps to Grocery/Food
UPDATE industries SET
  icp_confidence = 'HIGH',
  icp_proof_points = 28,
  icp_keywords = ARRAY['grocery', 'food', 'beverage', 'supermarket', 'restaurant', 'meal kit', 'delivery'],
  icp_notes = 'Maps to Grocery/Food ICP (28 proof points).'
WHERE slug = 'food-beverage';

-- MEDIA (#8) - Maps to Media/Publishing
UPDATE industries SET
  icp_confidence = 'MEDIUM',
  icp_proof_points = 7,
  icp_keywords = ARRAY['media', 'publishing', 'news', 'content', 'streaming', 'entertainment'],
  icp_notes = 'Maps to Media/Publishing ICP (7 proof points). MEDIUM confidence.'
WHERE slug = 'media';

-- COMPUTER SOFTWARE (#1) - Maps to SaaS
UPDATE industries SET
  icp_confidence = 'LOW',
  icp_proof_points = 0,
  icp_keywords = ARRAY['saas', 'software', 'platform', 'cloud', 'api', 'developer'],
  icp_notes = 'Maps to SaaS ICP. LOW confidence - customers exist but no proof points in evidence file.'
WHERE slug = 'computer-software';

-- HOSPITALS AND HEALTHCARE (#13) - Maps to Healthcare
UPDATE industries SET
  icp_confidence = 'MEDIUM',
  icp_proof_points = 1,
  icp_keywords = ARRAY['healthcare', 'health', 'medical', 'hospital', 'pharmacy', 'pharmaceutical'],
  icp_notes = 'Maps to Healthcare ICP (1 proof point). MEDIUM confidence.'
WHERE slug = 'hospitals-healthcare';

-- CORPORATE SERVICES (#15) - Potential B2B E-commerce
UPDATE industries SET
  icp_confidence = 'MEDIUM',
  icp_proof_points = 10,
  icp_keywords = ARRAY['b2b', 'wholesale', 'distribution', 'procurement', 'enterprise'],
  icp_notes = 'May include B2B E-commerce use cases (10 proof points).'
WHERE slug = 'corporate-services';

-- LEISURE, SPORTS AND RECREATION (#9) - Fitness/Sportswear brands
UPDATE industries SET
  icp_confidence = 'MEDIUM',
  icp_proof_points = 15,
  icp_keywords = ARRAY['sports', 'fitness', 'athletic', 'outdoor', 'recreation'],
  icp_notes = 'Includes sportswear/fitness brands (subset of Fashion).'
WHERE slug = 'leisure-sports-recreation';

-- ============================================================================
-- 3. Create view for ICP-enhanced industry lookup
-- ============================================================================

CREATE OR REPLACE VIEW industries_with_icp AS
SELECT
  i.*,
  CASE
    WHEN i.icp_confidence = 'HIGH' THEN 20
    WHEN i.icp_confidence = 'MEDIUM' THEN 10
    WHEN i.icp_confidence = 'LOW' THEN 5
    ELSE 0
  END as icp_score_boost,
  CASE
    WHEN i.icp_proof_points >= 50 THEN 'GOLD'
    WHEN i.icp_proof_points >= 10 THEN 'SILVER'
    WHEN i.icp_proof_points > 0 THEN 'BRONZE'
    ELSE NULL
  END as icp_tier
FROM industries i
ORDER BY i.icp_proof_points DESC NULLS LAST, i.display_order;

-- ============================================================================
-- 4. Summary of ICP enrichment
-- ============================================================================

-- After running this migration, query to verify:
-- SELECT name, icp_confidence, icp_proof_points, icp_keywords
-- FROM industries
-- WHERE icp_confidence != 'NEUTRAL'
-- ORDER BY icp_proof_points DESC;
