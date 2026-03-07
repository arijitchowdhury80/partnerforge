-- Migration 011: Disable RLS on Backend Tables
-- For backend-only application with no direct client access to Supabase
-- This is SECURE because:
-- 1. Backend is the only consumer of Supabase
-- 2. No client-side code has Supabase credentials
-- 3. Backend uses anon key with limited scope (not service_role)

-- Core tables
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE audits DISABLE ROW LEVEL SECURITY;

-- Enrichment tables
ALTER TABLE company_traffic DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_financials DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_technologies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_competitors DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_executives DISABLE ROW LEVEL SECURITY;
ALTER TABLE executive_quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_social_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_social_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE buying_committee DISABLE ROW LEVEL SECURITY;
ALTER TABLE intent_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_hiring DISABLE ROW LEVEL SECURITY;

-- Activity tables
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_error_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_freshness DISABLE ROW LEVEL SECURITY;

-- Search audit tables
ALTER TABLE search_audit_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE search_audit_screenshots DISABLE ROW LEVEL SECURITY;

-- Partner Intel tables
ALTER TABLE displacement_opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE partner_engagement_log DISABLE ROW LEVEL SECURITY;

-- Strategic analysis tables
ALTER TABLE company_strategic_analysis DISABLE ROW LEVEL SECURITY;
