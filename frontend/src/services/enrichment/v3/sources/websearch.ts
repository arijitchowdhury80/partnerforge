/**
 * WebSearch Source Module
 *
 * Provides: Executive quotes, strategic signals, news mentions
 * API: WebSearch (requires executor function passed in)
 *
 * Note: This module builds queries but requires a search executor
 * to actually perform searches. In Claude Code, this would be the
 * WebSearch tool. In the browser, this would need a backend proxy.
 */

import type { SourceModule, SourceResult, WebSearchData, SourceOptions } from '../types';

// Algolia value prop mappings for quote classification
const ALGOLIA_VALUE_MAPPINGS = [
  { keywords: ['search', 'discovery', 'findability', 'find'], value: 'Search & Discovery' },
  { keywords: ['customer experience', 'cx', 'ux', 'user experience'], value: 'Customer Experience' },
  { keywords: ['conversion', 'revenue', 'sales', 'aov'], value: 'Revenue & Conversion' },
  { keywords: ['personalization', 'personalize', 'recommend'], value: 'Personalization' },
  { keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml'], value: 'AI/ML' },
  { keywords: ['speed', 'fast', 'performance', 'milliseconds'], value: 'Performance' },
  { keywords: ['scale', 'traffic', 'peak', 'growth'], value: 'Scalability' },
  { keywords: ['mobile', 'app', 'omnichannel'], value: 'Mobile/Omnichannel' },
];

function mapQuoteToAlgoliaValue(quote: string): string {
  const lower = quote.toLowerCase();
  for (const mapping of ALGOLIA_VALUE_MAPPINGS) {
    if (mapping.keywords.some(kw => lower.includes(kw))) {
      return mapping.value;
    }
  }
  return 'Digital Strategy';
}

function calculateRelevance(quote: string): number {
  const lower = quote.toLowerCase();
  let score = 0;

  // High-value keywords
  if (/search|discovery|findability/.test(lower)) score += 40;
  if (/customer experience|cx/.test(lower)) score += 30;
  if (/conversion|revenue/.test(lower)) score += 25;
  if (/personalization|ai|ml/.test(lower)) score += 20;
  if (/digital|ecommerce|e-commerce/.test(lower)) score += 15;

  return Math.min(100, score);
}

// Query builders for different search types
export function buildExecutiveQueries(companyName: string): string[] {
  return [
    `"${companyName}" CEO "search" OR "discovery" OR "customer experience" quote`,
    `"${companyName}" CTO "digital transformation" OR "technology" quote`,
    `"${companyName}" earnings call "search" OR "e-commerce" transcript`,
    `"${companyName}" investor day "digital" OR "technology" presentation`,
  ];
}

export function buildStrategicQueries(companyName: string): string[] {
  return [
    `"${companyName}" "digital transformation" announcement`,
    `"${companyName}" "new website" OR "platform migration" OR "replatform"`,
    `"${companyName}" "search provider" OR "search solution"`,
    `"${companyName}" executive hire CTO OR CDO OR "Chief Digital"`,
  ];
}

export const websearch: SourceModule<WebSearchData> = {
  id: 'websearch',
  name: 'Web Search',

  // WebSearch requires a search executor - check if one is available
  isAvailable: () => {
    // In browser context, this would need a backend
    // For now, return false as we can't do web searches directly
    return false;
  },

  async enrich(domain: string, options?: SourceOptions): Promise<SourceResult<WebSearchData>> {
    // Note: This source requires a search executor to function
    // In Arian browser context, we would need a backend API
    // to proxy web searches

    const companyName = options?.companyName || domain.split('.')[0];

    // Build the queries (for documentation/future use)
    const executiveQueries = buildExecutiveQueries(companyName);
    const strategicQueries = buildStrategicQueries(companyName);

    // Return empty data with note about requiring search executor
    const data: WebSearchData = {
      executive_quotes: [],
      strategic_signals: [],
      news_mentions: [],
    };

    console.log(`[WebSearch] ${domain}: Requires search executor (queries built but not executed)`);
    console.log(`[WebSearch] Executive queries: ${executiveQueries.length}`);
    console.log(`[WebSearch] Strategic queries: ${strategicQueries.length}`);

    return {
      source: 'websearch',
      success: true,
      data,
      fetched_at: new Date().toISOString(),
      cached: false,
    };
  },
};

// Export query builders for external use
export { mapQuoteToAlgoliaValue, calculateRelevance };

export default websearch;
