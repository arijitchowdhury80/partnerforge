/**
 * Competitors Data Transformer
 *
 * Transforms SimilarWeb competitor data combined with BuiltWith tech stack
 * data into the CompetitorData type for competitive analysis.
 */

import type { CompetitorData, Competitor } from '@/types';
import type { SimilarWebCompetitor } from '../clients/similarweb';
import type { BuiltWithTechStack } from '../clients/builtwith';

// ============================================================================
// Search Provider Detection (for competitors)
// ============================================================================

const SEARCH_PROVIDER_PATTERNS: Record<string, RegExp[]> = {
  'Algolia': [/algolia/i],
  'Elasticsearch': [/elasticsearch/i, /elastic\.co/i],
  'Coveo': [/coveo/i],
  'Constructor.io': [/constructor\.io/i, /constructorio/i],
  'SearchSpring': [/searchspring/i],
  'Klevu': [/klevu/i],
  'Bloomreach': [/bloomreach/i],
  'Lucidworks': [/lucidworks/i, /fusion/i],
  'Solr': [/solr/i],
  'Swiftype': [/swiftype/i],
  'Doofinder': [/doofinder/i],
  'HawkSearch': [/hawksearch/i],
  'Yext': [/yext/i],
  'Attraqt': [/attraqt/i],
  'Findify': [/findify/i],
  'Unbxd': [/unbxd/i],
};

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform SimilarWeb similar sites into CompetitorData.
 * Optionally enriches each competitor with BuiltWith tech stack data.
 *
 * @param domain - The target company domain
 * @param similarSites - List of similar sites from SimilarWeb
 * @param competitorTechStacks - Optional map of competitor domain -> tech stack
 */
export function transformCompetitorData(
  domain: string,
  similarSites: SimilarWebCompetitor[],
  competitorTechStacks?: Map<string, BuiltWithTechStack>
): CompetitorData {
  const competitors = similarSites.map((site) =>
    transformCompetitor(site, competitorTechStacks?.get(site.domain))
  );

  return {
    domain,
    competitors,
    market_position: determineMarketPosition(similarSites),
    competitive_landscape: generateCompetitiveLandscape(
      competitors,
      competitorTechStacks
    ),
  };
}

/**
 * Transform a single SimilarWeb competitor into our Competitor type
 */
export function transformCompetitor(
  site: SimilarWebCompetitor,
  techStack?: BuiltWithTechStack
): Competitor {
  const searchProvider = techStack
    ? detectSearchProviderFromTechStack(techStack)
    : undefined;

  return {
    domain: site.domain,
    company_name: extractCompanyName(site.domain),
    similarity_score: site.similarity_score,
    search_provider: searchProvider,
    using_algolia: searchProvider?.toLowerCase() === 'algolia',
  };
}

// ============================================================================
// Search Provider Detection
// ============================================================================

/**
 * Detect search provider from a competitor's tech stack
 */
export function detectSearchProviderFromTechStack(
  ts: BuiltWithTechStack
): string | undefined {
  // Check dedicated search category first
  for (const searchTech of ts.search) {
    const techLower = searchTech.toLowerCase();
    for (const [provider, patterns] of Object.entries(SEARCH_PROVIDER_PATTERNS)) {
      if (patterns.some((p) => p.test(techLower))) {
        return provider;
      }
    }
  }

  // Check all technologies as fallback
  for (const tech of ts.technologies) {
    const techName = (tech.name || tech.tag || '').toLowerCase();
    for (const [provider, patterns] of Object.entries(SEARCH_PROVIDER_PATTERNS)) {
      if (patterns.some((p) => p.test(techName))) {
        return provider;
      }
    }
  }

  return undefined;
}

// ============================================================================
// Company Name Extraction
// ============================================================================

/**
 * Extract a readable company name from a domain
 */
export function extractCompanyName(domain: string): string {
  // Remove TLD
  const name = domain
    .replace(/\.(com|io|co|net|org|ai|dev|tech|app|store|shop|xyz|me|us|uk|de|fr|ca|au|jp|cn|in)$/i, '')
    // Handle multi-part TLDs
    .replace(/\.(co|com)\.(uk|au|nz|jp|kr|in|za|br|mx)$/i, '')
    // Convert separators to spaces
    .replace(/[-_]/g, ' ')
    // Capitalize each word
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  return name || domain;
}

// ============================================================================
// Market Position Analysis
// ============================================================================

/**
 * Determine market position based on competitor similarity scores
 */
export function determineMarketPosition(
  competitors: SimilarWebCompetitor[]
): string {
  if (competitors.length === 0) {
    return 'Unique market position (no similar competitors found)';
  }

  const avgSimilarity =
    competitors.reduce((sum, c) => sum + c.similarity_score, 0) /
    competitors.length;

  const highSimilarityCount = competitors.filter(
    (c) => c.similarity_score > 70
  ).length;

  if (avgSimilarity > 70) {
    return 'Established player in highly competitive market';
  }

  if (avgSimilarity > 50) {
    if (highSimilarityCount > 5) {
      return 'Core player with multiple direct competitors';
    }
    return 'Established player with moderate competition';
  }

  if (avgSimilarity > 30) {
    return 'Differentiated market position';
  }

  return 'Niche or emerging market player';
}

/**
 * Get market competitiveness score (0-100)
 */
export function getMarketCompetitivenessScore(
  competitors: SimilarWebCompetitor[]
): number {
  if (competitors.length === 0) return 0;

  // Factors: number of competitors, average similarity
  const competitorCountScore = Math.min(50, competitors.length * 5);

  const avgSimilarity =
    competitors.reduce((sum, c) => sum + c.similarity_score, 0) /
    competitors.length;

  const similarityScore = avgSimilarity / 2; // Max 50

  return Math.round(competitorCountScore + similarityScore);
}

// ============================================================================
// Competitive Landscape Analysis
// ============================================================================

/**
 * Generate competitive landscape summary
 */
export function generateCompetitiveLandscape(
  competitors: Competitor[],
  techStacks?: Map<string, BuiltWithTechStack>
): string {
  if (competitors.length === 0) {
    return 'No direct competitors identified';
  }

  if (!techStacks || techStacks.size === 0) {
    return `${competitors.length} competitors identified (search providers unknown)`;
  }

  const searchProviderCounts = countSearchProviders(competitors);
  const parts: string[] = [];

  if (searchProviderCounts.algolia > 0) {
    parts.push(`${searchProviderCounts.algolia} use Algolia`);
  }
  if (searchProviderCounts.elasticsearch > 0) {
    parts.push(`${searchProviderCounts.elasticsearch} use Elasticsearch`);
  }
  if (searchProviderCounts.other > 0) {
    parts.push(`${searchProviderCounts.other} use other search providers`);
  }
  if (searchProviderCounts.unknown > 0) {
    parts.push(`${searchProviderCounts.unknown} unknown`);
  }

  return parts.length > 0
    ? `${competitors.length} competitors: ${parts.join(', ')}`
    : `${competitors.length} competitors identified`;
}

/**
 * Count search providers across competitors
 */
export function countSearchProviders(competitors: Competitor[]): {
  algolia: number;
  elasticsearch: number;
  other: number;
  unknown: number;
} {
  const counts = { algolia: 0, elasticsearch: 0, other: 0, unknown: 0 };

  for (const competitor of competitors) {
    if (!competitor.search_provider) {
      counts.unknown++;
    } else if (competitor.search_provider.toLowerCase() === 'algolia') {
      counts.algolia++;
    } else if (competitor.search_provider.toLowerCase().includes('elastic')) {
      counts.elasticsearch++;
    } else {
      counts.other++;
    }
  }

  return counts;
}

// ============================================================================
// Algolia Competitor Analysis
// ============================================================================

/**
 * Count competitors using Algolia
 * Key metric for displacement scoring - if competitors use Algolia, target should too
 */
export function countAlgoliaCompetitors(competitors: Competitor[]): number {
  return competitors.filter((c) => c.using_algolia).length;
}

/**
 * Get list of competitors using Algolia
 */
export function getAlgoliaCompetitors(competitors: Competitor[]): Competitor[] {
  return competitors.filter((c) => c.using_algolia);
}

/**
 * Calculate Algolia adoption rate among competitors (0-100%)
 */
export function getAlgoliaAdoptionRate(competitors: Competitor[]): number {
  if (competitors.length === 0) return 0;
  const algoliaCount = countAlgoliaCompetitors(competitors);
  return Math.round((algoliaCount / competitors.length) * 100);
}

/**
 * Determine competitive pressure to adopt Algolia
 */
export function getCompetitivePressure(
  competitors: Competitor[]
): 'high' | 'moderate' | 'low' | 'none' {
  const adoptionRate = getAlgoliaAdoptionRate(competitors);

  if (adoptionRate >= 30) return 'high';
  if (adoptionRate >= 15) return 'moderate';
  if (adoptionRate > 0) return 'low';
  return 'none';
}

// ============================================================================
// Competitor Domain Utilities
// ============================================================================

/**
 * Get competitor domains for batch tech stack lookup
 */
export function getCompetitorDomainsForEnrichment(
  competitors: SimilarWebCompetitor[],
  limit = 10
): string[] {
  return competitors
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit)
    .map((c) => c.domain);
}

/**
 * Filter competitors by minimum similarity score
 */
export function filterByMinSimilarity(
  competitors: SimilarWebCompetitor[],
  minScore: number
): SimilarWebCompetitor[] {
  return competitors.filter((c) => c.similarity_score >= minScore);
}

/**
 * Get top N competitors by similarity
 */
export function getTopCompetitors(
  competitors: Competitor[],
  n: number
): Competitor[] {
  return competitors
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, n);
}

// ============================================================================
// Displacement Scoring (based on competitors)
// ============================================================================

/**
 * Calculate displacement urgency based on competitor analysis (0-100)
 * Higher urgency if competitors are gaining advantage with better search
 */
export function calculateDisplacementUrgency(
  competitors: Competitor[]
): number {
  let score = 50; // Base urgency

  const algoliaRate = getAlgoliaAdoptionRate(competitors);
  const competitorCount = competitors.length;

  // More competitors using Algolia = higher urgency (+30 max)
  score += Math.min(30, algoliaRate);

  // More competitors overall = higher urgency (+20 max)
  score += Math.min(20, competitorCount * 2);

  // If no one uses Algolia, there's first-mover opportunity (+10)
  if (algoliaRate === 0 && competitorCount > 0) {
    score += 10; // First-mover advantage opportunity
  }

  return Math.min(100, score);
}

/**
 * Generate displacement narrative based on competitors
 */
export function generateDisplacementNarrative(
  competitors: Competitor[]
): string {
  const algoliaCount = countAlgoliaCompetitors(competitors);
  const total = competitors.length;

  if (total === 0) {
    return 'No direct competitors identified for comparison.';
  }

  if (algoliaCount === 0) {
    return `None of the ${total} competitors currently use Algolia - first-mover opportunity.`;
  }

  if (algoliaCount === 1) {
    const algoliaCompetitor = getAlgoliaCompetitors(competitors)[0];
    return `${algoliaCompetitor.company_name} already uses Algolia - competitive pressure to match search experience.`;
  }

  if (algoliaCount >= total / 2) {
    return `${algoliaCount} of ${total} competitors (${getAlgoliaAdoptionRate(competitors)}%) use Algolia - falling behind on search experience.`;
  }

  return `${algoliaCount} of ${total} competitors use Algolia - growing adoption in the market.`;
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format competitor for display
 */
export function formatCompetitor(competitor: Competitor): string {
  const searchPart = competitor.search_provider
    ? ` (${competitor.search_provider})`
    : '';
  return `${competitor.company_name}${searchPart} - ${competitor.similarity_score.toFixed(0)}% similar`;
}

/**
 * Format competitor list for brief display
 */
export function formatCompetitorList(
  competitors: Competitor[],
  max = 5
): string {
  const top = getTopCompetitors(competitors, max);
  const names = top.map((c) => c.company_name);

  if (competitors.length > max) {
    return `${names.join(', ')} +${competitors.length - max} more`;
  }

  return names.join(', ');
}

/**
 * Get competitor count by search provider
 */
export function getSearchProviderBreakdown(
  competitors: Competitor[]
): Map<string, number> {
  const breakdown = new Map<string, number>();

  for (const competitor of competitors) {
    const provider = competitor.search_provider || 'Unknown';
    breakdown.set(provider, (breakdown.get(provider) || 0) + 1);
  }

  return breakdown;
}
