# Data Schemas

This document defines the data models used in API requests and responses.

---

## Target Models

### TargetSummary

Returned in list endpoints (compact representation).

```typescript
interface TargetSummary {
  id: number;
  domain: string;
  company_name: string;
  partner_tech: string;
  vertical: string;
  country: string;
  icp_score: number | null;
  icp_tier_name: string | null;  // "hot" | "warm" | "cold"
  sw_monthly_visits: number | null;
  revenue: number | null;
  current_search: string | null;
  enrichment_level: string;  // "basic" | "standard" | "full"
  last_enriched: string | null;  // ISO 8601 timestamp
  created_at: string;  // ISO 8601 timestamp
}
```

### TargetResponse

Full target details (single target endpoint).

```typescript
interface TargetResponse {
  // Identity
  id: number;
  domain: string;
  company_name: string;
  partner_tech: string;

  // Location
  vertical: string;
  country: string;
  city: string | null;
  state: string | null;

  // Contact
  tech_spend: number | null;
  emails: string[] | null;
  phones: string[] | null;
  socials: string[] | null;
  exec_titles: string[] | null;

  // SimilarWeb Traffic
  sw_monthly_visits: number | null;
  sw_bounce_rate: number | null;
  sw_pages_per_visit: number | null;
  sw_avg_duration: number | null;  // seconds
  sw_search_traffic_pct: number | null;
  sw_rank_global: number | null;

  // ICP Scoring
  icp_tier: number | null;  // 1-4
  icp_score: number | null;  // 0-100
  icp_tier_name: string | null;
  score_reasons: string | null;
  score_breakdown: ScoreBreakdown | null;

  // Financial
  ticker: string | null;
  is_public: boolean;
  revenue: number | null;
  gross_margin: number | null;
  traffic_growth: number | null;

  // Intelligence
  current_search: string | null;
  matched_case_studies: string[] | null;
  lead_score: number | null;
  trigger_events: string | null;

  // Executive Quotes
  exec_quote: string | null;
  exec_name: string | null;
  exec_title: string | null;
  quote_source: string | null;

  // Displacement
  competitors_using_algolia: string | null;
  displacement_angle: string | null;

  // Metadata
  enrichment_level: string;
  last_enriched: string | null;
  created_at: string;
}

interface ScoreBreakdown {
  vertical: number;
  traffic: number;
  tech_spend: number;
  partner_tech: number;
}
```

### TargetSearchRequest

Request body for bulk domain search.

```typescript
interface TargetSearchRequest {
  domains: string[];  // Max 100 domains
}
```

### TargetSearchResponse

Response from bulk domain search.

```typescript
interface TargetSearchResponse {
  found: TargetSummary[];
  not_found: string[];
  total_searched: number;
  total_found: number;
}
```

### TargetStatusUpdate

Request body for updating target status.

```typescript
interface TargetStatusUpdate {
  icp_score?: number;  // 0-100
  icp_tier_name?: string;  // "hot" | "warm" | "cold"
  score_reasons?: Record<string, string>;
}
```

---

## Statistics Models

### TargetStats

Response from stats endpoint.

```typescript
interface TargetStats {
  total: number;
  by_status: {
    hot: number;    // 70-100
    warm: number;   // 40-69
    cold: number;   // 0-39
    unscored: number;
  };
  by_vertical: VerticalStat[];
  by_partner_tech: PartnerTechStat[];
  avg_icp_score: number;
  avg_monthly_visits: number;
  total_pipeline_value: number;
  enriched_count: number;
  public_count: number;
  calculated_at: string;
}

interface VerticalStat {
  vertical: string;
  count: number;
  avg_icp_score: number;
}

interface PartnerTechStat {
  partner_tech: string;
  count: number;
  avg_icp_score: number;
}
```

---

## Pagination Models

### PaginationParams

Query parameters for paginated endpoints.

```typescript
interface PaginationParams {
  page?: number;  // Default: 1, Min: 1
  page_size?: number;  // Default: 50, Max: 100
}
```

### PaginationMeta

Pagination metadata in responses.

```typescript
interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}
```

---

## Enrichment Models

### EnrichmentJob

Enrichment job details.

```typescript
interface EnrichmentJob {
  job_id: string;
  domain: string;
  status: JobStatus;
  progress_percent: number;
  current_wave: number | null;
  current_module: string | null;
  modules_total: number;
  modules_completed: number;
  modules_failed: number;
  waves: WaveResult[];
  priority: string;
  force: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  errors: string[];
}

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
```

### WaveResult

Results for a single enrichment wave.

```typescript
interface WaveResult {
  wave_number: number;  // 1-4
  status: JobStatus;
  modules: ModuleResult[];
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
}
```

### ModuleResult

Results for a single enrichment module.

```typescript
interface ModuleResult {
  module_id: string;
  status: JobStatus;
  duration_seconds: number | null;
  data_points_collected: number | null;
  source_url: string | null;
  error_message: string | null;
  cached: boolean;
}
```

### EnrichmentRequest

Request body for starting enrichment.

```typescript
interface EnrichmentRequest {
  modules?: string[];  // Specific modules to run
  waves?: number[];  // Specific waves (1-4)
  force?: boolean;  // Bypass cache (default: false)
  priority?: "low" | "normal" | "high";  // Default: "normal"
}
```

### BatchEnrichmentRequest

Request body for batch enrichment.

```typescript
interface BatchEnrichmentRequest {
  domains: string[];  // Required, max 100
  modules?: string[];
  waves?: number[];
  force?: boolean;
  priority?: string;
  concurrency?: number;  // Default: 5, max: 10
}
```

### CacheStatus

Response from cache status endpoint.

```typescript
interface CacheStatus {
  domain: string;
  modules: ModuleCacheStatus[];
  overall_freshness: "fresh" | "stale" | "expired" | "missing";
  last_enrichment: string | null;
  stale_modules: string[];
}

interface ModuleCacheStatus {
  module_id: string;
  is_cached: boolean;
  cached_at: string | null;
  freshness: "fresh" | "stale" | "expired" | "missing";
  ttl_remaining_seconds: number | null;
}
```

---

## Health Models

### HealthResponse

Response from health endpoints.

```typescript
interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  service: string;
  version: string;
  checks?: HealthChecks;
  error?: string;
}

interface HealthChecks {
  database?: DatabaseHealth;
  redis?: RedisHealth;
  configuration?: ConfigHealth;
  resources?: ResourceHealth;
}

interface DatabaseHealth {
  status: "healthy" | "unhealthy";
  latency_ms: number | null;
  driver: string;
  pool_size?: number;
  pool_checked_out?: number;
  error?: string;
}

interface RedisHealth {
  status: "healthy" | "unhealthy";
  latency_ms: number | null;
  redis_version?: string;
  connected_clients?: number;
  optional: boolean;
  error?: string;
}

interface ConfigHealth {
  status: "healthy" | "unhealthy";
  message: string;
  api_keys_configured?: {
    builtwith: boolean;
    similarweb: boolean;
    yahoo_finance: boolean;
  };
}

interface ResourceHealth {
  status: "healthy" | "unhealthy";
  memory_mb: number;
  memory_percent: number;
  cpu_percent: number;
  threads: number;
  open_files: number;
}
```

### VersionResponse

Response from version endpoint.

```typescript
interface VersionResponse {
  service: string;
  version: string;
  api_version: string;
  supported_api_versions: string[];
  build_date: string;
  git_commit: string;
  git_branch?: string;
}
```

### MetricsResponse

Response from metrics endpoint.

```typescript
interface MetricsResponse {
  uptime_seconds: number;
  requests_total: number;
  requests_per_minute: number;
  memory_bytes: number;
  memory_percent: number;
  cpu_percent: number;
  threads: number;
  open_files: number;
  active_connections: number;
  enrichment_jobs: {
    queued: number;
    running: number;
    completed_today: number;
    failed_today: number;
  };
}
```

---

## Error Models

### ErrorResponse

Standard error response format.

```typescript
interface ErrorResponse {
  success: false;
  error: string;  // Error title
  detail?: string;  // Detailed message
  status_code: number;
  request_id?: string;
  timestamp?: string;
}
```

### ValidationError

Response for validation errors (400).

```typescript
interface ValidationError {
  success: false;
  error: "Validation Error";
  detail: ValidationDetail[];
  status_code: 400;
}

interface ValidationDetail {
  loc: string[];  // Path to invalid field
  msg: string;  // Error message
  type: string;  // Error type
}
```

---

## Enums

### ICP Tier

```typescript
type ICPTier = "hot" | "warm" | "cold" | "unscored";

// Composite Scoring System - 4 factors at 25% each:
// Fit, Intent, Value, Displacement

const ICPTierScores = {
  hot: [70, 100],   // High priority, ready for outreach
  warm: [40, 69],   // Nurture pipeline
  cold: [0, 39],    // Low priority
  unscored: null
};

const ICPTierColors = {
  hot: "#ef4444",     // Red
  warm: "#f97316",    // Orange
  cold: "#6b7280"     // Gray
};
```

### Enrichment Level

```typescript
type EnrichmentLevel = "basic" | "standard" | "full";

const EnrichmentLevelDescription = {
  basic: "Raw import, no enrichment",
  standard: "API enriched (BuiltWith + SimilarWeb)",
  full: "All 15 modules completed"
};
```

### Partner Technologies

```typescript
type PartnerTech =
  | "Adobe AEM"
  | "Adobe Commerce"
  | "Amplience"
  | "Spryker";
```

### Verticals

```typescript
type Vertical =
  | "Commerce"
  | "Media & Publishing"
  | "Financial Services"
  | "Healthcare"
  | "Automotive"
  | "Travel & Hospitality"
  | "Technology"
  | "Other";
```

---

## JSON Field Formats

Some database fields store JSON as strings. Here are their structures:

### `score_breakdown` Field

```json
{
  "vertical": 25,
  "traffic": 30,
  "tech_spend": 20,
  "partner_tech": 10
}
```

### `emails` Field

```json
["contact@company.com", "sales@company.com"]
```

### `matched_case_studies` Field

```json
["LVMH Case Study", "Nike Digital Transformation"]
```

### `tech_stack_json` Field

```json
{
  "cms": ["Adobe AEM"],
  "search": ["Elasticsearch"],
  "analytics": ["Google Analytics 4"],
  "cdp": ["Segment"],
  "ecommerce": ["Salesforce Commerce Cloud"]
}
```

### `financials_json` Field

```json
{
  "revenue_fy2025": 242300000000,
  "revenue_fy2024": 226900000000,
  "revenue_cagr": 6.8,
  "ebitda_margin": 4.2,
  "gross_margin": 11.2,
  "market_cap": 350000000000
}
```

### `hiring_signals` Field

```json
{
  "total_openings": 45,
  "search_related": 3,
  "data_engineering": 12,
  "hot_signals": ["Sr. Search Engineer", "VP, Digital Experience"]
}
```
