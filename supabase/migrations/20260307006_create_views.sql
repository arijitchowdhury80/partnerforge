-- Migration 006: Create Views for Latest Data
-- Description: Simplify queries for "current state" vs "historical state"
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: All previous migrations

-- =============================================================================
-- VIEWS FOR "LATEST" DATA (Current state per company)
-- =============================================================================

-- =============================================================================
-- 1. LATEST AUDITS (Most recent audit per company)
-- =============================================================================
CREATE VIEW latest_audits AS
SELECT DISTINCT ON (company_id)
  *
FROM audits
WHERE deleted_at IS NULL
ORDER BY company_id, created_at DESC;

COMMENT ON VIEW latest_audits IS 'Most recent audit per company - simplifies "current state" queries';

-- =============================================================================
-- 2. LATEST TRAFFIC DATA
-- =============================================================================
CREATE VIEW company_traffic_latest AS
SELECT DISTINCT ON (t.company_id, t.month)
  t.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_traffic t
JOIN audits a ON t.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY t.company_id, t.month, a.created_at DESC;

COMMENT ON VIEW company_traffic_latest IS 'Latest traffic metrics per company per month';

-- =============================================================================
-- 3. LATEST FINANCIALS
-- =============================================================================
CREATE VIEW company_financials_latest AS
SELECT DISTINCT ON (f.company_id, f.fiscal_year, f.fiscal_quarter)
  f.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_financials f
JOIN audits a ON f.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY f.company_id, f.fiscal_year DESC, f.fiscal_quarter DESC, a.created_at DESC;

COMMENT ON VIEW company_financials_latest IS 'Latest financial data per company per period';

-- =============================================================================
-- 4. LATEST TECH STACK
-- =============================================================================
CREATE VIEW company_technologies_latest AS
SELECT DISTINCT ON (t.company_id, t.technology_name)
  t.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_technologies t
JOIN audits a ON t.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY t.company_id, t.technology_name, a.created_at DESC;

COMMENT ON VIEW company_technologies_latest IS 'Latest tech stack per company';

-- =============================================================================
-- 5. LATEST COMPETITORS
-- =============================================================================
CREATE VIEW company_competitors_latest AS
SELECT DISTINCT ON (c.company_id, c.competitor_domain)
  c.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_competitors c
JOIN audits a ON c.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY c.company_id, c.competitor_domain, a.created_at DESC;

COMMENT ON VIEW company_competitors_latest IS 'Latest competitor list per company';

-- =============================================================================
-- 6. LATEST EXECUTIVES
-- =============================================================================
CREATE VIEW company_executives_latest AS
SELECT DISTINCT ON (e.company_id, e.full_name)
  e.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_executives e
JOIN audits a ON e.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY e.company_id, e.full_name, a.created_at DESC;

COMMENT ON VIEW company_executives_latest IS 'Latest executive team per company';

-- =============================================================================
-- 7. LATEST SOCIAL PROFILES
-- =============================================================================
CREATE VIEW company_social_profiles_latest AS
SELECT DISTINCT ON (s.company_id, s.platform)
  s.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_social_profiles s
JOIN audits a ON s.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY s.company_id, s.platform, a.created_at DESC;

COMMENT ON VIEW company_social_profiles_latest IS 'Latest social media profiles per company';

-- =============================================================================
-- 8. LATEST BUYING COMMITTEE
-- =============================================================================
CREATE VIEW buying_committee_latest AS
SELECT DISTINCT ON (b.company_id, b.full_name)
  b.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM buying_committee b
JOIN audits a ON b.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY b.company_id, b.full_name, a.created_at DESC;

COMMENT ON VIEW buying_committee_latest IS 'Latest buying committee per company';

-- =============================================================================
-- 9. LATEST HIRING DATA
-- =============================================================================
CREATE VIEW company_hiring_latest AS
SELECT DISTINCT ON (h.company_id, h.job_title, h.posted_date)
  h.*,
  a.created_at as audit_date,
  a.id as audit_id_ref
FROM company_hiring h
JOIN audits a ON h.audit_id = a.id
WHERE a.deleted_at IS NULL
ORDER BY h.company_id, h.job_title, h.posted_date, a.created_at DESC;

COMMENT ON VIEW company_hiring_latest IS 'Latest hiring data per company';

-- =============================================================================
-- 10. DISPLACEMENT OPPORTUNITIES (Latest + Enriched)
-- =============================================================================
CREATE VIEW displacement_opportunities_latest AS
SELECT DISTINCT ON (d.company_id, d.partner_tech_id)
  d.*,
  c.name as company_name,
  c.domain as company_domain,
  c.industry,
  c.annual_revenue,
  pt.name as partner_tech_name,
  pt.category as partner_tech_category,
  pt.vendor as partner_tech_vendor,
  a.created_at as audit_date,
  a.audit_type,
  a.status as audit_status
FROM displacement_opportunities d
JOIN audits a ON d.audit_id = a.id
JOIN companies c ON d.company_id = c.id
JOIN partner_technologies pt ON d.partner_tech_id = pt.id
WHERE a.deleted_at IS NULL AND c.deleted_at IS NULL
ORDER BY d.company_id, d.partner_tech_id, a.created_at DESC;

COMMENT ON VIEW displacement_opportunities_latest IS 'Latest displacement opportunities with company and partner tech details';

-- =============================================================================
-- 11. SEARCH AUDIT TESTS (Latest + Enriched)
-- =============================================================================
CREATE VIEW search_audit_tests_latest AS
SELECT DISTINCT ON (t.company_id, t.test_name)
  t.*,
  c.name as company_name,
  c.domain as company_domain,
  a.created_at as audit_date,
  a.overall_score as audit_overall_score
FROM search_audit_tests t
JOIN audits a ON t.audit_id = a.id
JOIN companies c ON t.company_id = c.id
WHERE a.deleted_at IS NULL AND c.deleted_at IS NULL
ORDER BY t.company_id, t.test_name, a.created_at DESC;

COMMENT ON VIEW search_audit_tests_latest IS 'Latest search audit test results per company';

-- =============================================================================
-- 12. COMPANY OVERVIEW (Dashboard summary)
-- =============================================================================
CREATE VIEW company_overview AS
SELECT
  c.*,
  la.id as latest_audit_id,
  la.audit_type as latest_audit_type,
  la.created_at as latest_audit_date,
  la.overall_score as latest_audit_score,
  la.status as latest_audit_status,

  -- Traffic (latest month)
  (SELECT monthly_visits FROM company_traffic_latest ctl
   WHERE ctl.company_id = c.id
   ORDER BY ctl.month DESC LIMIT 1) as latest_monthly_visits,

  -- Tech stack count
  (SELECT COUNT(*) FROM company_technologies_latest tech
   WHERE tech.company_id = c.id) as tech_stack_count,

  -- Displacement opportunities count
  (SELECT COUNT(*) FROM displacement_opportunities_latest d
   WHERE d.company_id = c.id) as displacement_opportunities_count,

  -- Hot opportunities count (score >= 8.0)
  (SELECT COUNT(*) FROM displacement_opportunities_latest d
   WHERE d.company_id = c.id AND d.overall_score >= 8.0) as hot_opportunities_count

FROM companies c
LEFT JOIN latest_audits la ON la.company_id = c.id
WHERE c.deleted_at IS NULL;

COMMENT ON VIEW company_overview IS 'Dashboard summary view - company with latest audit and key metrics';

-- =============================================================================
-- END OF MIGRATION 006
-- =============================================================================
