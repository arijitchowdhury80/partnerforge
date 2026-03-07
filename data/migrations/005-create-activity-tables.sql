-- Migration 005: Create Activity and Log Tables
-- Description: Audit log, API call tracking, error logging, data freshness
-- Author: Dashboard Builder Team
-- Date: 2026-03-06
-- Dependencies: 001-create-core-tables.sql

-- =============================================================================
-- ACTIVITY TABLES (NOT audit-scoped, use regular PKs)
-- =============================================================================

-- =============================================================================
-- 1. AUDIT LOG (Who did what when)
-- =============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  actor_id UUID REFERENCES users(id),
  actor_email VARCHAR(255),

  action_type VARCHAR(50) NOT NULL, -- 'audit_created' | 'audit_deleted' | 'company_added' | 'opportunity_assigned'
  resource_type VARCHAR(50) NOT NULL, -- 'audit' | 'company' | 'displacement_opportunity' | 'user'
  resource_id UUID,

  -- What changed
  old_value JSONB,
  new_value JSONB,

  -- Request metadata
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action_type, created_at DESC);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

COMMENT ON TABLE audit_log IS 'Activity log - who did what when (not audit-scoped)';
COMMENT ON COLUMN audit_log.old_value IS 'Before value (JSONB for flexibility)';
COMMENT ON COLUMN audit_log.new_value IS 'After value (JSONB for flexibility)';

-- =============================================================================
-- 2. API CALL LOG (Cost tracking + debugging)
-- =============================================================================
CREATE TABLE api_call_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  provider VARCHAR(50) NOT NULL, -- 'similarweb' | 'builtwith' | 'apollo' | 'yahoo_finance' | 'apify'
  endpoint VARCHAR(255) NOT NULL,

  -- Request
  request_params JSONB,
  cache_key VARCHAR(255),

  -- Response
  status_code INTEGER,
  response_time_ms INTEGER,
  was_cached BOOLEAN DEFAULT false,

  -- Cost tracking
  cost_usd NUMERIC(10,6),
  api_credits_used INTEGER, -- For providers with credit system

  -- Context (if part of audit)
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Error tracking
  error_message TEXT,
  retry_attempt INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_calls_provider ON api_call_log(provider, created_at DESC);
CREATE INDEX idx_api_calls_audit ON api_call_log(audit_id);
CREATE INDEX idx_api_calls_company ON api_call_log(company_id, created_at DESC);
CREATE INDEX idx_api_calls_cached ON api_call_log(was_cached, created_at DESC);
CREATE INDEX idx_api_calls_cost ON api_call_log(cost_usd DESC) WHERE cost_usd > 0;

COMMENT ON TABLE api_call_log IS 'All API calls made to external providers - cost tracking and debugging';
COMMENT ON COLUMN api_call_log.was_cached IS 'True if response was served from cache (no API cost)';

-- =============================================================================
-- 3. API ERROR LOG (What failed)
-- =============================================================================
CREATE TABLE api_error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,

  -- Error details
  error_type VARCHAR(100), -- 'rate_limit' | 'timeout' | 'auth_failed' | 'not_found' | 'server_error'
  error_message TEXT,
  http_status_code INTEGER,

  -- Request context
  request_params JSONB,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Retry info
  retry_count INTEGER DEFAULT 0,
  will_retry BOOLEAN DEFAULT true,
  next_retry_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_errors_provider ON api_error_log(provider, created_at DESC);
CREATE INDEX idx_api_errors_type ON api_error_log(error_type);
CREATE INDEX idx_api_errors_audit ON api_error_log(audit_id);
CREATE INDEX idx_api_errors_created ON api_error_log(created_at DESC);

COMMENT ON TABLE api_error_log IS 'API call failures - debugging and monitoring';

-- =============================================================================
-- 4. DATA FRESHNESS (When should we refresh?)
-- =============================================================================
CREATE TABLE data_freshness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  data_type VARCHAR(50) NOT NULL, -- 'traffic' | 'financials' | 'tech_stack' | 'social' | 'hiring'

  last_fetched_at TIMESTAMP,
  next_refresh_at TIMESTAMP,
  is_stale BOOLEAN DEFAULT false,

  refresh_frequency_days INTEGER DEFAULT 30,

  CONSTRAINT freshness_unique UNIQUE (company_id, data_type)
);

CREATE INDEX idx_freshness_stale ON data_freshness(is_stale, next_refresh_at) WHERE is_stale = true;
CREATE INDEX idx_freshness_company ON data_freshness(company_id);

COMMENT ON TABLE data_freshness IS 'Tracks when data should be refreshed - avoids redundant API calls';
COMMENT ON COLUMN data_freshness.is_stale IS 'Staleness flag: set by application logic when next_refresh_at passes';

-- =============================================================================
-- 5. ENRICHMENT CACHE (7-day cache metadata)
-- =============================================================================
CREATE TABLE enrichment_cache (
  key VARCHAR(255) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,

  -- Cached data
  data JSONB NOT NULL,

  -- Cache metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP DEFAULT NOW(),

  -- Source metadata
  source_url TEXT,
  http_status INTEGER,

  -- Size tracking
  data_size_bytes INTEGER
);

CREATE INDEX idx_cache_provider ON enrichment_cache(provider);
CREATE INDEX idx_cache_expires ON enrichment_cache(expires_at);
CREATE INDEX idx_cache_accessed ON enrichment_cache(last_accessed_at DESC);

COMMENT ON TABLE enrichment_cache IS 'Persistent cache for API responses - 7-day TTL';
COMMENT ON COLUMN enrichment_cache.key IS 'Format: api:{provider}:{endpoint}:{params_hash}';
COMMENT ON COLUMN enrichment_cache.hit_count IS 'Increment on each cache hit - tracks popular data';

-- =============================================================================
-- TRIGGER for cache hit tracking
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_cache_hit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hit_count = OLD.hit_count + 1;
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would be activated by application code when reading from cache

-- =============================================================================
-- END OF MIGRATION 005
-- =============================================================================
