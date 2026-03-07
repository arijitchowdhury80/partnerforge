import { HttpClient } from './http-client';
import { config } from '../config';
import { APIResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Date range for time-series data
 */
export interface DateRange {
  start: string; // YYYY-MM format
  end: string;   // YYYY-MM format
}

/**
 * Traffic data response (monthly visits, unique visitors)
 */
export interface TrafficData {
  visits: Array<{
    date: string;        // "2025-12"
    visits: number;      // 100900000
  }>;
  meta: {
    request: {
      domain: string;
      start_date: string;
      end_date: string;
    };
    status: string;
    last_updated: string;
  };
}

/**
 * Engagement metrics (bounce rate, pages/visit, duration)
 */
export interface EngagementData {
  bounce_rate: Array<{
    date: string;
    bounce_rate: number;  // 0.372 (37.2%)
  }>;
  pages_per_visit: Array<{
    date: string;
    pages_per_visit: number; // 5.2
  }>;
  avg_visit_duration: Array<{
    date: string;
    avg_visit_duration: number; // 245 (seconds)
  }>;
  meta: MetaInfo;
}

/**
 * Traffic source breakdown
 */
export interface TrafficSourceData {
  channels: {
    direct: number;           // 0.45 (45%)
    search: number;           // 0.25 (25%)
    social: number;           // 0.15 (15%)
    referral: number;         // 0.10 (10%)
    email: number;            // 0.03 (3%)
    display_ads: number;      // 0.02 (2%)
  };
  search_breakdown: {
    organic: number;          // 0.80 (80% of search)
    paid: number;             // 0.20 (20% of search)
  };
  meta: MetaInfo;
}

/**
 * Geographic traffic distribution
 */
export interface GeographyData {
  countries: Array<{
    country_code: string;     // "US", "GB", "CA"
    country_name: string;     // "United States"
    visits_share: number;     // 0.45 (45%)
  }>;
  meta: MetaInfo;
}

/**
 * Audience demographics (age, gender)
 */
export interface DemographicsData {
  age_distribution: {
    '18-24': number;          // 0.15 (15%)
    '25-34': number;          // 0.30 (30%)
    '35-44': number;          // 0.25 (25%)
    '45-54': number;          // 0.18 (18%)
    '55-64': number;          // 0.08 (8%)
    '65+': number;            // 0.04 (4%)
  };
  gender_distribution: {
    male: number;             // 0.52 (52%)
    female: number;           // 0.48 (48%)
  };
  meta: MetaInfo;
}

/**
 * Top organic search keywords
 */
export interface KeywordData {
  keywords: Array<{
    keyword: string;          // "costco tires"
    visits_share: number;     // 0.025 (2.5% of search traffic)
    position: number;         // 1 (rank in SERP)
    volume: number;           // 50000 (monthly searches)
  }>;
  meta: MetaInfo;
}

/**
 * Similar/competitor websites
 */
export interface CompetitorData {
  sites: Array<{
    domain: string;           // "target.com"
    similarity_score: number; // 0.85 (85% similar)
  }>;
  meta: MetaInfo;
}

/**
 * Audience interest categories
 */
export interface InterestData {
  interests: Array<{
    category: string;         // "Home & Garden"
    affinity: number;         // 1.85 (1.85x more likely than avg)
  }>;
  meta: MetaInfo;
}

/**
 * Website technology stack
 */
export interface TechnologyData {
  technologies: Array<{
    category: string;         // "Analytics", "Advertising", "CMS"
    name: string;             // "Google Analytics", "Google Ads"
  }>;
  meta: MetaInfo;
}

/**
 * Top referring domains
 */
export interface ReferralData {
  referrals: Array<{
    domain: string;           // "google.com"
    share: number;            // 0.35 (35% of referral traffic)
  }>;
  meta: MetaInfo;
}

/**
 * Top landing pages
 */
export interface PopularPagesData {
  pages: Array<{
    page: string;             // "/products/laptops"
    share: number;            // 0.15 (15% of traffic)
  }>;
  meta: MetaInfo;
}

/**
 * Top URL folders/sections
 */
export interface LeadingFoldersData {
  folders: Array<{
    folder: string;           // "/blog"
    share: number;            // 0.25 (25% of traffic)
  }>;
  meta: MetaInfo;
}

/**
 * SEO landing pages
 */
export interface LandingPagesData {
  landing_pages: Array<{
    page: string;             // "/products/laptop"
    keyword: string;          // "best laptop 2025"
    visits_share: number;     // 0.05 (5%)
  }>;
  meta: MetaInfo;
}

/**
 * Keyword overlap with competitors
 */
export interface KeywordCompetitorsData {
  competitors: Array<{
    domain: string;           // "target.com"
    keyword_overlap: number;  // 0.65 (65% overlap)
    shared_keywords: number;  // 1250
  }>;
  meta: MetaInfo;
}

/**
 * Global and category rank
 */
export interface WebsiteRankData {
  global_rank: number;        // 125 (125th worldwide)
  category_rank: number;      // 15 (15th in category)
  category: string;           // "E-commerce & Shopping"
  meta: MetaInfo;
}

/**
 * Generic metadata for API responses
 */
interface MetaInfo {
  request: {
    domain: string;
    [key: string]: any;
  };
  status: string;
  last_updated: string;
}

/**
 * SimilarWeb API Client
 *
 * Provides access to 14 SimilarWeb endpoints for traffic analytics, engagement metrics,
 * competitor analysis, and audience insights.
 *
 * Features:
 * - Automatic 7-day caching (604800 seconds)
 * - Rate limiting (2 requests/second by default)
 * - Retry logic with exponential backoff
 * - Cost tracking ($0.03 per API call)
 * - Comprehensive error handling
 *
 * @example
 * ```typescript
 * const client = new SimilarWebClient();
 *
 * // Get traffic data for last 6 months
 * const traffic = await client.getTrafficData('costco.com', {
 *   start: '2025-06',
 *   end: '2025-12'
 * });
 *
 * // Get competitor analysis
 * const competitors = await client.getSimilarSites('costco.com');
 * ```
 */
export class SimilarWebClient {
  private http: HttpClient;
  private readonly baseURL = 'https://api.similarweb.com/v1';
  private readonly costPerCall = config.costs.similarweb;
  private readonly rateLimitKey = 'similarweb';

  constructor() {
    this.http = new HttpClient(
      this.baseURL,
      config.redis.cacheTTL, // 7 days
      30000 // 30 second timeout
    );

    // Add API key to all requests
    this.http['client'].defaults.headers.common['api-key'] = process.env.SIMILARWEB_API_KEY;

    logger.info('SimilarWebClient initialized', {
      rateLimit: config.rateLimit.similarweb,
      costPerCall: this.costPerCall
    });
  }

  /**
   * Get total traffic data (monthly visits, unique visitors)
   *
   * @param domain - Domain name (e.g., "costco.com")
   * @param dateRange - Start and end dates in YYYY-MM format
   * @returns Traffic data with monthly visits
   *
   * @example
   * ```typescript
   * const traffic = await client.getTrafficData('costco.com', {
   *   start: '2025-06',
   *   end: '2025-12'
   * });
   * console.log(traffic.data.visits[0].visits); // 100900000
   * ```
   */
  async getTrafficData(domain: string, dateRange: DateRange): Promise<APIResponse<TrafficData>> {
    const endpoint = `/website/${domain}/total-traffic-and-engagement/desktop_mau_visits`;

    return this.http.get<TrafficData>(
      endpoint,
      {
        start_date: dateRange.start,
        end_date: dateRange.end,
        country: 'ww',
        granularity: 'monthly'
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get engagement metrics (bounce rate, pages/visit, avg duration)
   *
   * @param domain - Domain name
   * @param dateRange - Start and end dates in YYYY-MM format
   * @returns Engagement metrics
   *
   * @example
   * ```typescript
   * const engagement = await client.getEngagementMetrics('costco.com', {
   *   start: '2025-12',
   *   end: '2025-12'
   * });
   * console.log(engagement.data.bounce_rate[0].bounce_rate); // 0.372 (37.2%)
   * ```
   */
  async getEngagementMetrics(domain: string, dateRange: DateRange): Promise<APIResponse<EngagementData>> {
    const endpoint = `/website/${domain}/total-traffic-and-engagement/engagement`;

    return this.http.get<EngagementData>(
      endpoint,
      {
        start_date: dateRange.start,
        end_date: dateRange.end,
        country: 'ww',
        granularity: 'monthly'
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get traffic source breakdown (direct, search, social, referral, email, display)
   *
   * @param domain - Domain name
   * @param dateRange - Start and end dates in YYYY-MM format
   * @returns Traffic source distribution
   *
   * @example
   * ```typescript
   * const sources = await client.getTrafficSources('costco.com', {
   *   start: '2025-12',
   *   end: '2025-12'
   * });
   * console.log(sources.data.channels.direct); // 0.45 (45%)
   * console.log(sources.data.search_breakdown.organic); // 0.80 (80%)
   * ```
   */
  async getTrafficSources(domain: string, dateRange: DateRange): Promise<APIResponse<TrafficSourceData>> {
    const endpoint = `/website/${domain}/traffic-sources/overview`;

    return this.http.get<TrafficSourceData>(
      endpoint,
      {
        start_date: dateRange.start,
        end_date: dateRange.end,
        country: 'ww'
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get geographic traffic distribution (top 5 countries)
   *
   * @param domain - Domain name
   * @param dateRange - Start and end dates in YYYY-MM format
   * @returns Geographic distribution of traffic
   *
   * @example
   * ```typescript
   * const geo = await client.getGeography('costco.com', {
   *   start: '2025-12',
   *   end: '2025-12'
   * });
   * console.log(geo.data.countries[0].country_name); // "United States"
   * console.log(geo.data.countries[0].visits_share); // 0.45 (45%)
   * ```
   */
  async getGeography(domain: string, dateRange: DateRange): Promise<APIResponse<GeographyData>> {
    const endpoint = `/website/${domain}/geo/traffic-shares`;

    return this.http.get<GeographyData>(
      endpoint,
      {
        start_date: dateRange.start,
        end_date: dateRange.end,
        granularity: 'monthly'
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get audience demographics (age and gender distribution)
   *
   * @param domain - Domain name
   * @returns Demographics data
   *
   * @example
   * ```typescript
   * const demographics = await client.getDemographics('costco.com');
   * console.log(demographics.data.age_distribution['25-34']); // 0.30 (30%)
   * console.log(demographics.data.gender_distribution.male); // 0.52 (52%)
   * ```
   */
  async getDemographics(domain: string): Promise<APIResponse<DemographicsData>> {
    const endpoint = `/website/${domain}/demographics/age`;

    return this.http.get<DemographicsData>(
      endpoint,
      {
        country: 'ww'
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get top organic search keywords
   *
   * @param domain - Domain name
   * @param limit - Number of keywords to return (default: 50)
   * @returns Top keywords with traffic share and search volume
   *
   * @example
   * ```typescript
   * const keywords = await client.getTopKeywords('costco.com', 20);
   * keywords.data.keywords.forEach(kw => {
   *   console.log(`${kw.keyword}: ${kw.visits_share * 100}%`);
   * });
   * ```
   */
  async getTopKeywords(domain: string, limit: number = 50): Promise<APIResponse<KeywordData>> {
    const endpoint = `/website/${domain}/keywords/top`;

    return this.http.get<KeywordData>(
      endpoint,
      {
        country: 'ww',
        limit
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get similar/competitor websites
   *
   * @param domain - Domain name
   * @param limit - Number of competitors to return (default: 10)
   * @returns Similar sites with similarity scores
   *
   * @example
   * ```typescript
   * const competitors = await client.getSimilarSites('costco.com');
   * competitors.data.sites.forEach(site => {
   *   console.log(`${site.domain}: ${site.similarity_score * 100}% similar`);
   * });
   * ```
   */
  async getSimilarSites(domain: string, limit: number = 10): Promise<APIResponse<CompetitorData>> {
    const endpoint = `/website/${domain}/similar-sites/similarsites`;

    return this.http.get<CompetitorData>(
      endpoint,
      {
        limit
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get audience interest categories
   *
   * @param domain - Domain name
   * @returns Interest categories with affinity scores
   *
   * @example
   * ```typescript
   * const interests = await client.getAudienceInterests('costco.com');
   * interests.data.interests.forEach(interest => {
   *   console.log(`${interest.category}: ${interest.affinity}x affinity`);
   * });
   * ```
   */
  async getAudienceInterests(domain: string): Promise<APIResponse<InterestData>> {
    const endpoint = `/website/${domain}/audience-interests`;

    return this.http.get<InterestData>(
      endpoint,
      {},
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get website technology stack (analytics, advertising, CMS)
   *
   * Note: This endpoint may have limited data for some domains.
   * Consider using BuiltWith API as primary source for tech stack.
   *
   * @param domain - Domain name
   * @returns Technologies detected on the website
   *
   * @example
   * ```typescript
   * const tech = await client.getTechnologies('costco.com');
   * tech.data.technologies.forEach(t => {
   *   console.log(`${t.category}: ${t.name}`);
   * });
   * ```
   */
  async getTechnologies(domain: string): Promise<APIResponse<TechnologyData>> {
    const endpoint = `/website/${domain}/technographics/all`;

    return this.http.get<TechnologyData>(
      endpoint,
      {},
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get top referring domains
   *
   * @param domain - Domain name
   * @param limit - Number of referrers to return (default: 20)
   * @returns Top referring domains with traffic share
   *
   * @example
   * ```typescript
   * const referrals = await client.getReferrals('costco.com');
   * referrals.data.referrals.forEach(ref => {
   *   console.log(`${ref.domain}: ${ref.share * 100}%`);
   * });
   * ```
   */
  async getReferrals(domain: string, limit: number = 20): Promise<APIResponse<ReferralData>> {
    const endpoint = `/website/${domain}/referrals`;

    return this.http.get<ReferralData>(
      endpoint,
      {
        limit
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get top landing pages (most visited pages)
   *
   * @param domain - Domain name
   * @param limit - Number of pages to return (default: 20)
   * @returns Popular pages with traffic share
   *
   * @example
   * ```typescript
   * const pages = await client.getPopularPages('costco.com');
   * pages.data.pages.forEach(page => {
   *   console.log(`${page.page}: ${page.share * 100}%`);
   * });
   * ```
   */
  async getPopularPages(domain: string, limit: number = 20): Promise<APIResponse<PopularPagesData>> {
    const endpoint = `/website/${domain}/content/pages`;

    return this.http.get<PopularPagesData>(
      endpoint,
      {
        limit
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get top URL folders/sections
   *
   * @param domain - Domain name
   * @param limit - Number of folders to return (default: 10)
   * @returns Leading folders with traffic share
   *
   * @example
   * ```typescript
   * const folders = await client.getLeadingFolders('costco.com');
   * folders.data.folders.forEach(folder => {
   *   console.log(`${folder.folder}: ${folder.share * 100}%`);
   * });
   * ```
   */
  async getLeadingFolders(domain: string, limit: number = 10): Promise<APIResponse<LeadingFoldersData>> {
    const endpoint = `/website/${domain}/content/leading-folders`;

    return this.http.get<LeadingFoldersData>(
      endpoint,
      {
        limit
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get SEO landing pages (entry pages from search)
   *
   * @param domain - Domain name
   * @param limit - Number of landing pages to return (default: 20)
   * @returns Landing pages with associated keywords
   *
   * @example
   * ```typescript
   * const landing = await client.getLandingPages('costco.com');
   * landing.data.landing_pages.forEach(page => {
   *   console.log(`${page.page} <- ${page.keyword} (${page.visits_share * 100}%)`);
   * });
   * ```
   */
  async getLandingPages(domain: string, limit: number = 20): Promise<APIResponse<LandingPagesData>> {
    const endpoint = `/website/${domain}/keywords/landing-pages`;

    return this.http.get<LandingPagesData>(
      endpoint,
      {
        limit
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get keyword overlap with competitors
   *
   * @param domain - Domain name
   * @param limit - Number of competitors to analyze (default: 5)
   * @returns Competitors with keyword overlap metrics
   *
   * @example
   * ```typescript
   * const overlap = await client.getKeywordCompetitors('costco.com');
   * overlap.data.competitors.forEach(comp => {
   *   console.log(`${comp.domain}: ${comp.shared_keywords} shared keywords`);
   * });
   * ```
   */
  async getKeywordCompetitors(domain: string, limit: number = 5): Promise<APIResponse<KeywordCompetitorsData>> {
    const endpoint = `/website/${domain}/keywords/competitors`;

    return this.http.get<KeywordCompetitorsData>(
      endpoint,
      {
        limit
      },
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Get global and category rank
   *
   * @param domain - Domain name
   * @returns Website rank (global and category)
   *
   * @example
   * ```typescript
   * const rank = await client.getWebsiteRank('costco.com');
   * console.log(`Global rank: ${rank.data.global_rank}`);
   * console.log(`Category rank: ${rank.data.category_rank} in ${rank.data.category}`);
   * ```
   */
  async getWebsiteRank(domain: string): Promise<APIResponse<WebsiteRankData>> {
    const endpoint = `/website/${domain}/global-rank/global-rank`;

    return this.http.get<WebsiteRankData>(
      endpoint,
      {},
      {
        rateLimitKey: this.rateLimitKey,
        persist: true
      }
    );
  }

  /**
   * Batch fetch all available data for a domain
   *
   * Executes all 14 endpoints in parallel with rate limiting.
   * Use this for initial audit data collection.
   *
   * @param domain - Domain name
   * @param dateRange - Start and end dates for time-series data
   * @returns Object with all available data
   *
   * @example
   * ```typescript
   * const allData = await client.fetchAllData('costco.com', {
   *   start: '2025-12',
   *   end: '2025-12'
   * });
   *
   * console.log('Traffic:', allData.traffic.data.visits);
   * console.log('Competitors:', allData.competitors.data.sites);
   * ```
   */
  async fetchAllData(domain: string, dateRange: DateRange) {
    logger.info(`Fetching all SimilarWeb data for ${domain}`);

    const startTime = Date.now();

    try {
      // Execute all requests (rate limiting handled by HttpClient)
      const [
        traffic,
        engagement,
        sources,
        geography,
        demographics,
        keywords,
        competitors,
        interests,
        technologies,
        referrals,
        popularPages,
        leadingFolders,
        landingPages,
        keywordCompetitors,
        websiteRank
      ] = await Promise.all([
        this.getTrafficData(domain, dateRange),
        this.getEngagementMetrics(domain, dateRange),
        this.getTrafficSources(domain, dateRange),
        this.getGeography(domain, dateRange),
        this.getDemographics(domain),
        this.getTopKeywords(domain),
        this.getSimilarSites(domain),
        this.getAudienceInterests(domain),
        this.getTechnologies(domain),
        this.getReferrals(domain),
        this.getPopularPages(domain),
        this.getLeadingFolders(domain),
        this.getLandingPages(domain),
        this.getKeywordCompetitors(domain),
        this.getWebsiteRank(domain)
      ]);

      const totalTime = Date.now() - startTime;
      const cacheHits = [
        traffic, engagement, sources, geography, demographics,
        keywords, competitors, interests, technologies, referrals,
        popularPages, leadingFolders, landingPages, keywordCompetitors,
        websiteRank
      ].filter(r => r.meta.cached).length;

      logger.info(`Fetched all SimilarWeb data for ${domain}`, {
        totalTime,
        cacheHits,
        cacheMisses: 14 - cacheHits,
        estimatedCost: (14 - cacheHits) * this.costPerCall
      });

      return {
        traffic,
        engagement,
        sources,
        geography,
        demographics,
        keywords,
        competitors,
        interests,
        technologies,
        referrals,
        popularPages,
        leadingFolders,
        landingPages,
        keywordCompetitors,
        websiteRank,
        meta: {
          totalEndpoints: 14,
          cacheHits,
          cacheMisses: 14 - cacheHits,
          totalTimeMs: totalTime,
          estimatedCost: (14 - cacheHits) * this.costPerCall
        }
      };
    } catch (error) {
      logger.error(`Failed to fetch SimilarWeb data for ${domain}`, error);
      throw error;
    }
  }
}
