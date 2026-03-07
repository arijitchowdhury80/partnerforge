import { SourceCitation } from '../types';

/**
 * Build source citation for API responses
 * MANDATORY: Every data point must include source provenance
 */
export function buildSourceCitation(
  provider: string,
  endpoint: string,
  params: Record<string, any>,
  cached: boolean,
  baseUrl?: string
): SourceCitation {
  const url = buildProviderURL(provider, endpoint, params, baseUrl);

  return {
    provider,
    url,
    accessed_at: new Date().toISOString(),
    cache_hit: cached,
    endpoint,
    params
  };
}

/**
 * Build provider-specific URLs for documentation
 */
function buildProviderURL(
  provider: string,
  endpoint: string,
  params: Record<string, any>,
  baseUrl?: string
): string {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'similarweb':
      return buildSimilarWebURL(endpoint, params);

    case 'builtwith':
      return buildBuiltWithURL(endpoint, params);

    case 'yahoo-finance':
    case 'yahoofinance':
      return buildYahooFinanceURL(endpoint, params);

    case 'apify':
      return buildApifyURL(endpoint, params);

    case 'apollo':
      return buildApolloURL(endpoint, params);

    default:
      // Generic URL construction
      if (baseUrl) {
        const queryString = new URLSearchParams(params).toString();
        return `${baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
      }
      return `https://api.${provider}.com${endpoint}`;
  }
}

/**
 * SimilarWeb URL builder
 */
function buildSimilarWebURL(endpoint: string, params: Record<string, any>): string {
  const domain = params.domain || params.site || 'example.com';
  const baseUrl = 'https://www.similarweb.com/website';

  // Map API endpoints to SimilarWeb pages
  if (endpoint.includes('traffic-and-engagement')) {
    return `${baseUrl}/${domain}/#overview`;
  }
  if (endpoint.includes('traffic-sources')) {
    return `${baseUrl}/${domain}/#traffic-sources`;
  }
  if (endpoint.includes('keywords')) {
    return `${baseUrl}/${domain}/#search`;
  }
  if (endpoint.includes('competitors')) {
    return `${baseUrl}/${domain}/#competitors`;
  }
  if (endpoint.includes('demographics')) {
    return `${baseUrl}/${domain}/#demographics`;
  }

  return `${baseUrl}/${domain}`;
}

/**
 * BuiltWith URL builder
 */
function buildBuiltWithURL(endpoint: string, params: Record<string, any>): string {
  const domain = params.domain || params.LOOKUP || 'example.com';
  const baseUrl = 'https://builtwith.com';

  if (endpoint.includes('domain-lookup') || endpoint.includes('free-api')) {
    return `${baseUrl}/${domain}`;
  }
  if (endpoint.includes('relationships')) {
    return `${baseUrl}/${domain}#relationships`;
  }
  if (endpoint.includes('financial')) {
    return `${baseUrl}/${domain}#financial`;
  }

  return `${baseUrl}/${domain}`;
}

/**
 * Yahoo Finance URL builder
 */
function buildYahooFinanceURL(endpoint: string, params: Record<string, any>): string {
  const ticker = params.ticker || params.symbol || 'AAPL';
  const baseUrl = 'https://finance.yahoo.com/quote';

  if (endpoint.includes('financials')) {
    return `${baseUrl}/${ticker}/financials`;
  }
  if (endpoint.includes('recommendations')) {
    return `${baseUrl}/${ticker}/analysis`;
  }
  if (endpoint.includes('holders')) {
    return `${baseUrl}/${ticker}/holders`;
  }

  return `${baseUrl}/${ticker}`;
}

/**
 * Apify URL builder
 */
function buildApifyURL(endpoint: string, params: Record<string, any>): string {
  const actorId = params.actorId || 'unknown-actor';
  return `https://apify.com/${actorId}`;
}

/**
 * Apollo.io URL builder
 */
function buildApolloURL(endpoint: string, params: Record<string, any>): string {
  if (endpoint.includes('people-search')) {
    return 'https://app.apollo.io/#/people';
  }
  return 'https://app.apollo.io/';
}

/**
 * Validate that a citation has all required fields
 */
export function validateCitation(citation: SourceCitation): boolean {
  return !!(
    citation.provider &&
    citation.url &&
    citation.accessed_at &&
    typeof citation.cache_hit === 'boolean'
  );
}

/**
 * Format citation for display (markdown)
 */
export function formatCitationMarkdown(citation: SourceCitation): string {
  const cacheStatus = citation.cache_hit ? '(cached)' : '(live)';
  return `[${citation.provider}](${citation.url}) ${cacheStatus} - ${citation.accessed_at}`;
}
