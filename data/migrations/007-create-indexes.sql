-- Migration 007: Create Performance Indexes
-- Description: Additional indexes for query optimization
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: All previous migrations

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- =============================================================================
-- COMPOSITE INDEXES for Common Queries
-- =============================================================================

-- Companies: Search by name or domain
CREATE INDEX idx_companies_search ON companies USING gin(to_tsvector('english', name || ' ' || domain))
WHERE deleted_at IS NULL;

-- Audits: Filter by company + type + status
CREATE INDEX idx_audits_company_type_status ON audits(company_id, audit_type, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Displacement Opportunities: Filter by status + score
CREATE INDEX idx_displacement_status_score ON displacement_opportunities(opportunity_status, overall_score DESC);

-- Displacement Opportunities: Filter by assigned user + status
CREATE INDEX idx_displacement_assigned_status ON displacement_opportunities(assigned_to, opportunity_status)
WHERE assigned_to IS NOT NULL;

-- =============================================================================
-- GIN INDEXES for JSONB Columns
-- =============================================================================

-- Search audit test findings
CREATE INDEX idx_tests_finding_details ON search_audit_tests USING gin(finding_details);

-- API call request params (for debugging)
CREATE INDEX idx_api_call_params ON api_call_log USING gin(request_params);

-- Audit log old/new values (for auditing)
CREATE INDEX idx_audit_log_old_value ON audit_log USING gin(old_value);
CREATE INDEX idx_audit_log_new_value ON audit_log USING gin(new_value);

-- =============================================================================
-- PARTIAL INDEXES for Common Filters
-- =============================================================================

-- Failed audits only
CREATE INDEX idx_audits_failed ON audits(company_id, created_at DESC)
WHERE status = 'failed' AND deleted_at IS NULL;

-- Running audits only
CREATE INDEX idx_audits_running ON audits(created_at)
WHERE status = 'running' AND deleted_at IS NULL;

-- Hot opportunities only (score >= 8.0)
CREATE INDEX idx_displacement_hot ON displacement_opportunities(company_id, audit_id, overall_score DESC)
WHERE overall_score >= 8.0;

-- Buying committee decision makers only
CREATE INDEX idx_buying_committee_decision_makers ON buying_committee(company_id, audit_id, full_name)
WHERE role_category = 'decision_maker';

-- High severity test failures only
CREATE INDEX idx_tests_high_severity_failures ON search_audit_tests(company_id, audit_id, test_name)
WHERE severity = 'high' AND passed = false;

-- =============================================================================
-- BTREE INDEXES for Sorting and Range Queries
-- =============================================================================

-- Traffic: Sort by visits
CREATE INDEX idx_traffic_visits ON company_traffic(monthly_visits DESC);

-- Financials: Sort by revenue
CREATE INDEX idx_financials_revenue ON company_financials(revenue DESC);

-- API calls: Cost analysis
CREATE INDEX idx_api_calls_cost_provider ON api_call_log(provider, cost_usd DESC)
WHERE cost_usd > 0;

-- Cache: Most accessed data
CREATE INDEX idx_cache_hit_count ON enrichment_cache(hit_count DESC, last_accessed_at DESC);

-- =============================================================================
-- COVERING INDEXES (Include frequently queried columns)
-- =============================================================================

-- Companies with basic info (avoid table lookups)
CREATE INDEX idx_companies_basic_info ON companies(id, domain, name, industry, annual_revenue)
WHERE deleted_at IS NULL;

-- Audits with scores (avoid table lookups)
CREATE INDEX idx_audits_with_scores ON audits(company_id, id, overall_score, status, created_at DESC)
WHERE deleted_at IS NULL;

-- =============================================================================
-- STATISTICS
-- =============================================================================

-- Update statistics for query planner
ANALYZE companies;
ANALYZE audits;
ANALYZE company_traffic;
ANALYZE company_financials;
ANALYZE company_technologies;
ANALYZE displacement_opportunities;
ANALYZE search_audit_tests;

-- =============================================================================
-- END OF MIGRATION 007
-- =============================================================================
