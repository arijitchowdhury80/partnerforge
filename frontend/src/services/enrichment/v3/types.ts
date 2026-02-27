/**
 * Enrichment v3 - Unified Types
 *
 * Clean, homogeneous types for all enrichment sources.
 * Each source follows the same SourceResult pattern.
 */

// =============================================================================
// Source Identifiers
// =============================================================================

export type SourceId =
  | 'similarweb'
  | 'builtwith'
  | 'yahoofinance'
  | 'secedgar'
  | 'websearch'
  | 'jsearch';

export const ALL_SOURCES: SourceId[] = [
  'similarweb',
  'builtwith',
  'yahoofinance',
  'secedgar',
  'websearch',
  'jsearch',
];

export const SOURCE_NAMES: Record<SourceId, string> = {
  similarweb: 'SimilarWeb',
  builtwith: 'BuiltWith',
  yahoofinance: 'Yahoo Finance',
  secedgar: 'SEC EDGAR',
  websearch: 'Web Search',
  jsearch: 'Job Search',
};

// =============================================================================
// Universal Source Result
// =============================================================================

export interface SourceResult<T = unknown> {
  source: SourceId;
  success: boolean;
  data: T | null;
  error?: string;
  fetched_at: string;
  cached: boolean;
}

// =============================================================================
// Source-Specific Data Types
// =============================================================================

// SimilarWeb
export interface SimilarWebData {
  monthly_visits: number;
  bounce_rate: number;
  pages_per_visit: number;
  avg_visit_duration: number;
  global_rank?: number;
  country_rank?: number;
  traffic_sources: {
    direct: number;
    search: number;
    referral: number;
    social: number;
    mail: number;
    paid: number;
  };
  top_countries: Array<{ country: string; percentage: number }>;
  similar_sites?: Array<{ domain: string; similarity: number }>;
}

// BuiltWith
export interface BuiltWithData {
  technologies: Array<{
    name: string;
    category: string;
    first_detected?: string;
  }>;
  search_provider?: string;
  ecommerce_platform?: string;
  cms?: string;
  partner_tech: string[];
  analytics: string[];
  tag_managers: string[];
}

// Yahoo Finance
export interface YahooFinanceData {
  ticker: string;
  company_name: string;
  sector: string;
  industry: string;
  market_cap: number;
  revenue: number;
  net_income: number;
  employees: number;
  pe_ratio: number;
  revenue_growth: number;
  profit_margins: number;
  // 3-year history
  revenue_history: Array<{ year: number; value: number }>;
  income_history: Array<{ year: number; value: number }>;
  // Analyst ratings
  analyst_rating?: {
    buy: number;
    hold: number;
    sell: number;
    target_price: number;
  };
}

// SEC EDGAR
export interface SecEdgarData {
  cik: string;
  ticker: string;
  company_name: string;
  filings: Array<{
    type: '10-K' | '10-Q' | '8-K';
    date: string;
    url: string;
  }>;
  risk_factors: Array<{
    category: string;
    text: string;
    algolia_relevance: 'high' | 'medium' | 'low';
  }>;
  digital_mentions: string[];
  search_mentions: string[];
}

// WebSearch (Executive Quotes + Strategic Signals)
export interface WebSearchData {
  executive_quotes: Array<{
    speaker: string;
    title: string;
    quote: string;
    source: string;
    date: string;
    url: string;
    algolia_value: string;
    relevance: number;
  }>;
  strategic_signals: Array<{
    type: string;
    description: string;
    source: string;
    date: string;
    url: string;
  }>;
  news_mentions: Array<{
    title: string;
    source: string;
    date: string;
    url: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
}

// JSearch (Hiring/Jobs)
export interface JSearchData {
  total_jobs: number;
  relevant_jobs: number;
  signal_score: number;
  signal_strength: 'strong' | 'moderate' | 'weak' | 'none';
  tier_breakdown: {
    tier_1: number; // VP, C-suite, Director
    tier_2: number; // Manager, Lead, Architect
    tier_3: number; // IC
  };
  category_breakdown: Record<string, number>;
  top_jobs: Array<{
    title: string;
    tier: number;
    categories: string[];
    url?: string;
  }>;
}

// =============================================================================
// Enrichment Options
// =============================================================================

export interface EnrichOptions {
  /** Which sources to run. If empty/undefined, runs ALL sources */
  sources?: SourceId[];
  /** Force refresh even if cached */
  forceRefresh?: boolean;
  /** Company name (helps with searches) */
  companyName?: string;
  /** Stock ticker (for public companies) */
  ticker?: string;
  /** Progress callback */
  onProgress?: (progress: EnrichProgress) => void;
}

export interface EnrichProgress {
  source: SourceId;
  status: 'pending' | 'fetching' | 'success' | 'error' | 'skipped';
  message?: string;
}

// =============================================================================
// Full Enrichment Result
// =============================================================================

export interface EnrichmentResult {
  domain: string;
  company_name?: string;
  sources_requested: SourceId[];
  sources_completed: SourceId[];
  sources_failed: SourceId[];

  // Source data (null if not requested or failed)
  similarweb: SourceResult<SimilarWebData> | null;
  builtwith: SourceResult<BuiltWithData> | null;
  yahoofinance: SourceResult<YahooFinanceData> | null;
  secedgar: SourceResult<SecEdgarData> | null;
  websearch: SourceResult<WebSearchData> | null;
  jsearch: SourceResult<JSearchData> | null;

  // Metadata
  data_completeness: number; // 0-100
  enriched_at: string;
}

// =============================================================================
// Source Module Interface
// =============================================================================

export interface SourceModule<T> {
  id: SourceId;
  name: string;
  isAvailable: () => boolean;
  enrich: (domain: string, options?: SourceOptions) => Promise<SourceResult<T>>;
}

export interface SourceOptions {
  companyName?: string;
  ticker?: string;
  forceRefresh?: boolean;
}

// =============================================================================
// Database Update Types
// =============================================================================

export interface SupabaseUpdatePayload {
  // SimilarWeb fields
  sw_monthly_visits?: number;
  sw_bounce_rate?: number;
  sw_pages_per_visit?: number;
  sw_avg_duration?: number;
  sw_global_rank?: number;
  traffic_sources_json?: string;
  similar_sites_json?: string;

  // BuiltWith fields
  tech_stack_json?: string;
  current_search?: string;
  ecommerce_platform?: string;
  cms?: string;
  partner_tech?: string[];

  // Yahoo Finance fields
  ticker?: string;
  revenue?: number;
  net_income?: number;
  market_cap?: number;
  employees?: number;
  revenue_growth?: number;
  financials_json?: string;

  // SEC EDGAR fields
  cik?: string;
  sec_filings_json?: string;
  risk_factors_json?: string;

  // WebSearch fields
  exec_quotes_json?: string;
  strategic_signals_json?: string;

  // JSearch fields
  hiring_signal_score?: number;
  hiring_signal_strength?: string;
  hiring_jobs_json?: string;

  // Metadata
  last_enriched?: string;
  enrichment_sources?: string[];

  // Composite Score (calculated from all enrichment data)
  icp_score?: number;         // Composite score total (0-100)
  status?: 'hot' | 'warm' | 'cold';  // Derived from composite score
}
