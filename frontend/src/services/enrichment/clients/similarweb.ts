/**
 * SimilarWeb API Client
 *
 * Full implementation of SimilarWeb's 14 core endpoints for traffic,
 * engagement, demographics, keywords, competitors, and more.
 *
 * API Documentation: https://developer.similarweb.com/
 */

// ============================================================================
// Types
// ============================================================================

export interface SimilarWebTrafficData {
  domain: string;
  monthly_visits: number;
  monthly_visits_trend: number;
  bounce_rate: number;
  pages_per_visit: number;
  avg_visit_duration: number;
  global_rank: number;
  country_rank: number;
  category_rank: number;
  category: string;
}

export interface SimilarWebTrafficSources {
  direct: number;
  search: number;
  referral: number;
  social: number;
  mail: number;
  paid: number;
}

export interface SimilarWebCountry {
  country: string;
  country_code: string;
  share: number;
}

export interface SimilarWebGeography {
  countries: SimilarWebCountry[];
}

export interface SimilarWebDemographics {
  age_distribution: Record<string, number>;
  gender_distribution: { male: number; female: number };
}

export interface SimilarWebKeyword {
  keyword: string;
  volume: number;
  position?: number;
  traffic_share: number;
  cpc?: number;
}

export interface SimilarWebCompetitor {
  domain: string;
  similarity_score: number;
  overlap_score?: number;
}

export interface SimilarWebReferral {
  domain: string;
  traffic_share: number;
}

export interface SimilarWebPage {
  url: string;
  share: number;
}

export interface SimilarWebAudienceInterest {
  category: string;
  affinity: number;
}

export interface SimilarWebRank {
  global: number;
  country: number;
  category: number;
}

export interface SimilarWebFullData {
  traffic: SimilarWebTrafficData;
  sources: SimilarWebTrafficSources;
  geography: SimilarWebGeography;
  demographics: SimilarWebDemographics | null;
  audience_interests: SimilarWebAudienceInterest[];
  organic_keywords: SimilarWebKeyword[];
  paid_keywords: SimilarWebKeyword[];
  competitors: SimilarWebCompetitor[];
  keyword_competitors: SimilarWebCompetitor[];
  referrals: SimilarWebReferral[];
  popular_pages: SimilarWebPage[];
  leading_folders: SimilarWebPage[];
  landing_pages: SimilarWebPage[];
  fetched_at: string;
}

// API Response types (raw from SimilarWeb)
interface SWTrafficResponse {
  visits?: number;
  pages_per_visit?: number;
  average_visit_duration?: number;
  bounce_rate?: number;
  mom_growth?: number;
  global_rank?: number;
  country_rank?: number;
  category_rank?: number;
  category?: string;
}

interface SWTrafficSourcesResponse {
  direct?: number;
  search?: number;
  referrals?: number;
  social?: number;
  mail?: number;
  paid_referrals?: number;
  display_ads?: number;
}

interface SWGeoResponse {
  records?: Array<{
    country?: number;
    country_name?: string;
    share?: number;
  }>;
}

interface SWDemographicsResponse {
  age_18_to_24?: number;
  age_25_to_34?: number;
  age_35_to_44?: number;
  age_45_to_54?: number;
  age_55_to_64?: number;
  age_65_plus?: number;
  male_ratio?: number;
  female_ratio?: number;
}

interface SWKeywordResponse {
  search?: Array<{
    search_term?: string;
    share?: number;
    volume?: number;
    position?: number;
    cpc?: number;
  }>;
}

interface SWSimilarSitesResponse {
  similar_sites?: Array<{
    url?: string;
    score?: number;
  }>;
}

interface SWCompetitorsResponse {
  data?: Array<{
    domain?: string;
    overlap_score?: number;
    affinity?: number;
  }>;
}

interface SWRankResponse {
  global_rank?: number;
  country_rank?: number;
  category_rank?: number;
  category?: string;
}

interface SWReferralsResponse {
  referrals?: Array<{
    domain?: string;
    share?: number;
  }>;
}

interface SWPagesResponse {
  popular_pages?: Array<{
    page?: string;
    share?: number;
  }>;
  leading_folders?: Array<{
    folder?: string;
    share?: number;
  }>;
  landing_pages?: Array<{
    page?: string;
    share?: number;
  }>;
}

interface SWAudienceInterestsResponse {
  audience_interests?: Array<{
    category?: string;
    affinity?: number;
  }>;
}

// Error types
export class SimilarWebError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'SimilarWebError';
  }
}

export class SimilarWebRateLimitError extends SimilarWebError {
  constructor(endpoint: string) {
    super('Rate limit exceeded', 429, endpoint);
    this.name = 'SimilarWebRateLimitError';
  }
}

export class SimilarWebNotFoundError extends SimilarWebError {
  constructor(domain: string, endpoint: string) {
    super(`No data found for domain: ${domain}`, 404, endpoint);
    this.name = 'SimilarWebNotFoundError';
  }
}

// ============================================================================
// Country Code Mapping
// ============================================================================

const COUNTRY_CODES: Record<number, { code: string; name: string }> = {
  840: { code: 'US', name: 'United States' },
  826: { code: 'GB', name: 'United Kingdom' },
  276: { code: 'DE', name: 'Germany' },
  250: { code: 'FR', name: 'France' },
  380: { code: 'IT', name: 'Italy' },
  724: { code: 'ES', name: 'Spain' },
  124: { code: 'CA', name: 'Canada' },
  36: { code: 'AU', name: 'Australia' },
  392: { code: 'JP', name: 'Japan' },
  156: { code: 'CN', name: 'China' },
  356: { code: 'IN', name: 'India' },
  76: { code: 'BR', name: 'Brazil' },
  484: { code: 'MX', name: 'Mexico' },
  410: { code: 'KR', name: 'South Korea' },
  528: { code: 'NL', name: 'Netherlands' },
  643: { code: 'RU', name: 'Russia' },
  756: { code: 'CH', name: 'Switzerland' },
  752: { code: 'SE', name: 'Sweden' },
  56: { code: 'BE', name: 'Belgium' },
  40: { code: 'AT', name: 'Austria' },
  616: { code: 'PL', name: 'Poland' },
  792: { code: 'TR', name: 'Turkey' },
  702: { code: 'SG', name: 'Singapore' },
  344: { code: 'HK', name: 'Hong Kong' },
  784: { code: 'AE', name: 'United Arab Emirates' },
  682: { code: 'SA', name: 'Saudi Arabia' },
  710: { code: 'ZA', name: 'South Africa' },
  32: { code: 'AR', name: 'Argentina' },
  152: { code: 'CL', name: 'Chile' },
  170: { code: 'CO', name: 'Colombia' },
  604: { code: 'PE', name: 'Peru' },
  566: { code: 'NG', name: 'Nigeria' },
  818: { code: 'EG', name: 'Egypt' },
  376: { code: 'IL', name: 'Israel' },
  764: { code: 'TH', name: 'Thailand' },
  458: { code: 'MY', name: 'Malaysia' },
  360: { code: 'ID', name: 'Indonesia' },
  608: { code: 'PH', name: 'Philippines' },
  704: { code: 'VN', name: 'Vietnam' },
  554: { code: 'NZ', name: 'New Zealand' },
  372: { code: 'IE', name: 'Ireland' },
  578: { code: 'NO', name: 'Norway' },
  208: { code: 'DK', name: 'Denmark' },
  246: { code: 'FI', name: 'Finland' },
  620: { code: 'PT', name: 'Portugal' },
  300: { code: 'GR', name: 'Greece' },
  203: { code: 'CZ', name: 'Czech Republic' },
  348: { code: 'HU', name: 'Hungary' },
  642: { code: 'RO', name: 'Romania' },
  804: { code: 'UA', name: 'Ukraine' },
};

function getCountryInfo(countryId: number): { code: string; name: string } {
  return COUNTRY_CODES[countryId] || { code: 'XX', name: `Unknown (${countryId})` };
}

// ============================================================================
// SimilarWeb Client
// ============================================================================

/**
 * @deprecated Use Edge Function proxy via callEnrichProxy() instead
 * API keys are now stored in Supabase Secrets (server-side)
 */
export class SimilarWebClient {
  private baseUrl = 'https://api.similarweb.com/v1/website';
  private timeout = 30000; // 30 seconds
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_SIMILARWEB_API_KEY || '';
    console.warn('[SimilarWebClient] DEPRECATED: Use callEnrichProxy() from @/services/supabase instead. API keys are now server-side.');
  }

  /**
   * @deprecated Edge Function handles API key validation
   */
  hasApiKey(): boolean {
    return true; // Edge Function handles this
  }

  /**
   * Normalize domain (remove protocol, www, trailing slash)
   */
  private normalizeDomain(domain: string): string {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  /**
   * Fetch data from a SimilarWeb endpoint
   */
  private async fetchEndpoint<T>(path: string): Promise<T | null> {
    if (!this.hasApiKey()) {
      console.warn('[SimilarWeb] No API key configured');
      return null;
    }

    const url = `${path}${path.includes('?') ? '&' : '?'}api_key=${this.apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new SimilarWebRateLimitError(path);
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new SimilarWebError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          path
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof SimilarWebError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new SimilarWebError('Request timeout', 408, path);
        }
        throw new SimilarWebError(error.message, undefined, path);
      }

      throw new SimilarWebError('Unknown error', undefined, path);
    }
  }

  // ============================================================================
  // 1. Traffic & Engagement
  // ============================================================================
  async getTrafficAndEngagement(domain: string): Promise<SimilarWebTrafficData | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/total-traffic-and-engagement/visits?country=ww&granularity=monthly&main_domain_only=false`;

    const data = await this.fetchEndpoint<SWTrafficResponse>(path);
    if (!data) return null;

    // Also fetch rank data to complete the response
    const rankData = await this.getWebsiteRank(domain);

    return {
      domain: normalizedDomain,
      monthly_visits: data.visits || 0,
      monthly_visits_trend: data.mom_growth || 0,
      bounce_rate: data.bounce_rate || 0,
      pages_per_visit: data.pages_per_visit || 0,
      avg_visit_duration: data.average_visit_duration || 0,
      global_rank: rankData?.global || data.global_rank || 0,
      country_rank: rankData?.country || data.country_rank || 0,
      category_rank: rankData?.category || data.category_rank || 0,
      category: data.category || 'Unknown',
    };
  }

  // ============================================================================
  // 2. Traffic Sources
  // ============================================================================
  async getTrafficSources(domain: string): Promise<SimilarWebTrafficSources | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/traffic-sources/overview?country=ww&granularity=monthly&main_domain_only=false`;

    const data = await this.fetchEndpoint<SWTrafficSourcesResponse>(path);
    if (!data) return null;

    // Normalize percentages (API returns decimals, we want percentages)
    const normalize = (val?: number): number => {
      if (!val) return 0;
      return val > 1 ? val : val * 100;
    };

    return {
      direct: normalize(data.direct),
      search: normalize(data.search),
      referral: normalize(data.referrals),
      social: normalize(data.social),
      mail: normalize(data.mail),
      paid: normalize(data.paid_referrals) + normalize(data.display_ads),
    };
  }

  // ============================================================================
  // 3. Geography
  // ============================================================================
  async getGeography(domain: string): Promise<SimilarWebGeography | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/geo/traffic-by-country?granularity=monthly&main_domain_only=false`;

    const data = await this.fetchEndpoint<SWGeoResponse>(path);
    if (!data?.records) return null;

    const countries: SimilarWebCountry[] = data.records
      .filter((r) => r.country !== undefined && r.share !== undefined)
      .map((r) => {
        const countryInfo = getCountryInfo(r.country!);
        return {
          country: r.country_name || countryInfo.name,
          country_code: countryInfo.code,
          share: (r.share || 0) * 100, // Convert to percentage
        };
      })
      .sort((a, b) => b.share - a.share)
      .slice(0, 20); // Top 20 countries

    return { countries };
  }

  // ============================================================================
  // 4. Demographics
  // ============================================================================
  async getDemographics(domain: string): Promise<SimilarWebDemographics | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/audience-demographics/age-and-gender-distribution?country=ww`;

    const data = await this.fetchEndpoint<SWDemographicsResponse>(path);
    if (!data) return null;

    // Check if we have any demographic data
    const hasAgeData = Object.values(data).some((v) => typeof v === 'number' && v > 0);
    if (!hasAgeData) return null;

    return {
      age_distribution: {
        '18-24': (data.age_18_to_24 || 0) * 100,
        '25-34': (data.age_25_to_34 || 0) * 100,
        '35-44': (data.age_35_to_44 || 0) * 100,
        '45-54': (data.age_45_to_54 || 0) * 100,
        '55-64': (data.age_55_to_64 || 0) * 100,
        '65+': (data.age_65_plus || 0) * 100,
      },
      gender_distribution: {
        male: (data.male_ratio || 0) * 100,
        female: (data.female_ratio || 0) * 100,
      },
    };
  }

  // ============================================================================
  // 5. Keywords (Organic)
  // ============================================================================
  async getOrganicKeywords(domain: string, limit = 100): Promise<SimilarWebKeyword[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/search-keywords/organic-search-overview?country=ww&granularity=monthly&main_domain_only=false&limit=${limit}`;

    const data = await this.fetchEndpoint<SWKeywordResponse>(path);
    if (!data?.search) return [];

    return data.search
      .filter((k) => k.search_term)
      .map((k) => ({
        keyword: k.search_term!,
        volume: k.volume || 0,
        position: k.position,
        traffic_share: (k.share || 0) * 100,
        cpc: k.cpc,
      }))
      .slice(0, limit);
  }

  // ============================================================================
  // 6. Keywords (Paid)
  // ============================================================================
  async getPaidKeywords(domain: string, limit = 100): Promise<SimilarWebKeyword[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/search-keywords/paid-search-overview?country=ww&granularity=monthly&main_domain_only=false&limit=${limit}`;

    const data = await this.fetchEndpoint<SWKeywordResponse>(path);
    if (!data?.search) return [];

    return data.search
      .filter((k) => k.search_term)
      .map((k) => ({
        keyword: k.search_term!,
        volume: k.volume || 0,
        traffic_share: (k.share || 0) * 100,
        cpc: k.cpc,
      }))
      .slice(0, limit);
  }

  // ============================================================================
  // 7. Audience Interests
  // ============================================================================
  async getAudienceInterests(domain: string): Promise<SimilarWebAudienceInterest[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/audience-interests/also-visited?country=ww`;

    const data = await this.fetchEndpoint<SWAudienceInterestsResponse>(path);
    if (!data?.audience_interests) return [];

    return data.audience_interests
      .filter((i) => i.category)
      .map((i) => ({
        category: i.category!,
        affinity: i.affinity || 0,
      }))
      .sort((a, b) => b.affinity - a.affinity);
  }

  // ============================================================================
  // 8. Similar Sites
  // ============================================================================
  async getSimilarSites(domain: string): Promise<SimilarWebCompetitor[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/similar-sites/similarsites?limit=40`;

    const data = await this.fetchEndpoint<SWSimilarSitesResponse>(path);
    if (!data?.similar_sites) return [];

    return data.similar_sites
      .filter((s) => s.url)
      .map((s) => ({
        domain: s.url!.replace(/^www\./, ''),
        similarity_score: (s.score || 0) * 100,
      }))
      .sort((a, b) => b.similarity_score - a.similarity_score);
  }

  // ============================================================================
  // 9. Keywords Competitors
  // ============================================================================
  async getKeywordCompetitors(domain: string): Promise<SimilarWebCompetitor[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/search-competitors/organicsearchcompetitors?country=ww`;

    const data = await this.fetchEndpoint<SWCompetitorsResponse>(path);
    if (!data?.data) return [];

    return data.data
      .filter((c) => c.domain)
      .map((c) => ({
        domain: c.domain!.replace(/^www\./, ''),
        similarity_score: (c.affinity || 0) * 100,
        overlap_score: (c.overlap_score || 0) * 100,
      }))
      .sort((a, b) => b.similarity_score - a.similarity_score);
  }

  // ============================================================================
  // 10. Website Rank
  // ============================================================================
  async getWebsiteRank(domain: string): Promise<SimilarWebRank | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/global-rank/global-rank`;

    const data = await this.fetchEndpoint<SWRankResponse>(path);
    if (!data) return null;

    return {
      global: data.global_rank || 0,
      country: data.country_rank || 0,
      category: data.category_rank || 0,
    };
  }

  // ============================================================================
  // 11. Referrals
  // ============================================================================
  async getReferrals(domain: string): Promise<SimilarWebReferral[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/traffic-sources/referrals?country=ww&granularity=monthly&main_domain_only=false`;

    const data = await this.fetchEndpoint<SWReferralsResponse>(path);
    if (!data?.referrals) return [];

    return data.referrals
      .filter((r) => r.domain)
      .map((r) => ({
        domain: r.domain!.replace(/^www\./, ''),
        traffic_share: (r.share || 0) * 100,
      }))
      .sort((a, b) => b.traffic_share - a.traffic_share);
  }

  // ============================================================================
  // 12. Popular Pages
  // ============================================================================
  async getPopularPages(domain: string): Promise<SimilarWebPage[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/popular-pages?country=ww&granularity=monthly`;

    const data = await this.fetchEndpoint<SWPagesResponse>(path);
    if (!data?.popular_pages) return [];

    return data.popular_pages
      .filter((p) => p.page)
      .map((p) => ({
        url: p.page!,
        share: (p.share || 0) * 100,
      }))
      .sort((a, b) => b.share - a.share);
  }

  // ============================================================================
  // 13. Leading Folders
  // ============================================================================
  async getLeadingFolders(domain: string): Promise<SimilarWebPage[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/leading-folders?country=ww&granularity=monthly`;

    const data = await this.fetchEndpoint<SWPagesResponse>(path);
    if (!data?.leading_folders) return [];

    return data.leading_folders
      .filter((f) => f.folder)
      .map((f) => ({
        url: f.folder!,
        share: (f.share || 0) * 100,
      }))
      .sort((a, b) => b.share - a.share);
  }

  // ============================================================================
  // 14. Landing Pages
  // ============================================================================
  async getLandingPages(domain: string): Promise<SimilarWebPage[]> {
    const normalizedDomain = this.normalizeDomain(domain);
    const path = `${this.baseUrl}/${normalizedDomain}/traffic-sources/landing-pages?country=ww&granularity=monthly`;

    const data = await this.fetchEndpoint<SWPagesResponse>(path);
    if (!data?.landing_pages) return [];

    return data.landing_pages
      .filter((p) => p.page)
      .map((p) => ({
        url: p.page!,
        share: (p.share || 0) * 100,
      }))
      .sort((a, b) => b.share - a.share);
  }

  // ============================================================================
  // Aggregated: Get Full Data
  // ============================================================================
  async getFullData(domain: string): Promise<SimilarWebFullData | null> {
    const normalizedDomain = this.normalizeDomain(domain);

    // Fetch all endpoints in parallel for performance
    const [
      traffic,
      sources,
      geography,
      demographics,
      audienceInterests,
      organicKeywords,
      paidKeywords,
      competitors,
      keywordCompetitors,
      referrals,
      popularPages,
      leadingFolders,
      landingPages,
    ] = await Promise.all([
      this.getTrafficAndEngagement(domain).catch(() => null),
      this.getTrafficSources(domain).catch(() => null),
      this.getGeography(domain).catch(() => null),
      this.getDemographics(domain).catch(() => null),
      this.getAudienceInterests(domain).catch(() => []),
      this.getOrganicKeywords(domain).catch(() => []),
      this.getPaidKeywords(domain).catch(() => []),
      this.getSimilarSites(domain).catch(() => []),
      this.getKeywordCompetitors(domain).catch(() => []),
      this.getReferrals(domain).catch(() => []),
      this.getPopularPages(domain).catch(() => []),
      this.getLeadingFolders(domain).catch(() => []),
      this.getLandingPages(domain).catch(() => []),
    ]);

    // If we couldn't get basic traffic data, return null
    if (!traffic) {
      return null;
    }

    return {
      traffic,
      sources: sources || {
        direct: 0,
        search: 0,
        referral: 0,
        social: 0,
        mail: 0,
        paid: 0,
      },
      geography: geography || { countries: [] },
      demographics,
      audience_interests: audienceInterests,
      organic_keywords: organicKeywords,
      paid_keywords: paidKeywords,
      competitors,
      keyword_competitors: keywordCompetitors,
      referrals,
      popular_pages: popularPages,
      leading_folders: leadingFolders,
      landing_pages: landingPages,
      fetched_at: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================
export const similarWebClient = new SimilarWebClient();
