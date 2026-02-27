/**
 * Enrichment Orchestrator
 *
 * Coordinates all API clients and transformers for multi-source enrichment.
 * Features:
 * - Parallel API calls within phases
 * - Progress callbacks for UI updates
 * - Error handling for partial failures
 * - Caching with configurable TTL
 * - Batch enrichment with concurrency control
 *
 * @module enrichment/orchestrator
 */

import { similarWebClient, type SimilarWebFullData, type SimilarWebCompetitor } from './clients/similarweb';
import { builtWithClient, type BuiltWithFullData, type BuiltWithTechStack } from './clients/builtwith';
import { yahooFinanceClient } from './clients/yahoofinance';
import {
  webSearchProxy,
  type SearchExecutor,
} from './clients/websearch';

// Import types from @/types
import type {
  TrafficData,
  TechStackData,
  CompetitorData,
  HiringData,
  ExecutiveData as ExecutiveDataType,
  InvestorData as InvestorDataType,
} from '@/types';

import {
  // Traffic transformers
  transformTrafficData,
  // TechStack transformers
  transformTechStackFromBuiltWith,
  // Competitor transformers
  transformCompetitorData,
  // Financial transformers
  transformFullFinancialData,
  // Hiring transformers
  transformHiringData,
  transformToEnrichedHiringData,
  type EnrichedHiringData,
  // Executive transformers
  transformExecutiveData,
  transformToExecutiveInsights,
  type ExecutiveInsights,
  // Investor transformers
  transformInvestorData,
  transformToInvestorIntelligence,
  type InvestorIntelligence,
  // Extended financial transformers
  type ExtendedFinancialData,
} from './transformers';

// ============================================================================
// Types
// ============================================================================

/**
 * Enrichment levels control how deep we go with enrichment
 */
export type EnrichmentLevel = 'basic' | 'standard' | 'deep' | 'full';

/**
 * Configuration for what each enrichment level includes
 */
export interface EnrichmentLevelConfig {
  traffic: boolean;
  techStack: boolean;
  competitors: boolean;
  financials: boolean;
  hiring: boolean;
  executive: boolean;
  investor: boolean;
}

/**
 * Progress stage names
 */
export type EnrichmentStage =
  | 'traffic'
  | 'techStack'
  | 'competitors'
  | 'financials'
  | 'hiring'
  | 'executive'
  | 'investor';

/**
 * Progress callback data
 */
export interface EnrichmentProgress {
  stage: EnrichmentStage;
  status: 'pending' | 'loading' | 'success' | 'error' | 'skipped';
  message?: string;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: EnrichmentProgress) => void;

/**
 * Error information for a stage
 */
export interface EnrichmentError {
  stage: EnrichmentStage;
  error: string;
}

/**
 * Full enrichment result containing all data sources
 */
export interface EnrichmentResult {
  domain: string;
  company_name?: string;

  // Traffic data (SimilarWeb)
  traffic?: TrafficData | null;

  // Tech stack (BuiltWith)
  techStack?: TechStackData | null;

  // Competitors (SimilarWeb + BuiltWith)
  competitors?: CompetitorData | null;

  // Financials (Yahoo Finance)
  financials?: ExtendedFinancialData | null;

  // Hiring (WebSearch)
  hiring?: EnrichedHiringData | null;

  // Executive quotes (WebSearch)
  executive?: ExecutiveInsights | null;

  // Investor intelligence (WebSearch)
  investor?: InvestorIntelligence | null;

  // Metadata
  enrichment_level: EnrichmentLevel;
  data_completeness: number; // 0-100
  errors: EnrichmentError[];
  fetched_at: string;
}

/**
 * Options for the main enrich method
 */
export interface EnrichOptions {
  companyName?: string;
  ticker?: string;
  forceRefresh?: boolean;
  onProgress?: ProgressCallback;
  searchExecutor?: SearchExecutor;
}

/**
 * Options for batch enrichment
 */
export interface BatchEnrichOptions {
  level?: EnrichmentLevel;
  concurrency?: number;
  onProgress?: (completed: number, total: number, domain: string, result?: EnrichmentResult) => void;
  searchExecutor?: SearchExecutor;
}

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * What each enrichment level includes
 */
export const ENRICHMENT_LEVELS: Record<EnrichmentLevel, EnrichmentLevelConfig> = {
  basic: {
    traffic: false,
    techStack: true,
    competitors: false,
    financials: false,
    hiring: false,
    executive: false,
    investor: false,
  },
  standard: {
    traffic: true,
    techStack: true,
    competitors: false,
    financials: false,
    hiring: false,
    executive: false,
    investor: false,
  },
  deep: {
    traffic: true,
    techStack: true,
    competitors: true,
    financials: true,
    hiring: false,
    executive: false,
    investor: false,
  },
  full: {
    traffic: true,
    techStack: true,
    competitors: true,
    financials: true,
    hiring: true,
    executive: true,
    investor: true,
  },
};

/**
 * Stage names for display
 */
export const STAGE_NAMES: Record<EnrichmentStage, string> = {
  traffic: 'Traffic & Engagement',
  techStack: 'Tech Stack',
  competitors: 'Competitors',
  financials: 'Financials',
  hiring: 'Hiring Signals',
  executive: 'Executive Insights',
  investor: 'Investor Intelligence',
};

/**
 * Default rate limit between API calls (ms)
 */
const DEFAULT_RATE_LIMIT = 500;

/**
 * Default cache TTL (24 hours)
 */
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;

// ============================================================================
// Orchestrator Class
// ============================================================================

export class EnrichmentOrchestrator {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheTTL: number;
  private rateLimit: number;

  constructor(options?: { cacheTTL?: number; rateLimit?: number }) {
    this.cacheTTL = options?.cacheTTL ?? DEFAULT_CACHE_TTL;
    this.rateLimit = options?.rateLimit ?? DEFAULT_RATE_LIMIT;
  }

  // ==========================================================================
  // Main Enrichment Method
  // ==========================================================================

  /**
   * Main enrichment method - orchestrates all data sources
   */
  async enrich(
    domain: string,
    level: EnrichmentLevel = 'standard',
    options?: EnrichOptions
  ): Promise<EnrichmentResult> {
    const config = ENRICHMENT_LEVELS[level];
    const onProgress = options?.onProgress;
    const forceRefresh = options?.forceRefresh ?? false;

    const result: EnrichmentResult = {
      domain,
      company_name: options?.companyName,
      enrichment_level: level,
      errors: [],
      data_completeness: 0,
      fetched_at: new Date().toISOString(),
    };

    // ========================================================================
    // Phase 1: Traffic + TechStack (independent, run in parallel)
    // ========================================================================
    const phase1Promises: Promise<void>[] = [];

    if (config.traffic) {
      phase1Promises.push(
        this.enrichTrafficWithProgress(domain, result, onProgress, forceRefresh)
      );
    } else {
      onProgress?.({ stage: 'traffic', status: 'skipped' });
    }

    if (config.techStack) {
      phase1Promises.push(
        this.enrichTechStackWithProgress(domain, result, onProgress, forceRefresh)
      );
    } else {
      onProgress?.({ stage: 'techStack', status: 'skipped' });
    }

    await Promise.all(phase1Promises);

    // ========================================================================
    // Phase 2: Competitors + Financials (can use Phase 1 results)
    // ========================================================================
    const phase2Promises: Promise<void>[] = [];

    if (config.competitors) {
      phase2Promises.push(
        this.enrichCompetitorsWithProgress(domain, result, onProgress, forceRefresh)
      );
    } else {
      onProgress?.({ stage: 'competitors', status: 'skipped' });
    }

    if (config.financials) {
      phase2Promises.push(
        this.enrichFinancialsWithProgress(
          domain,
          result,
          onProgress,
          forceRefresh,
          options?.ticker
        )
      );
    } else {
      onProgress?.({ stage: 'financials', status: 'skipped' });
    }

    await Promise.all(phase2Promises);

    // ========================================================================
    // Phase 3: WebSearch-based signals (Hiring, Executive, Investor - parallel)
    // ========================================================================
    const phase3Promises: Promise<void>[] = [];

    if (config.hiring) {
      phase3Promises.push(
        this.enrichHiringWithProgress(
          domain,
          result,
          onProgress,
          forceRefresh,
          options?.companyName,
          options?.searchExecutor
        )
      );
    } else {
      onProgress?.({ stage: 'hiring', status: 'skipped' });
    }

    if (config.executive) {
      phase3Promises.push(
        this.enrichExecutiveWithProgress(
          domain,
          result,
          onProgress,
          forceRefresh,
          options?.companyName,
          options?.searchExecutor
        )
      );
    } else {
      onProgress?.({ stage: 'executive', status: 'skipped' });
    }

    if (config.investor) {
      phase3Promises.push(
        this.enrichInvestorWithProgress(
          domain,
          result,
          onProgress,
          forceRefresh,
          options?.companyName,
          options?.ticker,
          options?.searchExecutor
        )
      );
    } else {
      onProgress?.({ stage: 'investor', status: 'skipped' });
    }

    await Promise.all(phase3Promises);

    // ========================================================================
    // Calculate data completeness
    // ========================================================================
    result.data_completeness = this.calculateDataCompleteness(result, level);

    return result;
  }

  // ==========================================================================
  // Individual Enrichment Methods with Progress
  // ==========================================================================

  private async enrichTrafficWithProgress(
    domain: string,
    result: EnrichmentResult,
    onProgress?: ProgressCallback,
    forceRefresh?: boolean
  ): Promise<void> {
    onProgress?.({ stage: 'traffic', status: 'loading', message: 'Fetching traffic data...' });
    try {
      const data = await this.enrichTraffic(domain, forceRefresh);
      result.traffic = data;
      onProgress?.({
        stage: 'traffic',
        status: 'success',
        message: data ? `${this.formatNumber(data.monthly_visits)} monthly visits` : 'No data',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push({ stage: 'traffic', error: message });
      onProgress?.({ stage: 'traffic', status: 'error', message });
    }
  }

  private async enrichTechStackWithProgress(
    domain: string,
    result: EnrichmentResult,
    onProgress?: ProgressCallback,
    forceRefresh?: boolean
  ): Promise<void> {
    onProgress?.({ stage: 'techStack', status: 'loading', message: 'Detecting tech stack...' });
    try {
      const data = await this.enrichTechStack(domain, forceRefresh);
      result.techStack = data;
      onProgress?.({
        stage: 'techStack',
        status: 'success',
        message: data ? `${data.technologies.length} technologies detected` : 'No data',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push({ stage: 'techStack', error: message });
      onProgress?.({ stage: 'techStack', status: 'error', message });
    }
  }

  private async enrichCompetitorsWithProgress(
    domain: string,
    result: EnrichmentResult,
    onProgress?: ProgressCallback,
    forceRefresh?: boolean
  ): Promise<void> {
    onProgress?.({ stage: 'competitors', status: 'loading', message: 'Finding competitors...' });
    try {
      const data = await this.enrichCompetitors(domain, forceRefresh);
      result.competitors = data;
      onProgress?.({
        stage: 'competitors',
        status: 'success',
        message: data ? `${data.competitors.length} competitors found` : 'No data',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push({ stage: 'competitors', error: message });
      onProgress?.({ stage: 'competitors', status: 'error', message });
    }
  }

  private async enrichFinancialsWithProgress(
    domain: string,
    result: EnrichmentResult,
    onProgress?: ProgressCallback,
    forceRefresh?: boolean,
    ticker?: string
  ): Promise<void> {
    onProgress?.({ stage: 'financials', status: 'loading', message: 'Fetching financials...' });
    try {
      const data = await this.enrichFinancials(domain, forceRefresh, ticker);
      result.financials = data;
      onProgress?.({
        stage: 'financials',
        status: 'success',
        message: data?.is_public
          ? `Public company: ${data.ticker}`
          : data ? 'Private company (estimated)' : 'No data',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push({ stage: 'financials', error: message });
      onProgress?.({ stage: 'financials', status: 'error', message });
    }
  }

  private async enrichHiringWithProgress(
    domain: string,
    result: EnrichmentResult,
    onProgress?: ProgressCallback,
    forceRefresh?: boolean,
    companyName?: string,
    searchExecutor?: SearchExecutor
  ): Promise<void> {
    onProgress?.({ stage: 'hiring', status: 'loading', message: 'Analyzing hiring signals...' });
    try {
      const data = await this.enrichHiring(domain, forceRefresh, companyName, searchExecutor);
      result.hiring = data;
      onProgress?.({
        stage: 'hiring',
        status: 'success',
        message: data ? `${data.signal_strength} signal, ${data.total_openings} openings` : 'No data',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push({ stage: 'hiring', error: message });
      onProgress?.({ stage: 'hiring', status: 'error', message });
    }
  }

  private async enrichExecutiveWithProgress(
    domain: string,
    result: EnrichmentResult,
    onProgress?: ProgressCallback,
    forceRefresh?: boolean,
    companyName?: string,
    searchExecutor?: SearchExecutor
  ): Promise<void> {
    onProgress?.({ stage: 'executive', status: 'loading', message: 'Finding executive insights...' });
    try {
      const data = await this.enrichExecutive(domain, forceRefresh, companyName, searchExecutor);
      result.executive = data;
      onProgress?.({
        stage: 'executive',
        status: 'success',
        message: data ? `${data.total_quotes} quotes found` : 'No data',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push({ stage: 'executive', error: message });
      onProgress?.({ stage: 'executive', status: 'error', message });
    }
  }

  private async enrichInvestorWithProgress(
    domain: string,
    result: EnrichmentResult,
    onProgress?: ProgressCallback,
    forceRefresh?: boolean,
    companyName?: string,
    ticker?: string,
    searchExecutor?: SearchExecutor
  ): Promise<void> {
    onProgress?.({ stage: 'investor', status: 'loading', message: 'Gathering investor intelligence...' });
    try {
      const data = await this.enrichInvestor(domain, forceRefresh, companyName, ticker, searchExecutor);
      result.investor = data;
      onProgress?.({
        stage: 'investor',
        status: 'success',
        message: data ? `${data.sec_filings.length} filings, ${data.risk_factors.length} risk factors` : 'No data',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push({ stage: 'investor', error: message });
      onProgress?.({ stage: 'investor', status: 'error', message });
    }
  }

  // ==========================================================================
  // Individual Enrichment Methods (Public API)
  // ==========================================================================

  /**
   * Enrich traffic data only
   */
  async enrichTraffic(domain: string, forceRefresh?: boolean): Promise<TrafficData | null> {
    const cacheKey = `traffic:${domain}`;

    // Check cache
    if (!forceRefresh) {
      const cached = this.getCachedData<SimilarWebFullData>(cacheKey);
      if (cached) {
        return transformTrafficData(domain, cached);
      }
    }

    // Fetch fresh data
    const swData = await similarWebClient.getFullData(domain);
    if (!swData) return null;

    // Cache the raw data
    this.setCachedData(cacheKey, swData);

    return transformTrafficData(domain, swData);
  }

  /**
   * Enrich tech stack only
   */
  async enrichTechStack(domain: string, forceRefresh?: boolean): Promise<TechStackData | null> {
    const cacheKey = `techstack:${domain}`;

    // Check cache
    if (!forceRefresh) {
      const cached = this.getCachedData<BuiltWithFullData>(cacheKey);
      if (cached?.tech_stack) {
        return transformTechStackFromBuiltWith(domain, cached.tech_stack);
      }
    }

    // Fetch fresh data
    const bwData = await builtWithClient.getFullData(domain);
    if (!bwData?.tech_stack) return null;

    // Cache the raw data
    this.setCachedData(cacheKey, bwData);

    return transformTechStackFromBuiltWith(domain, bwData.tech_stack);
  }

  /**
   * Enrich competitors only
   */
  async enrichCompetitors(domain: string, forceRefresh?: boolean): Promise<CompetitorData | null> {
    const cacheKey = `competitors:${domain}`;

    // Check cache
    if (!forceRefresh) {
      const cached = this.getCachedData<CompetitorData>(cacheKey);
      if (cached) return cached;
    }

    // Get similar sites from SimilarWeb
    const similarSites = await similarWebClient.getSimilarSites(domain);
    if (!similarSites || similarSites.length === 0) return null;

    // Enrich top competitors with tech stack
    const topCompetitors = similarSites.slice(0, 8);
    const techStackMap = new Map<string, BuiltWithTechStack>();

    // Fetch tech stacks in sequence with rate limiting
    for (const site of topCompetitors) {
      try {
        const bwData = await builtWithClient.getFullData(site.domain);
        if (bwData?.tech_stack) {
          techStackMap.set(site.domain, bwData.tech_stack);
        }
        // Rate limit
        await this.delay(this.rateLimit);
      } catch (err) {
        console.warn(`[Orchestrator] Error fetching tech stack for ${site.domain}:`, err);
      }
    }

    // Transform to CompetitorData
    const competitorData = transformCompetitorData(domain, topCompetitors, techStackMap);

    // Cache the result
    this.setCachedData(cacheKey, competitorData);

    return competitorData;
  }

  /**
   * Enrich financials only
   */
  async enrichFinancials(
    domain: string,
    forceRefresh?: boolean,
    ticker?: string
  ): Promise<ExtendedFinancialData | null> {
    const cacheKey = `financials:${domain}`;

    // Check cache
    if (!forceRefresh) {
      const cached = this.getCachedData<ExtendedFinancialData>(cacheKey);
      if (cached) return cached;
    }

    // Try to resolve ticker if not provided
    const resolvedTicker = ticker || await yahooFinanceClient.resolveTicker(domain);

    if (resolvedTicker) {
      // Public company - fetch Yahoo Finance data
      const yfData = await yahooFinanceClient.getFullDataByDomain(domain);
      if (yfData) {
        // Use transformFullFinancialData for ExtendedFinancialData
        const extended = transformFullFinancialData(
          yfData.stock_info,
          yfData.financials_3_year?.income_statements?.[0] || null,
          yfData.financials_3_year?.balance_sheets?.[0] || null,
          yfData.recommendations,
          yfData
        );
        if (extended) {
          this.setCachedData(cacheKey, extended);
          return extended;
        }
      }
    }

    // Private company - no financial data available
    // Return null as we cannot estimate without employee/funding data
    return null;
  }

  /**
   * Enrich hiring signals only
   */
  async enrichHiring(
    domain: string,
    forceRefresh?: boolean,
    companyName?: string,
    searchExecutor?: SearchExecutor
  ): Promise<EnrichedHiringData | null> {
    const cacheKey = `hiring:${domain}`;

    // Check cache
    if (!forceRefresh) {
      const cached = this.getCachedData<EnrichedHiringData>(cacheKey);
      if (cached) return cached;
    }

    const name = companyName || this.extractCompanyName(domain);

    // Build search queries
    const queries = webSearchProxy.getHiringSearchQueries(name, domain);

    // If we have a search executor, use it
    if (searchExecutor) {
      try {
        const results = await Promise.all(
          queries.slice(0, 5).map(q => searchExecutor.search(q))
        );
        const flatResults = results.flat();
        const hiringSignal = webSearchProxy.parseHiringResults(flatResults);
        // First transform to HiringData, then to EnrichedHiringData
        const hiringData = transformHiringData(domain, hiringSignal);
        if (hiringData) {
          const enriched = transformToEnrichedHiringData(hiringData);
          this.setCachedData(cacheKey, enriched);
          return enriched;
        }
      } catch (err) {
        console.warn('[Orchestrator] Hiring search failed:', err);
      }
    }

    // Return empty EnrichedHiringData structure if no search executor
    const emptyEnriched: EnrichedHiringData = {
      signal_strength: 'none',
      total_openings: 0,
      relevant_openings: 0,
      tier_breakdown: {
        executive: 0,
        director: 0,
        ic: 0,
      },
      key_roles: [],
      tech_signals: {
        keywords_detected: [],
        search_tech_mentioned: false,
        ecommerce_focus: false,
        data_engineering_focus: false,
      },
      growth_indicators: {
        is_scaling_engineering: false,
        is_scaling_product: false,
        is_building_search_team: false,
      },
      fetched_at: new Date().toISOString(),
    };
    return emptyEnriched;
  }

  /**
   * Enrich executive insights only
   */
  async enrichExecutive(
    domain: string,
    forceRefresh?: boolean,
    companyName?: string,
    searchExecutor?: SearchExecutor
  ): Promise<ExecutiveInsights | null> {
    const cacheKey = `executive:${domain}`;

    // Check cache
    if (!forceRefresh) {
      const cached = this.getCachedData<ExecutiveInsights>(cacheKey);
      if (cached) return cached;
    }

    const name = companyName || this.extractCompanyName(domain);

    // Build search queries
    const queries = webSearchProxy.getExecutiveSearchQueries(name);

    // If we have a search executor, use it
    if (searchExecutor) {
      try {
        const results = await Promise.all(
          queries.slice(0, 5).map(q => searchExecutor.search(q))
        );
        const flatResults = results.flat();
        const rawExecData = webSearchProxy.parseExecutiveResults(flatResults, domain);
        // First transform to ExecutiveData, then to ExecutiveInsights
        const execData = transformExecutiveData(domain, rawExecData);
        if (execData) {
          const insights = transformToExecutiveInsights(execData);
          this.setCachedData(cacheKey, insights);
          return insights;
        }
      } catch (err) {
        console.warn('[Orchestrator] Executive search failed:', err);
      }
    }

    // Return empty ExecutiveInsights structure if no search executor or data
    const emptyInsights: ExecutiveInsights = {
      key_quotes: [],
      strategic_themes: [],
      key_executives: [],
      total_quotes: 0,
      high_relevance_quotes: 0,
      themes_identified: 0,
      speaking_their_language: [],
      fetched_at: new Date().toISOString(),
    };
    return emptyInsights;
  }

  /**
   * Enrich investor intelligence only
   */
  async enrichInvestor(
    domain: string,
    forceRefresh?: boolean,
    companyName?: string,
    ticker?: string,
    searchExecutor?: SearchExecutor
  ): Promise<InvestorIntelligence | null> {
    const cacheKey = `investor:${domain}`;

    // Check cache
    if (!forceRefresh) {
      const cached = this.getCachedData<InvestorIntelligence>(cacheKey);
      if (cached) return cached;
    }

    const name = companyName || this.extractCompanyName(domain);
    const resolvedTicker = ticker || await yahooFinanceClient.resolveTicker(domain);

    // Build search queries
    const queries = webSearchProxy.getInvestorSearchQueries(name, resolvedTicker || undefined);

    // If we have a search executor, use it
    if (searchExecutor) {
      try {
        const results = await Promise.all(
          queries.slice(0, 5).map(q => searchExecutor.search(q))
        );
        const flatResults = results.flat();
        const rawInvestorData = webSearchProxy.parseInvestorResults(flatResults, domain);
        if (rawInvestorData) {
          // First transform to InvestorData, then to InvestorIntelligence
          const investorData = transformInvestorData(domain, rawInvestorData);
          if (investorData) {
            const intelligence = transformToInvestorIntelligence(investorData);
            this.setCachedData(cacheKey, intelligence);
            return intelligence;
          }
        }
      } catch (err) {
        console.warn('[Orchestrator] Investor search failed:', err);
      }
    }

    // Return null if no investor data available
    return null;
  }

  // ==========================================================================
  // Batch Enrichment
  // ==========================================================================

  /**
   * Enrich multiple domains with concurrency control
   */
  async enrichBatch(
    domains: string[],
    options?: BatchEnrichOptions
  ): Promise<Map<string, EnrichmentResult>> {
    const level = options?.level ?? 'standard';
    const concurrency = options?.concurrency ?? 3;
    const onProgress = options?.onProgress;

    const results = new Map<string, EnrichmentResult>();
    const queue = [...domains];
    let completed = 0;

    // Process in batches based on concurrency
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);

      await Promise.all(
        batch.map(async (domain) => {
          try {
            const result = await this.enrich(domain, level, {
              searchExecutor: options?.searchExecutor,
            });
            results.set(domain, result);
            completed++;
            onProgress?.(completed, domains.length, domain, result);
          } catch (err) {
            console.error(`[Orchestrator] Batch error for ${domain}:`, err);
            const errorResult: EnrichmentResult = {
              domain,
              enrichment_level: level,
              errors: [{ stage: 'traffic', error: err instanceof Error ? err.message : 'Unknown error' }],
              data_completeness: 0,
              fetched_at: new Date().toISOString(),
            };
            results.set(domain, errorResult);
            completed++;
            onProgress?.(completed, domains.length, domain, errorResult);
          }
        })
      );

      // Rate limit between batches
      if (queue.length > 0) {
        await this.delay(this.rateLimit);
      }
    }

    return results;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Get cached data if valid
   */
  getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached data
   */
  setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cached data for a specific domain
   */
  clearDomainCache(domain: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(domain)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // ==========================================================================
  // Data Completeness Calculation
  // ==========================================================================

  /**
   * Calculate data completeness percentage based on enrichment level
   */
  calculateDataCompleteness(result: EnrichmentResult, level: EnrichmentLevel): number {
    const config = ENRICHMENT_LEVELS[level];
    let totalFields = 0;
    let filledFields = 0;

    // Count expected vs actual fields
    if (config.traffic) {
      totalFields++;
      if (result.traffic) filledFields++;
    }

    if (config.techStack) {
      totalFields++;
      if (result.techStack) filledFields++;
    }

    if (config.competitors) {
      totalFields++;
      if (result.competitors) filledFields++;
    }

    if (config.financials) {
      totalFields++;
      if (result.financials) filledFields++;
    }

    if (config.hiring) {
      totalFields++;
      if (result.hiring) filledFields++;
    }

    if (config.executive) {
      totalFields++;
      if (result.executive) filledFields++;
    }

    if (config.investor) {
      totalFields++;
      if (result.investor) filledFields++;
    }

    if (totalFields === 0) return 0;
    return Math.round((filledFields / totalFields) * 100);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Format number for display
   */
  private formatNumber(num: number): string {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  }

  /**
   * Extract company name from domain
   */
  private extractCompanyName(domain: string): string {
    // Remove common TLDs and www
    const cleanDomain = domain
      .replace(/^www\./, '')
      .replace(/\.(com|org|net|io|co|us|uk|de|fr|jp)$/, '');

    // Capitalize first letter of each word
    return cleanDomain
      .split(/[-_.]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const enrichmentOrchestrator = new EnrichmentOrchestrator();
