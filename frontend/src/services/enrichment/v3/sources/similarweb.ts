/**
 * SimilarWeb Source Module
 *
 * Provides: Traffic, engagement, similar sites
 * API: SimilarWeb Addon API
 */

import type { SourceModule, SourceResult, SimilarWebData, SourceOptions } from '../types';

const API_KEY = import.meta.env.VITE_SIMILARWEB_API_KEY;
const BASE_URL = 'https://api.similarweb.com/v1/SimilarWebAddon';

export const similarweb: SourceModule<SimilarWebData> = {
  id: 'similarweb',
  name: 'SimilarWeb',

  isAvailable: () => !!API_KEY,

  async enrich(domain: string, _options?: SourceOptions): Promise<SourceResult<SimilarWebData>> {
    const startTime = Date.now();

    if (!API_KEY) {
      return {
        source: 'similarweb',
        success: false,
        data: null,
        error: 'No API key configured',
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }

    try {
      // Fetch all data from addon endpoint
      const url = `${BASE_URL}/${domain}/all?api_key=${API_KEY}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const raw = await response.json();

      // Transform to our standard format
      const data: SimilarWebData = {
        monthly_visits: raw.EstimatedMonthlyVisits?.[Object.keys(raw.EstimatedMonthlyVisits || {})[0]] || raw.visits || 0,
        bounce_rate: raw.BounceRate || raw.bounce_rate || 0,
        pages_per_visit: raw.PagesPerVisit || raw.pages_per_visit || 0,
        avg_visit_duration: raw.TimeOnSite || raw.avg_visit_duration || 0,
        global_rank: raw.GlobalRank?.Rank || raw.global_rank || undefined,
        country_rank: raw.CountryRank?.Rank || undefined,
        traffic_sources: {
          direct: raw.TrafficSources?.Direct || 0,
          search: (raw.TrafficSources?.OrganicSearch || 0) + (raw.TrafficSources?.PaidSearch || 0),
          referral: raw.TrafficSources?.Referrals || 0,
          social: raw.TrafficSources?.Social || 0,
          mail: raw.TrafficSources?.Mail || 0,
          paid: raw.TrafficSources?.PaidSearch || 0,
        },
        top_countries: (raw.TopCountryShares || []).slice(0, 5).map((c: any) => ({
          country: c.CountryCode || c.country || 'Unknown',
          percentage: c.Value || c.share || 0,
        })),
        similar_sites: (raw.SimilarSites || []).slice(0, 10).map((s: any) => ({
          domain: s.Site || s.domain || s,
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
