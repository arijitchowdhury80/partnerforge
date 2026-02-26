-- PartnerForge: User Feedback System
-- Self-sufficient data verification via user feedback loop
--
-- Design principle: System relies on data sources + user verification
-- No static exclusion lists - everything is database-driven
--
-- Run in Supabase SQL Editor

-- =============================================================================
-- TABLE 1: data_feedback - User corrections and verifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS data_feedback (
    id SERIAL PRIMARY KEY,

    -- What's being reported on
    domain TEXT NOT NULL,
    company_name TEXT,

    -- Feedback type
    feedback_type TEXT NOT NULL CHECK (feedback_type IN (
        'is_algolia_customer',      -- "This company IS an Algolia customer"
        'not_algolia_customer',     -- "This company is NOT an Algolia customer"
        'incorrect_company_name',   -- "Company name is wrong"
        'incorrect_vertical',       -- "Vertical/industry is wrong"
        'duplicate_entry',          -- "This is a duplicate of another record"
        'invalid_target',           -- "This should not be a target (defunct, etc.)"
        'data_correction',          -- Generic data correction
        'positive_signal',          -- "This is a good lead"
        'negative_signal'           -- "This is not a good lead"
    )),

    -- Feedback details
    reported_value TEXT,           -- What user says is correct
    original_value TEXT,           -- What we had before
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
    evidence_url TEXT,             -- Link to proof (case study, BuiltWith, etc.)
    notes TEXT,

    -- Who and when
    reported_by TEXT,              -- User email or identifier
    reported_at TIMESTAMPTZ DEFAULT NOW(),

    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'applied', 'rejected')),
    processed_at TIMESTAMPTZ,
    processed_by TEXT,

    -- For tracking
    source TEXT DEFAULT 'ui',      -- 'ui', 'api', 'enrichment', 'manual'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_feedback_domain ON data_feedback(domain);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON data_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON data_feedback(feedback_type);

-- =============================================================================
-- VIEW: verified_algolia_customers - All confirmed Algolia customers
-- =============================================================================
CREATE OR REPLACE VIEW verified_algolia_customers AS
SELECT DISTINCT
    domain,
    company_name,
    reported_by,
    reported_at,
    evidence_url,
    notes
FROM data_feedback
WHERE feedback_type = 'is_algolia_customer'
  AND status IN ('verified', 'applied')
ORDER BY domain;

-- =============================================================================
-- FUNCTION: process_customer_feedback
-- Automatically updates displacement_targets and companies tables
-- =============================================================================
CREATE OR REPLACE FUNCTION process_customer_feedback()
RETURNS TRIGGER AS $$
BEGIN
    -- When feedback is marked as 'applied', update the relevant tables
    IF NEW.status = 'applied' AND OLD.status != 'applied' THEN

        -- If marking as Algolia customer
        IF NEW.feedback_type = 'is_algolia_customer' THEN
            -- Update companies table
            UPDATE companies
            SET is_algolia_customer = true,
                updated_at = NOW()
            WHERE domain = NEW.domain;

            -- Remove from displacement_targets
            DELETE FROM displacement_targets
            WHERE domain = NEW.domain;

            NEW.processed_at = NOW();
        END IF;

        -- If marking as NOT Algolia customer (re-adding to targets)
        IF NEW.feedback_type = 'not_algolia_customer' THEN
            UPDATE companies
            SET is_algolia_customer = false,
                updated_at = NOW()
            WHERE domain = NEW.domain;

            NEW.processed_at = NOW();
        END IF;

        -- If invalid target
        IF NEW.feedback_type = 'invalid_target' THEN
            DELETE FROM displacement_targets
            WHERE domain = NEW.domain;

            NEW.processed_at = NOW();
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trigger_process_feedback ON data_feedback;
CREATE TRIGGER trigger_process_feedback
    BEFORE UPDATE ON data_feedback
    FOR EACH ROW
    EXECUTE FUNCTION process_customer_feedback();

-- =============================================================================
-- RLS Policies - Allow anyone to submit feedback, only admins can process
-- =============================================================================
ALTER TABLE data_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback
CREATE POLICY "Anyone can submit feedback" ON data_feedback
    FOR INSERT WITH CHECK (true);

-- Anyone can view feedback
CREATE POLICY "Anyone can view feedback" ON data_feedback
    FOR SELECT USING (true);

-- Only service_role can update (process feedback)
-- This would need to be adjusted based on your auth setup

-- =============================================================================
-- SAMPLE DATA - Known corrections from user feedback
-- =============================================================================
-- Note: These are submitted as 'pending' - an admin needs to verify and set status='applied'

INSERT INTO data_feedback (domain, company_name, feedback_type, reported_value, confidence, evidence_url, notes, reported_by, source)
VALUES
    ('gap.com', 'Gap Inc.', 'is_algolia_customer', 'true', 'high', NULL, 'User reported - BuiltWith does not detect', 'arijit', 'manual'),
    ('johnlewis.com', 'John Lewis Partnership', 'is_algolia_customer', 'true', 'high', NULL, 'User reported - BuiltWith does not detect', 'arijit', 'manual'),
    ('underarmour.com', 'Under Armour', 'is_algolia_customer', 'true', 'high', NULL, 'User reported', 'arijit', 'manual')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- HELPER: Quick approve pending feedback (run manually as admin)
-- =============================================================================
-- UPDATE data_feedback SET status = 'applied' WHERE status = 'pending';

-- =============================================================================
-- VIEW: pending_feedback - Items needing review
-- =============================================================================
CREATE OR REPLACE VIEW pending_feedback AS
SELECT
    id,
    domain,
    company_name,
    feedback_type,
    reported_value,
    confidence,
    evidence_url,
    notes,
    reported_by,
    reported_at
FROM data_feedback
WHERE status = 'pending'
ORDER BY reported_at DESC;

-- =============================================================================
-- STATS: Feedback summary
-- =============================================================================
CREATE OR REPLACE VIEW feedback_stats AS
SELECT
    feedback_type,
    status,
    COUNT(*) as count,
    MAX(reported_at) as latest
FROM data_feedback
GROUP BY feedback_type, status
ORDER BY feedback_type, status;
