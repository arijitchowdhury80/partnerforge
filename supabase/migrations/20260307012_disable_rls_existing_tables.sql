-- Disable RLS on existing tables only
-- Skip tables that don't exist yet

-- Core tables (always exist)
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE audits DISABLE ROW LEVEL SECURITY;

-- Enrichment tables (should exist from earlier migrations)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_traffic') THEN
    ALTER TABLE company_traffic DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_financials') THEN
    ALTER TABLE company_financials DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_technologies') THEN
    ALTER TABLE company_technologies DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_competitors') THEN
    ALTER TABLE company_competitors DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_executives') THEN
    ALTER TABLE company_executives DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'executive_quotes') THEN
    ALTER TABLE executive_quotes DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_social_profiles') THEN
    ALTER TABLE company_social_profiles DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_social_posts') THEN
    ALTER TABLE company_social_posts DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buying_committee') THEN
    ALTER TABLE buying_committee DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'intent_signals') THEN
    ALTER TABLE intent_signals DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_hiring') THEN
    ALTER TABLE company_hiring DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') THEN
    ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_call_log') THEN
    ALTER TABLE api_call_log DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_error_log') THEN
    ALTER TABLE api_error_log DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'data_freshness') THEN
    ALTER TABLE data_freshness DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'displacement_opportunities') THEN
    ALTER TABLE displacement_opportunities DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_engagement_log') THEN
    ALTER TABLE partner_engagement_log DISABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_strategic_analysis') THEN
    ALTER TABLE company_strategic_analysis DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
