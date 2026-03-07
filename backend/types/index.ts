/**
 * API response wrapper with metadata
 */
export interface APIResponse<T> {
  data: T;
  meta: {
    source: string;
    cached: boolean;
    timestamp: string;
    latency_ms: number;
    cost_usd?: number;
  };
}

/**
 * Source citation (MANDATORY for all data points)
 */
export interface SourceCitation {
  provider: string;
  url: string;
  accessed_at: string;
  cache_hit: boolean;
  endpoint?: string;
  params?: Record<string, any>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  total_keys: number;
  hit_rate: number;
  miss_rate: number;
  size_mb: number;
  oldest_key_age_hours: number;
  newest_key_age_hours: number;
}

/**
 * Rate limit state (token bucket algorithm)
 */
export interface RateLimitState {
  tokens: number;
  last_refill: number;
  max_tokens: number;
  refill_rate: number;
}

/**
 * HTTP client request options
 */
export interface RequestOptions {
  skipCache?: boolean;
  cacheTTL?: number;
  rateLimitKey?: string;
  persist?: boolean;
  retries?: number;
  timeout?: number;
}

/**
 * API call metadata (for cost tracking)
 */
export interface APICallMetadata {
  audit_id?: string;
  service: string;
  endpoint: string;
  request_params: Record<string, any>;
  response_data?: any;
  cache_hit: boolean;
  latency_ms: number;
  cost_usd: number;
  called_at: Date;
  http_status?: number;
  error_message?: string;
}

/**
 * Cost tracking statistics
 */
export interface CostStats {
  total: number;
  by_provider: Record<string, number>;
  by_day: Record<string, number>;
  cache_savings: number;
}

/**
 * Metrics snapshot
 */
export interface MetricsSnapshot {
  cache: {
    hit_rate: number;
    miss_rate: number;
    total_requests: number;
  };
  costs: CostStats;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errors: {
    total: number;
    by_type: Record<string, number>;
  };
}

/**
 * Company entity (from database)
 */
export interface Company {
  id: string;
  domain: string;
  name: string;
  industry?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Audit entity (from database)
 */
export interface Audit {
  id: string;
  company_id: string;
  audit_type: 'partner_intel' | 'search_audit';
  status: 'pending' | 'running' | 'completed' | 'failed';
  data: Record<string, any>;
  score?: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    redis: boolean;
    database: boolean;
    queue?: boolean;
  };
}

/**
 * Strategic Analysis (Level 2 - Company-level synthesis)
 */
export type AlgoliaValueProp =
  | 'search_relevance'
  | 'scale_performance'
  | 'mobile_experience'
  | 'conversion_optimization'
  | 'personalization'
  | 'time_to_market'
  | 'operational_efficiency';

export interface StrategicAnalysis {
  company_id: string;
  audit_id: string;
  primary_value_prop: AlgoliaValueProp;
  secondary_value_props: AlgoliaValueProp[];
  sales_pitch: string;
  business_impact: string;
  strategic_recommendations: string;
  trigger_events: string[];
  timing_signals: string[];
  caution_signals: string[];
  overall_confidence_score: number;
  insights_synthesized_from: string[];
  analysis_generated_at: Date;
}
