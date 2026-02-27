/**
 * Enrichment v3 - The Umbrella
 *
 * Clean, unified enrichment interface.
 *
 * Usage:
 *   // Enrich ALL sources
 *   await enrich('costco.com');
 *
 *   // Enrich specific sources
 *   await enrich('costco.com', { sources: ['similarweb', 'builtwith'] });
 *
 *   // Enrich single source
 *   await enrich('costco.com', { sources: ['jsearch'] });
 *
 * To add a new source:
 *   1. Create file in sources/ folder
 *   2. Add export in sources/index.ts
 *   Done!
 */

import { SOURCES, getSource, getAvailableSources } from './sources';
import { calculateCompositeScore, getStatusFromCompositeScore } from '@/services/scoring';
import type { Company } from '@/types';
import type {
  SourceId,
  SourceResult,
  EnrichOptions,
  EnrichProgress,
  EnrichmentResult,
  SupabaseUpdatePayload,
  SimilarWebData,
  BuiltWithData,
  YahooFinanceData,
  SecEdgarData,
  WebSearchData,
  JSearchData,
  ALL_SOURCES,
} from './types';

// =============================================================================
// Supabase Config
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// =============================================================================
// Main Enrichment Function
// =============================================================================

/**
 * Enrich a domain with data from multiple sources
 *
 * @param domain - Domain to enrich (e.g., 'costco.com')
 * @param options - Enrichment options
 * @returns Full enrichment result with all source data
 *
 * @example
 * // Enrich all sources
 * const result = await enrich('costco.com');
 *
 * // Enrich specific sources
 * const result = await enrich('costco.com', { sources: ['similarweb', 'builtwith'] });
 *
 * // With progress callback
 * const result = await enrich('costco.com', {
 *   onProgress: (p) => console.log(`${p.source}: ${p.status}`)
 * });
 */
export async function enrich(
  domain: string,
  options: EnrichOptions = {}
): Promise<EnrichmentResult> {
  const {
    sources: requestedSources,
    forceRefresh = false,
    companyName,
    ticker,
    onProgress,
  } = options;

  // Determine which sources to run
  const sourcesToRun: SourceId[] = requestedSources?.length
    ? requestedSources
    : (['similarweb', 'builtwith', 'yahoofinance', 'secedgar', 'websearch', 'jsearch'] as SourceId[]);

  // Initialize result
  const result: EnrichmentResult = {
    domain,
    company_name: companyName,
    sources_requested: sourcesToRun,
    sources_completed: [],
    sources_failed: [],
    similarweb: null,
    builtwith: null,
    yahoofinance: null,
    secedgar: null,
    websearch: null,
    jsearch: null,
    data_completeness: 0,
    enriched_at: new Date().toISOString(),
  };

  // Run each source in parallel
  const promises = sourcesToRun.map(async (sourceId) => {
    const source = getSource(sourceId);

    // Check availability
    if (!source.isAvailable()) {
      onProgress?.({ source: sourceId, status: 'skipped', message: 'Not available' });
      return;
    }

    // Notify start
    onProgress?.({ source: sourceId, status: 'fetching' });

    try {
      // Run enrichment
      const sourceResult = await source.enrich(domain, {
        companyName,
        ticker,
        forceRefresh,
      });

      // Store result
      (result as any)[sourceId] = sourceResult;

      if (sourceResult.success) {
        result.sources_completed.push(sourceId);
        onProgress?.({ source: sourceId, status: 'success' });
      } else {
        result.sources_failed.push(sourceId);
        onProgress?.({ source: sourceId, status: 'error', message: sourceResult.error });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      result.sources_failed.push(sourceId);
      onProgress?.({ source: sourceId, status: 'error', message: error });

      (result as any)[sourceId] = {
        source: sourceId,
        success: false,
        data: null,
        error,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }
  });

  // Wait for all sources
  await Promise.all(promises);

  // Calculate data completeness
  result.data_completeness = Math.round(
    (result.sources_completed.length / sourcesToRun.length) * 100
  );

  return result;
}

// =============================================================================
// Save to Supabase
// =============================================================================

/**
 * Save enrichment results to Supabase
 */
export async function saveToSupabase(
  domain: string,
  result: EnrichmentResult
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[Enrichment] Supabase not configured');
    return false;
  }

  const payload: SupabaseUpdatePayload = {
    last_enriched: new Date().toISOString(),
    enrichment_sources: result.sources_completed,
  };

  // SimilarWeb data
  if (result.similarweb?.success && result.similarweb.data) {
    const sw = result.similarweb.data;
    payload.sw_monthly_visits = sw.monthly_visits;
    payload.sw_bounce_rate = sw.bounce_rate;
    payload.sw_pages_per_visit = sw.pages_per_visit;
    payload.sw_avg_duration = sw.avg_visit_duration;
    payload.sw_global_rank = sw.global_rank;
    payload.traffic_sources_json = JSON.stringify(sw.traffic_sources);
    payload.similar_sites_json = JSON.stringify(sw.similar_sites);
  }

  // BuiltWith data
  if (result.builtwith?.success && result.builtwith.data) {
    const bw = result.builtwith.data;
    payload.tech_stack_json = JSON.stringify(bw.technologies);
    payload.current_search = bw.search_provider;
    payload.ecommerce_platform = bw.ecommerce_platform;
    payload.cms = bw.cms;
    payload.partner_tech = bw.partner_tech;
  }

  // Yahoo Finance data
  if (result.yahoofinance?.success && result.yahoofinance.data) {
    const yf = result.yahoofinance.data;
    payload.ticker = yf.ticker;
    payload.revenue = yf.revenue;
    payload.net_income = yf.net_income;
    payload.market_cap = yf.market_cap;
    payload.employees = yf.employees;
    payload.revenue_growth = yf.revenue_growth;
    payload.financials_json = JSON.stringify({
      revenue_history: yf.revenue_history,
      income_history: yf.income_history,
      analyst_rating: yf.analyst_rating,
    });
  }

  // SEC EDGAR data
  if (result.secedgar?.success && result.secedgar.data) {
    const sec = result.secedgar.data;
    payload.cik = sec.cik;
    payload.sec_filings_json = JSON.stringify(sec.filings);
    payload.risk_factors_json = JSON.stringify(sec.risk_factors);
  }

  // WebSearch data
  if (result.websearch?.success && result.websearch.data) {
    const ws = result.websearch.data;
    payload.exec_quotes_json = JSON.stringify(ws.executive_quotes);
    payload.strategic_signals_json = JSON.stringify(ws.strategic_signals);
  }

  // JSearch data
  if (result.jsearch?.success && result.jsearch.data) {
    const js = result.jsearch.data;
    payload.hiring_signal_score = js.signal_score;
    payload.hiring_signal_strength = js.signal_strength;
    payload.hiring_jobs_json = JSON.stringify(js.top_jobs);
  }

  // ==========================================================================
  // Calculate Composite Score from enriched data
  // This replaces the old icp_score with a multi-factor composite score
  // ==========================================================================

  // Build a partial Company object for scoring
  const companyForScoring: Partial<Company> = {
    domain,
    company_name: result.company_name,
    // SimilarWeb data
    sw_monthly_visits: result.similarweb?.data?.monthly_visits,
    sw_bounce_rate: result.similarweb?.data?.bounce_rate,
    similar_sites: result.similarweb?.data?.similar_sites,
    // BuiltWith data
    partner_tech: result.builtwith?.data?.partner_tech,
    current_search: result.builtwith?.data?.search_provider,
    // Yahoo Finance data
    revenue: result.yahoofinance?.data?.revenue,
    revenue_growth: result.yahoofinance?.data?.revenue_growth,
    profit_margins: result.yahoofinance?.data?.profit_margins,
    analyst_rating: result.yahoofinance?.data?.analyst_rating,
    employee_count: result.yahoofinance?.data?.employees,
    is_public: !!result.yahoofinance?.data?.ticker,
    ticker: result.yahoofinance?.data?.ticker,
    // SEC EDGAR data
    has_tech_risk_factors: result.secedgar?.data?.risk_factors?.some(
      (rf: { algolia_relevance?: string }) => rf.algolia_relevance === 'high'
    ),
    has_digital_mentions: (result.secedgar?.data?.digital_mentions?.length || 0) > 0,
    // JSearch data
    hiring_signal_score: result.jsearch?.data?.signal_score,
    hiring_signal_strength: result.jsearch?.data?.signal_strength,
    hiring_has_search_roles: result.jsearch?.data?.category_breakdown?.search > 0,
    hiring_has_ecommerce_roles: result.jsearch?.data?.category_breakdown?.ecommerce > 0,
    // WebSearch data
    exec_quote: result.websearch?.data?.executive_quotes?.[0]?.quote,
    exec_quotes_count: result.websearch?.data?.executive_quotes?.length,
  };

  // Calculate composite score
  const compositeScore = calculateCompositeScore(companyForScoring as Company);

  // Save composite score to icp_score column (replaces old simple score)
  payload.icp_score = compositeScore.total;
  payload.status = getStatusFromCompositeScore(compositeScore.total);

  console.log(`[Enrichment] Composite score for ${domain}: ${compositeScore.total} (${payload.status})`);
  console.log(`[Enrichment]   Factors: Fit=${compositeScore.factors.fit}, Intent=${compositeScore.factors.intent}, Value=${compositeScore.factors.value}, Displacement=${compositeScore.factors.displacement}`);
  console.log(`[Enrichment]   Confidence: ${compositeScore.confidence} (${compositeScore.dataCompleteness}% data)`);

  try {
    const url = `${SUPABASE_URL}/rest/v1/displacement_targets?domain=eq.${encodeURIComponent(domain)}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[Enrichment] Supabase PATCH failed: ${response.status}`);
      return false;
    }

    console.log(`[Enrichment] Saved ${domain} to Supabase (${result.sources_completed.length} sources)`);
    return true;
  } catch (err) {
    console.warn('[Enrichment] Supabase save failed:', err);
    return false;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Enrich and save in one call
 */
export async function enrichAndSave(
  domain: string,
  options: EnrichOptions = {}
): Promise<EnrichmentResult> {
  const result = await enrich(domain, options);
  await saveToSupabase(domain, result);
  return result;
}

// SECURITY: Batch limits (MEDIUM-8)
const MAX_BATCH_SIZE = 100;
const MAX_CONCURRENCY = 5;
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

/**
 * Batch enrich multiple domains
 *
 * SECURITY: Limited to 100 domains per batch to prevent DoS (MEDIUM-8)
 */
export async function enrichBatch(
  domains: string[],
  options: EnrichOptions & {
    concurrency?: number;
    onDomainComplete?: (domain: string, result: EnrichmentResult, index: number) => void;
  } = {}
): Promise<Map<string, EnrichmentResult>> {
  // SECURITY: Input validation (MEDIUM-8)
  if (!Array.isArray(domains)) {
    throw new Error('Invalid domains: expected array');
  }
  if (domains.length === 0) {
    return new Map();
  }
  if (domains.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size limited to ${MAX_BATCH_SIZE} domains (received ${domains.length})`);
  }

  // Validate each domain
  const invalidDomains = domains.filter(d => !d || typeof d !== 'string' || !DOMAIN_REGEX.test(d.toLowerCase()));
  if (invalidDomains.length > 0) {
    throw new Error(`Invalid domain format: ${invalidDomains.slice(0, 3).join(', ')}${invalidDomains.length > 3 ? '...' : ''}`);
  }

  const { concurrency = 3, onDomainComplete, ...enrichOptions } = options;
  // SECURITY: Limit concurrency (MEDIUM-8)
  const safeConcurrency = Math.min(Math.max(1, concurrency), MAX_CONCURRENCY);
  const results = new Map<string, EnrichmentResult>();
  const queue = [...domains];
  let index = 0;

  // Process in batches with safe concurrency
  while (queue.length > 0) {
    const batch = queue.splice(0, safeConcurrency);

    await Promise.all(
      batch.map(async (domain) => {
        const result = await enrichAndSave(domain, enrichOptions);
        results.set(domain, result);
        onDomainComplete?.(domain, result, index++);
      })
    );

    // Rate limit between batches
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get list of available sources
 */
export function listAvailableSources(): { id: SourceId; name: string; available: boolean }[] {
  return Object.entries(SOURCES).map(([id, module]) => ({
    id: id as SourceId,
    name: module.name,
    available: module.isAvailable(),
  }));
}

// =============================================================================
// Exports
// =============================================================================

// Main functions
export { enrich, saveToSupabase, enrichAndSave, enrichBatch, listAvailableSources };

// Sources
export { SOURCES, getSource, getAvailableSources } from './sources';

// Types
export * from './types';
