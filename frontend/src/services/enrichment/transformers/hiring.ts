/**
 * Hiring Data Transformer
 *
 * Transforms WebSearch hiring signals into the HiringData type
 * used throughout the Arian application.
 */

import type { HiringData, Job } from '@/types';
import type { HiringSignal, HiringJob } from '../clients/websearch';

// ============================================================================
// Search-Related Keywords
// ============================================================================

const SEARCH_KEYWORDS = [
  'search',
  'discovery',
  'relevance',
  'ranking',
  'recommendations',
  'personalization',
  'findability',
  'autocomplete',
  'typeahead',
  'faceting',
  'filtering',
  'query',
  'catalog',
  'merchandising',
  'browse',
];

const ALGOLIA_KEYWORDS = ['algolia', 'elasticsearch', 'solr', 'elastic', 'lucene'];

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform WebSearch hiring signals into HiringData type
 */
export function transformHiringData(
  domain: string,
  signal: HiringSignal | null
): HiringData | null {
  if (!signal) return null;

  return {
    domain,
    signal_strength: signal.signal_strength,
    total_openings: signal.total_relevant_openings,
    tier_breakdown: signal.tier_breakdown,
    relevant_jobs: signal.relevant_jobs.map(transformJob),
    tech_keywords: signal.tech_keywords_detected,
  };
}

/**
 * Transform a single HiringJob to Job type
 */
export function transformJob(job: HiringJob): Job {
  return {
    title: job.title,
    tier: job.tier,
    department: job.department,
    location: job.location,
    url: job.url,
    posted_date: job.posted_date,
    relevance_score: job.relevance_score,
  };
}

// ============================================================================
// Hiring Signal Scoring
// ============================================================================

/**
 * Calculate hiring signal score for composite scoring (0-100)
 *
 * Factors:
 * - Signal strength: up to 40 points
 * - Tier 1 (VP+) roles: up to 30 points (strongest signal)
 * - Tier 2 (Director) roles: up to 20 points
 * - Search-related keywords: up to 10 points
 */
export function getHiringSignalScore(data: HiringData): number {
  let score = 0;

  // Signal strength (40 points max)
  switch (data.signal_strength) {
    case 'strong':
      score += 40;
      break;
    case 'moderate':
      score += 25;
      break;
    case 'weak':
      score += 10;
      break;
    case 'none':
      score += 0;
      break;
  }

  // Tier 1 (VP+) roles - strongest signal (30 points max)
  // Each VP+ role is worth 15 points, capped at 30
  score += Math.min(30, data.tier_breakdown.tier_1_vp * 15);

  // Tier 2 (Director) roles (20 points max)
  // Each Director role is worth 5 points, capped at 20
  score += Math.min(20, data.tier_breakdown.tier_2_director * 5);

  // Search-related keywords in job postings (10 points max)
  const searchKeywords = data.tech_keywords.filter(
    (k) =>
      SEARCH_KEYWORDS.some((sk) => k.toLowerCase().includes(sk)) ||
      ALGOLIA_KEYWORDS.some((ak) => k.toLowerCase().includes(ak))
  );
  score += Math.min(10, searchKeywords.length * 5);

  return Math.min(100, score);
}

/**
 * Classify hiring signal level
 */
export function getHiringSignalLevel(data: HiringData): 'high' | 'medium' | 'low' | 'none' {
  const score = getHiringSignalScore(data);
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 15) return 'low';
  return 'none';
}

// ============================================================================
// Search-Related Hiring Detection
// ============================================================================

/**
 * Check if company is actively hiring for search-related roles
 */
export function isHiringForSearch(data: HiringData): boolean {
  return data.relevant_jobs.some((job) => {
    const titleLower = job.title.toLowerCase();
    return (
      SEARCH_KEYWORDS.some((keyword) => titleLower.includes(keyword)) ||
      ALGOLIA_KEYWORDS.some((keyword) => titleLower.includes(keyword))
    );
  });
}

/**
 * Check if company is hiring for discovery/personalization roles
 */
export function isHiringForDiscovery(data: HiringData): boolean {
  const discoveryKeywords = ['discovery', 'recommendations', 'personalization', 'browse', 'catalog'];
  return data.relevant_jobs.some((job) => {
    const titleLower = job.title.toLowerCase();
    return discoveryKeywords.some((keyword) => titleLower.includes(keyword));
  });
}

/**
 * Get search-related job postings
 */
export function getSearchRelatedJobs(data: HiringData): Job[] {
  return data.relevant_jobs.filter((job) => {
    const titleLower = job.title.toLowerCase();
    return (
      SEARCH_KEYWORDS.some((keyword) => titleLower.includes(keyword)) ||
      ALGOLIA_KEYWORDS.some((keyword) => titleLower.includes(keyword))
    );
  });
}

// ============================================================================
// Leadership Hiring Analysis
// ============================================================================

/**
 * Get executive-level (Tier 1) job postings
 */
export function getExecutiveHires(data: HiringData): Job[] {
  return data.relevant_jobs.filter((job) => job.tier === 1);
}

/**
 * Get director-level (Tier 2) job postings
 */
export function getDirectorHires(data: HiringData): Job[] {
  return data.relevant_jobs.filter((job) => job.tier === 2);
}

/**
 * Check if company is building a new team (multiple related hires)
 */
export function isBuildingTeam(data: HiringData): boolean {
  // Building a team = 3+ relevant hires in the same department
  const departmentCounts: Record<string, number> = {};

  for (const job of data.relevant_jobs) {
    const dept = job.department || 'Unknown';
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
  }

  return Object.values(departmentCounts).some((count) => count >= 3);
}

// ============================================================================
// Department Analysis
// ============================================================================

/**
 * Get breakdown of hiring by department
 */
export function getDepartmentBreakdown(data: HiringData): Record<string, number> {
  const breakdown: Record<string, number> = {};

  for (const job of data.relevant_jobs) {
    const dept = job.department || 'Unknown';
    breakdown[dept] = (breakdown[dept] || 0) + 1;
  }

  return breakdown;
}

/**
 * Get the primary hiring department
 */
export function getPrimaryHiringDepartment(data: HiringData): string | null {
  const breakdown = getDepartmentBreakdown(data);
  const entries = Object.entries(breakdown);

  if (entries.length === 0) return null;

  return entries.reduce((max, entry) => (entry[1] > max[1] ? entry : max))[0];
}

// ============================================================================
// Tech Stack Inference
// ============================================================================

/**
 * Infer tech stack preferences from job postings
 */
export function inferTechStackFromHiring(data: HiringData): string[] {
  const techKeywords = new Set<string>();

  // Common tech keywords to look for
  const techPatterns = [
    'react',
    'vue',
    'angular',
    'typescript',
    'javascript',
    'python',
    'java',
    'node',
    'aws',
    'gcp',
    'azure',
    'kubernetes',
    'docker',
    'graphql',
    'rest',
    'microservices',
    'elasticsearch',
    'algolia',
    'solr',
    'redis',
    'mongodb',
    'postgresql',
    'mysql',
  ];

  // Add detected tech keywords
  for (const keyword of data.tech_keywords) {
    const keywordLower = keyword.toLowerCase();
    if (techPatterns.includes(keywordLower)) {
      techKeywords.add(keywordLower);
    }
  }

  return Array.from(techKeywords);
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format hiring signal for display
 */
export function formatHiringSignal(strength: HiringData['signal_strength']): string {
  switch (strength) {
    case 'strong':
      return 'Strong hiring activity';
    case 'moderate':
      return 'Moderate hiring activity';
    case 'weak':
      return 'Low hiring activity';
    case 'none':
      return 'No relevant hiring detected';
  }
}

/**
 * Format tier breakdown for display
 */
export function formatTierBreakdown(data: HiringData): string {
  const parts: string[] = [];

  if (data.tier_breakdown.tier_1_vp > 0) {
    parts.push(`${data.tier_breakdown.tier_1_vp} VP+`);
  }
  if (data.tier_breakdown.tier_2_director > 0) {
    parts.push(`${data.tier_breakdown.tier_2_director} Director`);
  }
  if (data.tier_breakdown.tier_3_ic > 0) {
    parts.push(`${data.tier_breakdown.tier_3_ic} IC`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No relevant roles';
}

/**
 * Get hiring summary for quick display
 */
export function getHiringSummary(data: HiringData): string {
  const signal = formatHiringSignal(data.signal_strength);
  const total = data.total_openings;
  const searchRelated = getSearchRelatedJobs(data).length;

  if (searchRelated > 0) {
    return `${signal} - ${total} openings (${searchRelated} search-related)`;
  }

  return `${signal} - ${total} relevant openings`;
}

// ============================================================================
// Extended Hiring Data Type (Enriched Output)
// ============================================================================

export interface EnrichedHiringData {
  signal_strength: 'strong' | 'moderate' | 'weak' | 'none';
  total_openings: number;
  relevant_openings: number;  // Search/tech related

  tier_breakdown: {
    executive: number;  // VP+, C-level
    director: number;
    ic: number;  // Individual contributors
  };

  key_roles: Array<{
    title: string;
    tier: 'executive' | 'director' | 'ic';
    relevance: 'high' | 'medium' | 'low';
    is_search_related: boolean;
    url: string;
    posted_date?: string;
  }>;

  tech_signals: {
    keywords_detected: string[];
    search_tech_mentioned: boolean;
    ecommerce_focus: boolean;
    data_engineering_focus: boolean;
  };

  growth_indicators: {
    is_scaling_engineering: boolean;
    is_scaling_product: boolean;
    is_building_search_team: boolean;
  };

  fetched_at: string;
}

// ============================================================================
// Extended Transformers
// ============================================================================

/**
 * Map tier number to tier name
 */
function mapTierToName(tier: 1 | 2 | 3): 'executive' | 'director' | 'ic' {
  switch (tier) {
    case 1: return 'executive';
    case 2: return 'director';
    case 3: return 'ic';
    default: return 'ic';
  }
}

/**
 * Transform a HiringJob into enriched key_role format
 */
export function transformHiringJobToKeyRole(job: Job): EnrichedHiringData['key_roles'][0] {
  const titleLower = job.title.toLowerCase();

  // Determine relevance based on score
  let relevance: 'high' | 'medium' | 'low' = 'low';
  if (job.relevance_score >= 70) relevance = 'high';
  else if (job.relevance_score >= 40) relevance = 'medium';

  // Check if search-related
  const is_search_related = SEARCH_KEYWORDS.some((kw) => titleLower.includes(kw)) ||
    ALGOLIA_KEYWORDS.some((kw) => titleLower.includes(kw));

  return {
    title: job.title,
    tier: mapTierToName(job.tier),
    relevance,
    is_search_related,
    url: job.url,
    posted_date: job.posted_date,
  };
}

/**
 * Calculate enriched tier breakdown
 */
export function calculateEnrichedTierBreakdown(jobs: Job[]): EnrichedHiringData['tier_breakdown'] {
  return {
    executive: jobs.filter((j) => j.tier === 1).length,
    director: jobs.filter((j) => j.tier === 2).length,
    ic: jobs.filter((j) => j.tier === 3).length,
  };
}

/**
 * Extract tech signals from job postings
 */
export function extractTechSignals(data: HiringData): EnrichedHiringData['tech_signals'] {
  const keywords = data.tech_keywords.map((k) => k.toLowerCase());
  const allJobText = data.relevant_jobs.map((j) => j.title.toLowerCase()).join(' ');

  return {
    keywords_detected: data.tech_keywords,
    search_tech_mentioned:
      keywords.some((k) => SEARCH_KEYWORDS.some((sk) => k.includes(sk))) ||
      keywords.some((k) => ALGOLIA_KEYWORDS.some((ak) => k.includes(ak))) ||
      allJobText.includes('search') ||
      allJobText.includes('algolia') ||
      allJobText.includes('elasticsearch'),
    ecommerce_focus:
      keywords.some((k) => k.includes('ecommerce') || k.includes('e-commerce') || k.includes('commerce')) ||
      allJobText.includes('ecommerce') ||
      allJobText.includes('commerce'),
    data_engineering_focus:
      keywords.some((k) => k.includes('data') || k.includes('ml') || k.includes('machine learning')) ||
      allJobText.includes('data engineer') ||
      allJobText.includes('data science') ||
      allJobText.includes('machine learning'),
  };
}

/**
 * Determine growth indicators from hiring data
 */
export function determineGrowthIndicators(
  jobs: Job[],
  tierBreakdown: EnrichedHiringData['tier_breakdown']
): EnrichedHiringData['growth_indicators'] {
  const jobTitles = jobs.map((j) => j.title.toLowerCase()).join(' ');

  // Scaling engineering = 5+ engineering roles OR VP/Director engineering hire
  const engineeringRoles = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes('engineer') ||
      j.title.toLowerCase().includes('developer') ||
      j.title.toLowerCase().includes('architect')
  );
  const is_scaling_engineering =
    engineeringRoles.length >= 5 ||
    (tierBreakdown.executive > 0 && jobTitles.includes('engineering'));

  // Scaling product = 3+ product roles OR Director+ product hire
  const productRoles = jobs.filter(
    (j) => j.title.toLowerCase().includes('product')
  );
  const is_scaling_product =
    productRoles.length >= 3 ||
    (tierBreakdown.director > 0 && jobTitles.includes('product'));

  // Building search team = any search-specific hiring OR VP+ with search focus
  const searchRoles = jobs.filter((j) => {
    const titleLower = j.title.toLowerCase();
    return SEARCH_KEYWORDS.some((kw) => titleLower.includes(kw));
  });
  const is_building_search_team =
    searchRoles.length >= 1 ||
    (tierBreakdown.executive > 0 &&
      (jobTitles.includes('search') || jobTitles.includes('discovery')));

  return {
    is_scaling_engineering,
    is_scaling_product,
    is_building_search_team,
  };
}

/**
 * Transform HiringData into EnrichedHiringData
 */
export function transformToEnrichedHiringData(data: HiringData): EnrichedHiringData {
  const tierBreakdown = calculateEnrichedTierBreakdown(data.relevant_jobs);
  const techSignals = extractTechSignals(data);
  const growthIndicators = determineGrowthIndicators(data.relevant_jobs, tierBreakdown);

  // Count search-related jobs
  const searchRelatedJobs = getSearchRelatedJobs(data);

  return {
    signal_strength: data.signal_strength,
    total_openings: data.total_openings,
    relevant_openings: searchRelatedJobs.length,
    tier_breakdown: tierBreakdown,
    key_roles: data.relevant_jobs.slice(0, 20).map(transformHiringJobToKeyRole),
    tech_signals: techSignals,
    growth_indicators: growthIndicators,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Get hiring insights for sales enablement
 */
export function getHiringInsights(data: HiringData): string[] {
  const insights: string[] = [];
  const enriched = transformToEnrichedHiringData(data);

  if (enriched.growth_indicators.is_building_search_team) {
    insights.push('Actively hiring for search/discovery roles - high intent signal');
  }

  if (enriched.growth_indicators.is_scaling_engineering) {
    insights.push('Scaling engineering team - potential budget for infrastructure');
  }

  if (enriched.tier_breakdown.executive > 0) {
    insights.push(
      `VP+ level hiring (${enriched.tier_breakdown.executive} roles) - organizational change underway`
    );
  }

  if (enriched.tech_signals.ecommerce_focus) {
    insights.push('E-commerce focus in hiring - Algolia commerce use cases relevant');
  }

  if (enriched.tech_signals.search_tech_mentioned) {
    insights.push('Search technologies mentioned in job postings - familiar with search concepts');
  }

  return insights;
}
