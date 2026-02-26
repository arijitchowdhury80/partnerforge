/**
 * PartnerForge Type Definitions
 */

// =============================================================================
// Company Types
// =============================================================================

export interface Company {
  domain: string;
  company_name: string;
  ticker?: string;
  exchange?: string;
  is_public: boolean;
  headquarters: {
    city: string;
    state: string;
    country: string;
  };
  industry: string;
  vertical: string;
  sub_vertical?: string;
  employee_count?: number;
  store_count?: number;
  founded_year?: number;
  icp_score: number;
  signal_score: number;
  priority_score: number;
  status: 'hot' | 'warm' | 'cool' | 'cold';
  partner_tech?: string[];
  last_enriched?: string;
}

// =============================================================================
// Source Citation Types (P0 Requirement)
// =============================================================================

export interface SourceCitation {
  url: string;
  date: string;
  type: 'api' | 'webpage' | 'document' | 'transcript';
}

export type FreshnessStatus = 'fresh' | 'stale' | 'expired';

// =============================================================================
// Intelligence Module Types
// =============================================================================

export type ModuleId =
  | 'm01_company_context'
  | 'm02_tech_stack'
  | 'm03_traffic'
  | 'm04_financials'
  | 'm05_competitors'
  | 'm06_hiring'
  | 'm07_strategic'
  | 'm08_investor'
  | 'm09_executive'
  | 'm10_buying_committee'
  | 'm11_displacement'
  | 'm12_case_study'
  | 'm13_icp_priority'
  | 'm14_signal_scoring'
  | 'm15_strategic_brief';

export interface ModuleStatus {
  status: 'pending' | 'running' | 'complete' | 'error';
  last_updated?: string;
  freshness?: FreshnessStatus;
  error_message?: string;
}

export interface ModuleResult<T = unknown> {
  module_id: ModuleId;
  domain: string;
  data: T;
  source: SourceCitation;
  enriched_at: string;
  is_cached: boolean;
}

// =============================================================================
// Wave 1: Foundation Module Data Types
// =============================================================================

export interface CompanyContextData {
  domain: string;
  company_name: string;
  ticker?: string;
  exchange?: string;
  is_public: boolean;
  headquarters: {
    city: string;
    state: string;
    country: string;
  };
  industry: string;
  vertical: string;
  sub_vertical?: string;
  business_model: string;
  employee_count?: number;
  store_count?: number;
  fiscal_year_end?: string;
  founded_year?: number;
  description?: string;
  brands?: string[];
}

export interface TechStackData {
  domain: string;
  technologies: Technology[];
  partner_tech_detected: string[];
  search_provider?: string;
  cms?: string;
  ecommerce_platform?: string;
  analytics?: string[];
  tag_managers?: string[];
  cdn?: string;
}

export interface Technology {
  name: string;
  category: string;
  first_detected?: string;
  last_detected?: string;
}

export interface TrafficData {
  domain: string;
  monthly_visits: number;
  monthly_visits_trend: number;
  bounce_rate: number;
  pages_per_visit: number;
  avg_visit_duration: number;
  traffic_sources: TrafficSource[];
  top_countries: CountryTraffic[];
  device_distribution: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
}

export interface TrafficSource {
  source: 'direct' | 'search' | 'referral' | 'social' | 'mail' | 'paid';
  percentage: number;
}

export interface CountryTraffic {
  country: string;
  country_code: string;
  percentage: number;
}

export interface FinancialData {
  domain: string;
  ticker?: string;
  revenue: FinancialMetric[];
  net_income: FinancialMetric[];
  ebitda?: FinancialMetric[];
  ebitda_margin?: number;
  margin_zone: 'green' | 'yellow' | 'red';
  ecommerce_revenue?: number;
  ecommerce_percentage?: number;
  stock_price?: number;
  market_cap?: number;
  roi_estimate?: RoiEstimate;
}

export interface FinancialMetric {
  year: number;
  value: number;
  yoy_change?: number;
}

export interface RoiEstimate {
  addressable_revenue: number;
  conservative: number;
  moderate: number;
  aggressive: number;
}

// =============================================================================
// Wave 2: Competitive Module Data Types
// =============================================================================

export interface CompetitorData {
  domain: string;
  competitors: Competitor[];
  market_position?: string;
  competitive_landscape?: string;
}

export interface Competitor {
  domain: string;
  company_name: string;
  similarity_score: number;
  search_provider?: string;
  using_algolia: boolean;
}

export interface HiringData {
  domain: string;
  signal_strength: 'strong' | 'moderate' | 'weak' | 'none';
  total_openings: number;
  tier_breakdown: {
    tier_1_vp: number;
    tier_2_director: number;
    tier_3_ic: number;
  };
  relevant_jobs: Job[];
  tech_keywords: string[];
}

export interface Job {
  title: string;
  tier: 1 | 2 | 3;
  department?: string;
  location?: string;
  url: string;
  posted_date?: string;
  relevance_score: number;
}

// =============================================================================
// Wave 3: Buying Signals Module Data Types
// =============================================================================

export interface InvestorData {
  domain: string;
  sec_filings: SecFiling[];
  earnings_highlights: EarningsHighlight[];
  risk_factors: RiskFactor[];
}

export interface SecFiling {
  type: '10-K' | '10-Q' | '8-K' | 'DEF 14A';
  filing_date: string;
  url: string;
  highlights?: string[];
}

export interface EarningsHighlight {
  quarter: string;
  date: string;
  key_points: string[];
  transcript_url?: string;
}

export interface RiskFactor {
  category: string;
  description: string;
  relevance_to_algolia: 'high' | 'medium' | 'low';
}

export interface ExecutiveData {
  domain: string;
  quotes: ExecutiveQuote[];
  themes: ExecutiveTheme[];
}

export interface ExecutiveQuote {
  speaker: string;
  title: string;
  quote: string;
  topic_tags: string[];
  maps_to_algolia: string;
  relevance_score: number;
  source_url: string;
  source_date: string;
}

export interface ExecutiveTheme {
  theme: string;
  frequency: number;
  example_quote?: string;
}

// =============================================================================
// Wave 4: Synthesis Module Data Types
// =============================================================================

export interface CaseStudyMatch {
  case_study_id: string;
  company_name: string;
  industry: string;
  use_case: string;
  relevance_score: number;
  key_metrics: string[];
  url: string;
}

export interface IcpPriorityData {
  domain: string;
  icp_score: number;
  score_breakdown: {
    vertical: number;
    traffic: number;
    tech_spend: number;
    partner_tech: number;
  };
  tier: 'Commerce' | 'Content' | 'Support' | 'Other';
  fit_analysis: string;
}

export interface SignalScoringData {
  domain: string;
  total_score: number;
  signals: Signal[];
  priority_rank?: number;
}

export interface Signal {
  type: string;
  description: string;
  score: number;
  source_url: string;
  detected_at: string;
}

export interface StrategicBriefData {
  domain: string;
  executive_summary: string;
  key_signals: string[];
  recommended_approach: string;
  talking_points: string[];
  case_studies: CaseStudyMatch[];
  next_steps: string[];
}

// =============================================================================
// Enrichment Types
// =============================================================================

export interface EnrichmentJob {
  job_id: string;
  domain: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  started_at?: string;
  completed_at?: string;
  modules: ModuleId[];
  progress?: {
    completed: number;
    total: number;
  };
  error?: string;
}

export interface EnrichmentStatus {
  domain: string;
  overall_status: 'idle' | 'running' | 'complete' | 'error';
  modules: Record<ModuleId, ModuleStatus>;
  last_full_enrichment?: string;
  active_jobs: EnrichmentJob[];
}

// =============================================================================
// API Response Types
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiError {
  error: string;
  detail?: string;
  status_code: number;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface DashboardStats {
  total_companies: number;
  enriched_companies: number;
  hot_leads: number;
  warm_leads: number;
  modules_active: number;
  waves_configured: number;
  last_enrichment?: string;
}

export interface FilterState {
  status?: 'hot' | 'warm' | 'cool' | 'cold';
  partner?: string;
  min_score?: number;
  sort_by: 'icp_score' | 'traffic' | 'revenue' | 'name';
  sort_order: 'asc' | 'desc';
}

// =============================================================================
// CSV Upload Types
// =============================================================================

export type UploadStatus =
  | 'uploaded'
  | 'parsing'
  | 'parsed'
  | 'validating'
  | 'validated'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export type ListItemStatus =
  | 'pending'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'queued'
  | 'enriching'
  | 'enriched'
  | 'failed';

export interface ColumnMapping {
  domain?: string;
  company_name?: string;
  salesforce_id?: string;
  demandbase_id?: string;
  revenue?: string;
  traffic?: string;
  industry?: string;
  owner?: string;
  region?: string;
  journey_stage?: string;
  engagement_score?: string;
}

export interface ValidationError {
  field: string;
  error: string;
}

export interface UploadedList {
  id: string;
  user_id?: string;
  team_id?: string;
  name: string;
  description?: string;
  source: 'salesforce' | 'demandbase' | '6sense' | 'manual';
  original_filename: string;
  file_size_bytes: number;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  column_mapping: ColumnMapping;
  status: UploadStatus;
  processed_count: number;
  success_count: number;
  error_count: number;
  created_at: string;
  parsing_started_at?: string;
  parsing_completed_at?: string;
  enrichment_started_at?: string;
  enrichment_completed_at?: string;
  error_message?: string;
}

export interface UploadedListItem {
  id: string;
  list_id: string;
  row_number: number;
  domain: string;
  company_name?: string;
  salesforce_id?: string;
  demandbase_id?: string;
  csv_data: Record<string, unknown>;
  status: ListItemStatus;
  validation_errors?: ValidationError[];
  enrichment_job_id?: string;
  displacement_target_id?: number;
  created_at: string;
  validated_at?: string;
  enrichment_started_at?: string;
  enrichment_completed_at?: string;
  error_message?: string;
  retry_count: number;
}

export interface UploadResponse {
  id: string;
  name: string;
  total_rows: number;
  column_mapping: ColumnMapping;
  detected_columns: string[];
  status: UploadStatus;
  requires_mapping_confirmation: boolean;
}

export interface ValidationResult {
  list_id: string;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  status: 'validated' | 'validating';
}

export interface EnrichmentJobResponse {
  job_id: string;
  list_id: string;
  total_items: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimated_time_seconds: number;
}

export interface ListStatusResponse {
  id: string;
  name: string;
  status: UploadStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  processed_count: number;
  success_count: number;
  error_count: number;
  progress_percent: number;
  created_at: string;
  enrichment_started_at?: string;
  enrichment_completed_at?: string;
  estimated_remaining_seconds?: number;
}

// =============================================================================
// KPI Card Types
// =============================================================================

export interface KPICardData {
  title: string;
  value: number;
  previousValue?: number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  icon?: React.ReactNode;
  gradient?: 'primary' | 'success' | 'danger' | 'warning';
  format?: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
}

// =============================================================================
// Intelligence Panel Types
// =============================================================================

export interface IntelligenceModuleDisplay {
  module_id: ModuleId;
  name: string;
  description: string;
  icon: string;
  wave: 1 | 2 | 3 | 4;
  status: ModuleStatus;
  data?: unknown;
}
