-- ============================================================================
-- Hiring Signals Migration
-- Adds hiring signal tracking to displacement_targets
-- ============================================================================

-- Add hiring signal columns to displacement_targets
ALTER TABLE displacement_targets
ADD COLUMN IF NOT EXISTS hiring_signal_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_signal_strength VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_total_jobs INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_relevant_jobs INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_tier_breakdown JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_category_breakdown JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_top_jobs JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hiring_fetched_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for filtering by hiring signal
CREATE INDEX IF NOT EXISTS idx_displacement_hiring_score
ON displacement_targets(hiring_signal_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_displacement_hiring_strength
ON displacement_targets(hiring_signal_strength);

-- Add check constraint for signal strength
ALTER TABLE displacement_targets
ADD CONSTRAINT chk_hiring_signal_strength
CHECK (hiring_signal_strength IS NULL OR hiring_signal_strength IN ('strong', 'moderate', 'weak', 'none'));

-- Comment
COMMENT ON COLUMN displacement_targets.hiring_signal_score IS 'Hiring signal score 0-100 based on job postings matching target personas';
COMMENT ON COLUMN displacement_targets.hiring_signal_strength IS 'Signal strength: strong (70+), moderate (40-69), weak (15-39), none (<15)';
COMMENT ON COLUMN displacement_targets.hiring_tier_breakdown IS 'JSON: {tier_1: N, tier_2: N, tier_3: N} - decision makers, influencers, implementers';
COMMENT ON COLUMN displacement_targets.hiring_category_breakdown IS 'JSON: {search: N, e-commerce: N, engineering: N, ...}';
COMMENT ON COLUMN displacement_targets.hiring_top_jobs IS 'JSON array of top 20 relevant job postings';
