/**
 * Traffic Data Transformer
 *
 * Transforms SimilarWeb API data into the TrafficData type
 * used throughout the Arian application.
 */

import type { TrafficData, TrafficSource, CountryTraffic } from '@/types';
import type {
  SimilarWebFullData,
  SimilarWebTrafficSources,
  SimilarWebGeography,
} from '../clients/similarweb';

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform SimilarWeb API data into TrafficData type
 */
export function transformTrafficData(
  domain: string,
  swData: SimilarWebFullData | null
): TrafficData | null {
  if (!swData) return null;

  return {
    domain,
    monthly_visits: swData.traffic.monthly_visits,
    monthly_visits_trend: swData.traffic.monthly_visits_trend,
    bounce_rate: swData.traffic.bounce_rate,
    pages_per_visit: swData.traffic.pages_per_visit,
    avg_visit_duration: swData.traffic.avg_visit_duration,
    traffic_sources: transformTrafficSources(swData.sources),
    top_countries: transformGeography(swData.geography),
    device_distribution: estimateDeviceDistribution(swData),
  };
}

// ============================================================================
// Traffic Sources
// ============================================================================

/**
 * Transform SimilarWeb traffic sources into normalized TrafficSource array
 */
export function transformTrafficSources(
  sources: SimilarWebTrafficSources
): TrafficSource[] {
  return [
    { source: 'direct', percentage: sources.direct || 0 },
    { source: 'search', percentage: sources.search || 0 },
    { source: 'referral', percentage: sources.referral || 0 },
    { source: 'social', percentage: sources.social || 0 },
    { source: 'mail', percentage: sources.mail || 0 },
    { source: 'paid', percentage: sources.paid || 0 },
  ];
}

/**
 * Get the dominant traffic source
 */
export function getDominantTrafficSource(sources: TrafficSource[]): TrafficSource | null {
  if (!sources.length) return null;
  return sources.reduce((max, source) =>
    source.percentage > max.percentage ? source : max
  );
}

/**
 * Calculate organic vs paid traffic ratio
 */
export function getOrganicVsPaidRatio(sources: TrafficSource[]): {
  organic: number;
  paid: number;
} {
  const organic = sources
    .filter((s) => s.source !== 'paid')
    .reduce((sum, s) => sum + s.percentage, 0);
  const paid = sources.find((s) => s.source === 'paid')?.percentage || 0;

  return { organic, paid };
}

// ============================================================================
// Geography
// ============================================================================

/**
 * Transform SimilarWeb geography data into CountryTraffic array
 */
export function transformGeography(geo: SimilarWebGeography): CountryTraffic[] {
  if (!geo?.countries) return [];

  return geo.countries.map((c) => ({
    country: c.country,
    country_code: c.country_code,
    percentage: c.share,
  }));
}

/**
 * Get the primary country for the domain
 */
export function getPrimaryCountry(countries: CountryTraffic[]): CountryTraffic | null {
  if (!countries.length) return null;
  return countries.reduce((max, country) =>
    country.percentage > max.percentage ? country : max
  );
}

/**
 * Check if traffic is US-centric (>50% US traffic)
 */
export function isUSCentric(countries: CountryTraffic[]): boolean {
  const usTraffic = countries.find(
    (c) => c.country_code === 'US' || c.country.toLowerCase() === 'united states'
  );
  return (usTraffic?.percentage || 0) > 50;
}

/**
 * Get regional breakdown (Americas, EMEA, APAC)
 */
export function getRegionalBreakdown(countries: CountryTraffic[]): {
  americas: number;
  emea: number;
  apac: number;
} {
  const AMERICAS = ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE'];
  const APAC = [
    'CN', 'JP', 'KR', 'IN', 'AU', 'NZ', 'SG', 'HK', 'TH', 'MY', 'ID', 'PH', 'VN',
  ];
  // Everything else is EMEA

  let americas = 0;
  let apac = 0;
  let emea = 0;

  for (const country of countries) {
    const code = country.country_code.toUpperCase();
    if (AMERICAS.includes(code)) {
      americas += country.percentage;
    } else if (APAC.includes(code)) {
      apac += country.percentage;
    } else {
      emea += country.percentage;
    }
  }

  return { americas, emea, apac };
}

// ============================================================================
// Device Distribution
// ============================================================================

/**
 * Estimate device distribution from SimilarWeb data
 * Note: SimilarWeb doesn't always provide this, so we use industry defaults
 */
export function estimateDeviceDistribution(
  swData: SimilarWebFullData
): { desktop: number; mobile: number; tablet: number } {
  // Industry average defaults (can be refined based on category)
  const category = swData.traffic.category?.toLowerCase() || '';

  // Retail/ecommerce tends to have higher mobile
  if (category.includes('shopping') || category.includes('retail') || category.includes('ecommerce')) {
    return { desktop: 0.40, mobile: 0.55, tablet: 0.05 };
  }

  // B2B/enterprise tends to have higher desktop
  if (category.includes('business') || category.includes('enterprise') || category.includes('b2b')) {
    return { desktop: 0.70, mobile: 0.25, tablet: 0.05 };
  }

  // Default distribution
  return { desktop: 0.55, mobile: 0.40, tablet: 0.05 };
}

// ============================================================================
// Traffic Trend Analysis
// ============================================================================

/**
 * Calculate traffic trend from historical data
 */
export function calculateTrafficTrend(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Classify traffic trend
 */
export function classifyTrafficTrend(
  trendPercentage: number
): 'growing' | 'stable' | 'declining' {
  if (trendPercentage > 5) return 'growing';
  if (trendPercentage < -5) return 'declining';
  return 'stable';
}

// ============================================================================
// Traffic Tier Classification
// ============================================================================

export type TrafficTier = 'excellent' | 'great' | 'good' | 'okay' | 'low';

/**
 * Determine traffic tier for scoring
 */
export function getTrafficTier(monthlyVisits: number): TrafficTier {
  if (monthlyVisits >= 10_000_000) return 'excellent';
  if (monthlyVisits >= 1_000_000) return 'great';
  if (monthlyVisits >= 100_000) return 'good';
  if (monthlyVisits >= 10_000) return 'okay';
  return 'low';
}

/**
 * Get traffic tier score (0-100) for composite scoring
 */
export function getTrafficTierScore(monthlyVisits: number): number {
  const tier = getTrafficTier(monthlyVisits);
  const scores: Record<TrafficTier, number> = {
    excellent: 100,
    great: 80,
    good: 60,
    okay: 40,
    low: 20,
  };
  return scores[tier];
}

/**
 * Get human-readable traffic description
 */
export function getTrafficDescription(monthlyVisits: number): string {
  if (monthlyVisits >= 100_000_000) return 'Top-tier enterprise (100M+ visits/month)';
  if (monthlyVisits >= 10_000_000) return 'Major enterprise (10M+ visits/month)';
  if (monthlyVisits >= 1_000_000) return 'Large business (1M+ visits/month)';
  if (monthlyVisits >= 100_000) return 'Mid-market (100K+ visits/month)';
  if (monthlyVisits >= 10_000) return 'Growing business (10K+ visits/month)';
  return 'Small business (<10K visits/month)';
}

// ============================================================================
// Engagement Scoring
// ============================================================================

/**
 * Calculate engagement score based on bounce rate, pages per visit, and duration
 */
export function calculateEngagementScore(traffic: TrafficData): number {
  // Weights: bounce_rate (30%), pages_per_visit (35%), avg_visit_duration (35%)
  // Lower bounce rate is better; higher pages and duration are better

  // Bounce rate score (0-100, lower is better)
  // Industry average is around 40-60%
  const bounceScore = Math.max(0, Math.min(100, (100 - traffic.bounce_rate) * 1.5));

  // Pages per visit score (0-100)
  // Good sites have 3-5+ pages per visit
  const pagesScore = Math.min(100, (traffic.pages_per_visit / 5) * 100);

  // Duration score (0-100)
  // Average duration is around 2-3 minutes (120-180 seconds)
  const durationScore = Math.min(100, (traffic.avg_visit_duration / 180) * 100);

  return Math.round(bounceScore * 0.3 + pagesScore * 0.35 + durationScore * 0.35);
}

/**
 * Get engagement level classification
 */
export function getEngagementLevel(
  traffic: TrafficData
): 'high' | 'medium' | 'low' {
  const score = calculateEngagementScore(traffic);
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ============================================================================
// Search Traffic Analysis (for Algolia relevance)
// ============================================================================

/**
 * Estimate search query volume based on traffic and search percentage
 * This is a key metric for Algolia sales - more search = more Algolia value
 */
export function estimateSearchQueryVolume(traffic: TrafficData): number {
  const searchSource = traffic.traffic_sources.find((s) => s.source === 'search');
  const searchPercentage = searchSource?.percentage || 0;

  // Estimate: 10% of visitors use site search, each searches 2-3 times
  // This is based on industry benchmarks from Baymard Institute
  const siteSearchUsageRate = 0.10;
  const queriesPerSearcher = 2.5;

  const monthlySearchers = traffic.monthly_visits * siteSearchUsageRate;
  return Math.round(monthlySearchers * queriesPerSearcher);
}

/**
 * Classify search opportunity for Algolia
 */
export function classifySearchOpportunity(
  monthlySearchQueries: number
): 'massive' | 'large' | 'moderate' | 'small' {
  if (monthlySearchQueries >= 10_000_000) return 'massive';
  if (monthlySearchQueries >= 1_000_000) return 'large';
  if (monthlySearchQueries >= 100_000) return 'moderate';
  return 'small';
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format monthly visits for display (e.g., "1.2M", "500K")
 */
export function formatMonthlyVisits(visits: number): string {
  if (visits >= 1_000_000_000) return `${(visits / 1_000_000_000).toFixed(1)}B`;
  if (visits >= 1_000_000) return `${(visits / 1_000_000).toFixed(1)}M`;
  if (visits >= 1_000) return `${(visits / 1_000).toFixed(1)}K`;
  return visits.toString();
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
