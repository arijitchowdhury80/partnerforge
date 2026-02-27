/**
 * SimilarWeb Source Module
 *
 * Provides: Traffic, engagement, similar sites
 * API: SimilarWeb Addon API (via Edge Function proxy)
 *
 * SECURITY: API key is stored in Supabase Secrets, NOT in frontend bundle
 */

import type { SourceModule, SourceResult, SimilarWebData, SourceOptions } from '../types';
import { callEnrichProxy } from '@/services/supabase';

export const similarweb: SourceModule<SimilarWebData> = {
  id: 'similarweb',
  name: 'SimilarWeb',

  // Edge Function availability checked at runtime
  isAvailable: () => true,

  async enrich(domain: string, _options?: SourceOptions): Promise<SourceResult<SimilarWebData>> {
    const startTime = Date.now();

    try {
      const { data: raw, error } = await callEnrichProxy<Record<string, unknown>>({
        source: 'similarweb',
        domain,
      });

      if (error || !raw) {
        throw new Error(error || 'No data returned');
      }

      // Transform to our standard format
      const estimatedVisits = raw.EstimatedMonthlyVisits as Record<string, number> | undefined;
      const data: SimilarWebData = {
        monthly_visits: estimatedVisits?.[Object.keys(estimatedVisits || {})[0]] || (raw.visits as number) || 0,
        bounce_rate: (raw.BounceRate as number) || (raw.bounce_rate as number) || 0,
        pages_per_visit: (raw.PagesPerVisit as number) || (raw.pages_per_visit as number) || 0,
        avg_visit_duration: (raw.TimeOnSite as number) || (raw.avg_visit_duration as number) || 0,
        global_rank: (raw.GlobalRank as { Rank?: number })?.Rank || (raw.global_rank as number) || undefined,
        country_rank: (raw.CountryRank as { Rank?: number })?.Rank || undefined,
        traffic_sources: {
          direct: (raw.TrafficSources as Record<string, number>)?.Direct || 0,
          search: ((raw.TrafficSources as Record<string, number>)?.OrganicSearch || 0) + ((raw.TrafficSources as Record<string, number>)?.PaidSearch || 0),
          referral: (raw.TrafficSources as Record<string, number>)?.Referrals || 0,
          social: (raw.TrafficSources as Record<string, number>)?.Social || 0,
          mail: (raw.TrafficSources as Record<string, number>)?.Mail || 0,
          paid: (raw.TrafficSources as Record<string, number>)?.PaidSearch || 0,
        },
        top_countries: ((raw.TopCountryShares as Array<{ CountryCode?: string; country?: string; Value?: number; share?: number }>) || []).slice(0, 5).map((c) => ({
          country: c.CountryCode || c.country || 'Unknown',
          percentage: c.Value || c.share || 0,
        })),
        similar_sites: ((raw.SimilarSites as Array<{ Site?: string; domain?: string; Score?: number; similarity?: number }>) || []).slice(0, 10).map((s) => ({
          domain: s.Site || s.domain || String(s),
          similarity: s.Score || s.similarity || 0,
        })),
      };

      console.log(`[SimilarWeb] ${domain}: ${data.monthly_visits.toLocaleString()} visits (${Date.now() - startTime}ms)`);

      return {
        source: 'similarweb',
        success: true,
        data,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[SimilarWeb] ${domain}: ${error}`);

      return {
        source: 'similarweb',
        success: false,
        data: null,
        error,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }
  },
};

export default similarweb;
